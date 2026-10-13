import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { EntitlementScopeType } from '../common/enums/entitlement-scope-type.enum';
import { PaperType } from '../common/enums/paper-type.enum';
import { ExamGroup } from '../exam-groups/schemas/exam-group.schema';
import { Exam } from '../exams/schemas/exam.schema';
import { MockTest } from '../mock-tests/schemas/mock-test.schema';
import { GrantTargetsService } from './grant-targets.service';

const EXAM_ID = '507f1f77bcf86cd799439011';
const GROUP_ID = '507f1f77bcf86cd799439012';
const PAPER_ID = '507f1f77bcf86cd799439013';
const MISSING_ID = '507f1f77bcf86cd799439099';

function chain(result: unknown) {
  const query: any = {
    exec: jest.fn().mockResolvedValue(result),
    select: jest.fn(),
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    lean: jest.fn(),
  };
  query.select.mockReturnValue(query);
  query.sort.mockReturnValue(query);
  query.skip.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.lean.mockReturnValue(query);
  return query;
}

describe('GrantTargetsService', () => {
  let service: GrantTargetsService;
  const examModel = { find: jest.fn(), countDocuments: jest.fn() };
  const examGroupModel = { find: jest.fn(), countDocuments: jest.fn() };
  const mockTestModel = { find: jest.fn(), countDocuments: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrantTargetsService,
        { provide: getModelToken(Exam.name), useValue: examModel },
        { provide: getModelToken(ExamGroup.name), useValue: examGroupModel },
        { provide: getModelToken(MockTest.name), useValue: mockTestModel },
      ],
    }).compile();
    service = module.get(GrantTargetsService);
    jest.clearAllMocks();
  });

  it('rejects an invalid scope type', async () => {
    await expect(service.search({ scopeType: 'PAPER' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a bad id and a list longer than 100', async () => {
    await expect(
      service.search({ scopeType: EntitlementScopeType.EXAM, ids: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const ids = Array.from({ length: 101 }, () =>
      new Types.ObjectId().toString(),
    ).join(',');
    await expect(
      service.search({ scopeType: EntitlementScopeType.EXAM, ids }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('searches exam groups by name or short name and excludes deleted', async () => {
    const rows = [{ _id: GROUP_ID, name: 'Staff Selection', shortName: 'SSC' }];
    examGroupModel.find.mockReturnValue(chain(rows));
    examGroupModel.countDocuments.mockReturnValue({
      exec: () => Promise.resolve(1),
    });

    const result = await service.search({
      scopeType: EntitlementScopeType.EXAM_GROUP,
      search: 'ssc+',
    });

    expect(examGroupModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        isDeleted: { $ne: true },
        $or: [
          { name: { $regex: 'ssc\\+', $options: 'i' } },
          { shortName: { $regex: 'ssc\\+', $options: 'i' } },
        ],
      }),
    );
    expect(result.data).toEqual([
      { id: GROUP_ID, label: 'Staff Selection (SSC)' },
    ]);
  });

  it('searches exams by name and paginates', async () => {
    const query = chain([{ _id: EXAM_ID, name: 'SSC CGL' }]);
    examModel.find.mockReturnValue(query);
    examModel.countDocuments.mockReturnValue({
      exec: () => Promise.resolve(25),
    });

    const result = await service.search({
      scopeType: EntitlementScopeType.EXAM,
      search: 'cgl',
      page: 2,
      limit: 20,
    });

    expect(examModel.find).toHaveBeenCalledWith({
      isDeleted: { $ne: true },
      name: { $regex: 'cgl', $options: 'i' },
    });
    expect(query.skip).toHaveBeenCalledWith(20);
    expect(query.limit).toHaveBeenCalledWith(20);
    expect(result.pagination).toMatchObject({
      total: 25,
      page: 2,
      limit: 20,
      totalPages: 2,
      hasNextPage: false,
      hasPrevPage: true,
    });
    expect(result.data).toEqual([{ id: EXAM_ID, label: 'SSC CGL' }]);
  });

  it('caps the page size at 50', async () => {
    const query = chain([]);
    examModel.find.mockReturnValue(query);
    examModel.countDocuments.mockReturnValue({
      exec: () => Promise.resolve(0),
    });

    await service.search({
      scopeType: EntitlementScopeType.EXAM,
      limit: 500,
    });

    expect(query.limit).toHaveBeenCalledWith(50);
  });

  it('searches mock tests by title and description, including inactive papers', async () => {
    mockTestModel.find.mockReturnValue(
      chain([
        { _id: PAPER_ID, title: 'Polity set', paperType: PaperType.TOPIC_WISE },
      ]),
    );
    mockTestModel.countDocuments.mockReturnValue({
      exec: () => Promise.resolve(1),
    });

    const result = await service.search({
      scopeType: EntitlementScopeType.MOCK_TEST,
      search: 'a+b',
    });

    const filter = mockTestModel.find.mock.calls[0][0];
    expect(filter.isDeleted).toEqual({ $ne: true });
    expect(filter.isActive).toBeUndefined();
    expect(filter.paperType).toEqual({
      $in: [PaperType.TOPIC_WISE, PaperType.SPRINT, PaperType.FULL_EXAM],
    });
    expect(filter.$or).toEqual(
      expect.arrayContaining([
        { title: { $regex: 'a\\+b', $options: 'i' } },
        { description: { $regex: 'a\\+b', $options: 'i' } },
      ]),
    );
    expect(result.data).toEqual([
      { id: PAPER_ID, label: 'Topic · Polity set' },
    ]);
  });

  it('treats a leading paper-kind word as a kind filter', async () => {
    mockTestModel.find.mockReturnValue(chain([]));
    mockTestModel.countDocuments.mockReturnValue({
      exec: () => Promise.resolve(0),
    });

    await service.search({
      scopeType: EntitlementScopeType.MOCK_TEST,
      search: 'Sprint · Polity',
    });

    const filter = mockTestModel.find.mock.calls[0][0];
    expect(filter.$or).toEqual(
      expect.arrayContaining([
        { paperType: PaperType.SPRINT, $or: expect.any(Array) },
        { title: { $regex: 'Sprint · Polity', $options: 'i' } },
      ]),
    );
    const kindClause = filter.$or.find(
      (clause: { paperType?: string }) => clause.paperType === PaperType.SPRINT,
    );
    expect(kindClause.$or).toEqual([
      { title: { $regex: 'Polity', $options: 'i' } },
      { description: { $regex: 'Polity', $options: 'i' } },
    ]);
  });

  it('matches every paper of a kind when the search is only that kind', async () => {
    mockTestModel.find.mockReturnValue(
      chain([
        { _id: PAPER_ID, title: 'Prelims', paperType: PaperType.FULL_EXAM },
      ]),
    );
    mockTestModel.countDocuments.mockReturnValue({
      exec: () => Promise.resolve(1),
    });

    const result = await service.search({
      scopeType: EntitlementScopeType.MOCK_TEST,
      search: 'full',
    });

    const filter = mockTestModel.find.mock.calls[0][0];
    expect(filter.$or).toEqual(
      expect.arrayContaining([{ paperType: PaperType.FULL_EXAM }]),
    );
    expect(result.data[0].label).toBe('Full · Prelims');
  });

  it('resolves requested ids and omits unknown documents', async () => {
    examModel.find.mockReturnValue(chain([{ _id: EXAM_ID, name: 'SSC CGL' }]));

    const result = await service.search({
      scopeType: EntitlementScopeType.EXAM,
      ids: `${EXAM_ID}, ${MISSING_ID}`,
      search: 'ignored',
      page: 3,
    });

    expect(examModel.find).toHaveBeenCalledWith({
      _id: {
        $in: [new Types.ObjectId(EXAM_ID), new Types.ObjectId(MISSING_ID)],
      },
      isDeleted: { $ne: true },
    });
    expect(examModel.countDocuments).not.toHaveBeenCalled();
    expect(result.data).toEqual([{ id: EXAM_ID, label: 'SSC CGL' }]);
    expect(result.pagination).toMatchObject({
      total: 1,
      page: 1,
      hasNextPage: false,
    });
  });

  it('labels resolved mock tests by paper kind', async () => {
    mockTestModel.find.mockReturnValue(
      chain([{ _id: PAPER_ID, title: '  ', paperType: PaperType.SPRINT }]),
    );

    const result = await service.search({
      scopeType: EntitlementScopeType.MOCK_TEST,
      ids: PAPER_ID,
    });

    expect(result.data).toEqual([
      { id: PAPER_ID, label: `Sprint · ${PAPER_ID}` },
    ]);
  });
});
