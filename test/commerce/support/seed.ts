import { Connection, Model, Types } from 'mongoose';
import { AccessMode } from '../../../src/common/enums/access-mode.enum';
import { DurationPreset } from '../../../src/common/enums/duration-preset.enum';
import { EntitlementScopeType } from '../../../src/common/enums/entitlement-scope-type.enum';
import { OfferStatus } from '../../../src/common/enums/offer-status.enum';
import { ProductStatus } from '../../../src/common/enums/product-status.enum';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { INSTANCE_CONFIG_ID } from '../../../src/instance-config/instance-config.constants';
import { InstanceConfig } from '../../../src/instance-config/schemas/instance-config.schema';
import { Category } from '../../../src/categories/schemas/category.schema';
import { ExamGroup } from '../../../src/exam-groups/schemas/exam-group.schema';
import { Exam } from '../../../src/exams/schemas/exam.schema';
import { MockTest } from '../../../src/mock-tests/schemas/mock-test.schema';
import { Offer } from '../../../src/offers/schemas/offer.schema';
import { Product } from '../../../src/products/schemas/product.schema';
import { ProductVersion } from '../../../src/products/schemas/product-version.schema';
import { User } from '../../../src/users/schemas/user.schema';

export type CommerceFixture = {
  studentId: string;
  otherStudentId: string;
  adminId: string;
  examId: string;
  otherExamId: string;
  freePaperId: string;
  entitledPaperId: string;
  productId: string;
  offerId: string;
  listAmount: number;
};

export const billingBody = {
  name: 'Asha Nair',
  stateCode: '32',
  addressLine1: '12 Marine Drive',
  city: 'Kochi',
  pincode: '682001',
};

export async function seedCommerceFixture(
  connection: Connection,
): Promise<CommerceFixture> {
  const users = connection.model<User>(User.name) as Model<User>;
  const categories = connection.model<Category>(
    Category.name,
  ) as Model<Category>;
  const groups = connection.model<ExamGroup>(
    ExamGroup.name,
  ) as Model<ExamGroup>;
  const exams = connection.model<Exam>(Exam.name) as Model<Exam>;
  const papers = connection.model<MockTest>(MockTest.name) as Model<MockTest>;
  const products = connection.model<Product>(Product.name) as Model<Product>;
  const versions = connection.model<ProductVersion>(
    ProductVersion.name,
  ) as Model<ProductVersion>;
  const offers = connection.model<Offer>(Offer.name) as Model<Offer>;
  const configs = connection.model<InstanceConfig>(
    InstanceConfig.name,
  ) as Model<InstanceConfig>;

  const student = await users.create({
    name: 'Student One',
    email: 'student-one@harness.test',
    role: UserRole.USER,
    isActive: true,
    isDeleted: false,
  });
  const other = await users.create({
    name: 'Student Two',
    email: 'student-two@harness.test',
    role: UserRole.USER,
    isActive: true,
    isDeleted: false,
  });
  const admin = await users.create({
    name: 'Admin',
    email: 'admin@harness.test',
    role: UserRole.ADMIN,
    isActive: true,
    isDeleted: false,
  });

  const category = await categories.create({
    name: 'Railways',
    shortName: 'RRB',
    isActive: true,
    isDeleted: false,
  });
  const group = await groups.create({
    name: 'RRB Group',
    category: category._id,
    isActive: true,
    isDeleted: false,
  });
  const exam = await exams.create({
    name: 'RRB NTPC',
    category: category._id,
    examGroup: group._id,
    isActive: true,
    isDeleted: false,
  });
  const otherExam = await exams.create({
    name: 'RRB ALP',
    category: category._id,
    examGroup: group._id,
    isActive: true,
    isDeleted: false,
  });

  const paperBase = {
    totalQuestions: 1,
    durationInMinutes: 10,
    exam: exam._id,
    title: 'Paper',
    description: 'Harness paper',
    questionIds: [] as Types.ObjectId[],
    isActive: true,
    isDeleted: false,
    allowRetake: true,
  };
  const freePaper = await papers.create({
    ...paperBase,
    title: 'Free paper',
    accessMode: AccessMode.FREE,
  });
  const entitledPaper = await papers.create({
    ...paperBase,
    title: 'Entitled paper',
    accessMode: AccessMode.ENTITLED,
  });

  const grants = [
    {
      scopeType: EntitlementScopeType.EXAM,
      scopeId: exam._id,
    },
  ];
  const product = await products.create({
    code: 'RRB-NTPC',
    name: 'NTPC pack',
    status: ProductStatus.PUBLISHED,
    version: 1,
    grants,
    publishedGrants: grants,
    isDeleted: false,
  });
  await versions.create({
    productId: product._id,
    version: 1,
    code: 'RRB-NTPC',
    name: 'NTPC pack',
    grants,
    frozenAt: new Date(),
  });
  const offer = await offers.create({
    productId: product._id,
    durationPreset: DurationPreset.ONE_MONTH,
    currency: 'INR',
    listAmount: 99900,
    taxIncluded: true,
    status: OfferStatus.ACTIVE,
  });

  await configs.create({
    _id: INSTANCE_CONFIG_ID,
    schemaVersion: 1,
    name: 'EZ Prep',
    taxConfig: {
      taxEnabled: true,
      taxType: 'GST',
      taxRate: 18,
      pricesAreTaxInclusive: true,
      currency: 'INR',
      sacCode: '999293',
      sacDescription: 'Commercial training and coaching services',
      invoiceSeriesPrefix: 'EZPREP',
    },
    seller: {
      legalName: 'EzPrep - Powered by Clustream',
      gstin: '32BIAPD6927L1ZC',
      registeredAddress: 'Kochi, Kerala',
      state: 'Kerala',
      stateCode: '32',
    },
  });

  return {
    studentId: String(student._id),
    otherStudentId: String(other._id),
    adminId: String(admin._id),
    examId: String(exam._id),
    otherExamId: String(otherExam._id),
    freePaperId: String(freePaper._id),
    entitledPaperId: String(entitledPaper._id),
    productId: String(product._id),
    offerId: String(offer._id),
    listAmount: 99900,
  };
}
