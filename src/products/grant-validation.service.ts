import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import {
  ExamGroup,
  ExamGroupDocument,
} from '../exam-groups/schemas/exam-group.schema';
import { Exam, ExamDocument } from '../exams/schemas/exam.schema';
import {
  MockTest,
  MockTestDocument,
} from '../mock-tests/schemas/mock-test.schema';
import { ProductGrantDto } from './dto/product-grant.dto';

@Injectable()
export class GrantValidationService {
  constructor(
    @InjectModel(Exam.name) private readonly examModel: Model<ExamDocument>,
    @InjectModel(ExamGroup.name)
    private readonly examGroupModel: Model<ExamGroupDocument>,
    @InjectModel(MockTest.name)
    private readonly mockTestModel: Model<MockTestDocument>,
  ) {}

  async assertGrantsValid(grants: ProductGrantDto[]): Promise<void> {
    if (!grants.length) {
      throw new BadRequestException(
        'At least one grant is required to publish',
      );
    }

    for (const grant of grants) {
      await this.assertScopeExists(grant.scopeType, grant.scopeId);
    }
  }

  async assertScopeExists(
    scopeType: EntitlementScopeType,
    scopeId: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(scopeId)) {
      throw new BadRequestException('Invalid scopeId');
    }

    let exists = false;
    switch (scopeType) {
      case EntitlementScopeType.EXAM:
        exists = !!(await this.examModel
          .findById(scopeId)
          .select('_id')
          .lean());
        break;
      case EntitlementScopeType.EXAM_GROUP:
        exists = !!(await this.examGroupModel
          .findById(scopeId)
          .select('_id')
          .lean());
        break;
      case EntitlementScopeType.MOCK_TEST:
        exists = !!(await this.mockTestModel
          .findById(scopeId)
          .select('_id')
          .lean());
        break;
      default:
        throw new BadRequestException(`Unsupported scopeType: ${scopeType}`);
    }

    if (!exists) {
      throw new BadRequestException(
        `${scopeType} with ID "${scopeId}" not found`,
      );
    }
  }
}
