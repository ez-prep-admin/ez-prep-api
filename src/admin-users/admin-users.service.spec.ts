import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AdminUsersService } from './admin-users.service';
import { User } from '../users/schemas/user.schema';
import { MockTestAttempt } from '../mock-test-attempts/schemas/mock-test-attempt.schema';
import { UserRole } from '../common/enums/user-role.enum';
import { SubscriptionPlan } from '../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';
import { MembershipTier } from '../common/enums/membership-tier.enum';
import { Gender } from '../common/enums/gender.enum';
import { APP_USER_ROLE } from './admin-users.guardrails';

function chain(result: unknown) {
  const q: any = {
    exec: jest.fn().mockResolvedValue(result),
    populate: jest.fn(),
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
  };
  q.populate.mockReturnValue(q);
  q.sort.mockReturnValue(q);
  q.skip.mockReturnValue(q);
  q.limit.mockReturnValue(q);
  return q;
}

function learnerDoc(overrides: Record<string, unknown> = {}) {
  const id = (overrides.id as string) || '507f1f77bcf86cd799439011';
  const payload = {
    id,
    _id: id,
    name: 'Anita Sharma',
    email: 'anita@example.com',
    phoneNumber: '+919876543210',
    role: UserRole.USER,
    isActive: true,
    avatarUrl: 'https://cdn.example/a.png',
    gender: Gender.FEMALE,
    location: { city: 'Bengaluru', state: 'KA', country: 'IN' },
    subscription: {
      plan: SubscriptionPlan.PREMIUM,
      status: SubscriptionStatus.ACTIVE,
    },
    membershipTier: MembershipTier.GOLD,
    badgesEarnedCount: 4,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    username: 'should-not-leak',
    passwordHash: 'secret',
    preferences: { studyTime: 'morning' },
    interactions: { likedTopics: [] },
    bio: 'hidden from list',
    dateOfBirth: new Date('1995-01-01'),
    isDeleted: false,
    ...overrides,
  };
  return {
    ...payload,
    toObject: jest.fn().mockReturnValue({ ...payload }),
  };
}

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  const userModel: any = {
    find: jest.fn(),
    countDocuments: jest.fn(),
  };
  const attemptModel: any = {
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: getModelToken(User.name), useValue: userModel },
        {
          provide: getModelToken(MockTestAttempt.name),
          useValue: attemptModel,
        },
      ],
    }).compile();

    service = module.get(AdminUsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('queries only learners and never asks Mongo for admins', async () => {
    const user = learnerDoc();
    const findChain = chain([user]);
    userModel.find.mockReturnValue(findChain);
    userModel.countDocuments.mockReturnValue(chain(1));
    attemptModel.aggregate.mockReturnValue(chain([]));

    await service.listAppUsers(1, 12);

    expect(userModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.USER }),
    );
    const filter = userModel.find.mock.calls[0][0];
    expect(filter.role).not.toBe(UserRole.ADMIN);
    expect(JSON.stringify(filter)).not.toContain(UserRole.ADMIN);
    expect(findChain.populate).toHaveBeenCalledWith('targetExam', 'name');
    expect(findChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(findChain.skip).toHaveBeenCalledWith(0);
    expect(findChain.limit).toHaveBeenCalledWith(12);
  });

  it('returns paginated learner cards with attempt counts', async () => {
    const id = '507f1f77bcf86cd799439011';
    const user = learnerDoc({
      id,
      _id: id,
      targetExam: { id: 'exam1', name: 'UPSC' },
    });
    userModel.find.mockReturnValue(chain([user]));
    userModel.countDocuments.mockReturnValue(chain(25));
    attemptModel.aggregate.mockReturnValue(chain([{ _id: id, count: 7 }]));

    const result = await service.listAppUsers(2, 12);

    expect(result.pagination).toEqual({
      total: 25,
      page: 2,
      limit: 12,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: true,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id,
      name: 'Anita Sharma',
      email: 'a***@example.com',
      phoneNumber: '+91**********',
      role: APP_USER_ROLE,
      testsAttendedCount: 7,
      targetExam: { id: 'exam1', name: 'UPSC' },
      subscription: {
        plan: SubscriptionPlan.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
      },
    });
    expect(JSON.stringify(result.data[0])).not.toContain('anita@example.com');
    expect(JSON.stringify(result.data[0])).not.toContain('+919876543210');
    expect(result.data[0]).not.toHaveProperty('username');
    expect(result.data[0]).not.toHaveProperty('passwordHash');
    expect(result.data[0]).not.toHaveProperty('preferences');
    expect(result.data[0]).not.toHaveProperty('interactions');
    expect(result.data[0]).not.toHaveProperty('bio');
  });

  it('strips any admin document that leaks through the query layer', async () => {
    const learner = learnerDoc({ id: 'u1', _id: 'u1' });
    const admin = learnerDoc({
      id: 'a1',
      _id: 'a1',
      role: UserRole.ADMIN,
      name: 'Root Admin',
      username: 'root',
    });
    userModel.find.mockReturnValue(chain([learner, admin]));
    userModel.countDocuments.mockReturnValue(chain(2));
    attemptModel.aggregate.mockReturnValue(chain([]));

    const result = await service.listAppUsers();

    expect(result.data.map(item => item.id)).toEqual(['u1']);
    expect(result.data.some(item => String(item.role) === 'admin')).toBe(false);
    expect(result.data.some(item => item.name === 'Root Admin')).toBe(false);
  });

  it('does not query attempts when the page has no learners', async () => {
    userModel.find.mockReturnValue(chain([]));
    userModel.countDocuments.mockReturnValue(chain(0));

    const result = await service.listAppUsers();

    expect(attemptModel.aggregate).not.toHaveBeenCalled();
    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
    expect(result.pagination.hasNextPage).toBe(false);
    expect(result.pagination.hasPrevPage).toBe(false);
  });

  it('defaults testsAttendedCount to 0 when the user has no attempts', async () => {
    const user = learnerDoc({ id: 'u1', _id: 'u1' });
    userModel.find.mockReturnValue(chain([user]));
    userModel.countDocuments.mockReturnValue(chain(1));
    attemptModel.aggregate.mockReturnValue(chain([]));

    const result = await service.listAppUsers();
    expect(result.data[0].testsAttendedCount).toBe(0);
  });

  it('skips the attempts query when every row was an admin leak', async () => {
    const admin = learnerDoc({ role: UserRole.ADMIN, id: 'a1', _id: 'a1' });
    userModel.find.mockReturnValue(chain([admin]));
    userModel.countDocuments.mockReturnValue(chain(1));

    const result = await service.listAppUsers();

    expect(attemptModel.aggregate).not.toHaveBeenCalled();
    expect(result.data).toEqual([]);
  });

  it('clamps invalid page and limit values', async () => {
    userModel.find.mockReturnValue(chain([]));
    userModel.countDocuments.mockReturnValue(chain(0));

    await service.listAppUsers(-3, 500);

    const findChain = userModel.find.mock.results[0].value;
    expect(findChain.skip).toHaveBeenCalledWith(0);
    expect(findChain.limit).toHaveBeenCalledWith(100);
  });

  it('passes search into the learner-only filter', async () => {
    userModel.find.mockReturnValue(chain([]));
    userModel.countDocuments.mockReturnValue(chain(0));

    await service.listAppUsers(1, 12, 'anita');

    const filter = userModel.find.mock.calls[0][0];
    expect(filter.role).toBe(UserRole.USER);
    expect(filter.$or).toBeDefined();
  });

  it('omits targetExam when it is not populated', async () => {
    const user = learnerDoc({
      targetExam: new Types.ObjectId('507f1f77bcf86cd799439011'),
    });
    userModel.find.mockReturnValue(chain([user]));
    userModel.countDocuments.mockReturnValue(chain(1));
    attemptModel.aggregate.mockReturnValue(chain([]));

    const result = await service.listAppUsers();
    expect(result.data[0].targetExam).toBeUndefined();
  });

  it('uses exam._id when the populated exam has no virtual id', async () => {
    const user = learnerDoc({
      targetExam: { _id: 'exam2', name: 'SSC' },
    });
    userModel.find.mockReturnValue(chain([user]));
    userModel.countDocuments.mockReturnValue(chain(1));
    attemptModel.aggregate.mockReturnValue(chain([]));

    const result = await service.listAppUsers();
    expect(result.data[0].targetExam).toEqual({ id: 'exam2', name: 'SSC' });
  });

  it('drops a populated exam that has a name but no id', async () => {
    const user = learnerDoc({
      targetExam: { name: 'Orphan exam' },
    });
    userModel.find.mockReturnValue(chain([user]));
    userModel.countDocuments.mockReturnValue(chain(1));
    attemptModel.aggregate.mockReturnValue(chain([]));

    const result = await service.listAppUsers();
    expect(result.data[0].targetExam).toBeUndefined();
  });

  it('defaults subscription and treats missing isActive as true', async () => {
    const user = learnerDoc({
      isActive: undefined,
      subscription: undefined,
      phoneNumber: undefined,
      avatarUrl: undefined,
      badgesEarnedCount: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    });
    user.toObject.mockReturnValue({
      id: 'u1',
      name: 'Pat',
      email: 'pat@example.com',
      role: UserRole.USER,
    });
    userModel.find.mockReturnValue(chain([user]));
    userModel.countDocuments.mockReturnValue(chain(1));
    attemptModel.aggregate.mockReturnValue(chain([]));

    const result = await service.listAppUsers();
    expect(result.data[0].isActive).toBe(true);
    expect(result.data[0].subscription).toEqual({
      plan: SubscriptionPlan.FREE,
      status: SubscriptionStatus.ACTIVE,
    });
    expect(result.data[0].badgesEarnedCount).toBe(0);
    expect(result.data[0].createdAt).toEqual(new Date(0));
  });

  it('maps isActive false and never returns a negative attempt count', async () => {
    const user = learnerDoc({ id: 'u1', _id: 'u1', isActive: false });
    userModel.find.mockReturnValue(chain([user]));
    userModel.countDocuments.mockReturnValue(chain(1));
    attemptModel.aggregate.mockReturnValue(chain([{ _id: 'u1', count: -2 }]));

    const result = await service.listAppUsers();
    expect(result.data[0].isActive).toBe(false);
    expect(result.data[0].testsAttendedCount).toBe(0);
  });

  it('drops a document whose toObject reports an admin role', async () => {
    const user = learnerDoc({ role: UserRole.USER });
    user.toObject.mockReturnValue({
      id: 'u1',
      name: 'Sneaky',
      role: UserRole.ADMIN,
    });
    userModel.find.mockReturnValue(chain([user]));
    userModel.countDocuments.mockReturnValue(chain(1));
    attemptModel.aggregate.mockReturnValue(chain([]));

    const result = await service.listAppUsers();
    expect(result.data).toEqual([]);
  });

  it('uses the document _id when toObject omits id', async () => {
    const user = learnerDoc({ _id: 'fallback-id' });
    user.toObject.mockReturnValue({
      name: 'No Id',
      email: 'noid@example.com',
      role: UserRole.USER,
    });
    userModel.find.mockReturnValue(chain([user]));
    userModel.countDocuments.mockReturnValue(chain(1));
    attemptModel.aggregate.mockReturnValue(chain([]));

    const result = await service.listAppUsers();
    expect(result.data[0].id).toBe('fallback-id');
    expect(result.data[0].name).toBe('No Id');
  });

  it('groups attempt counts by the attempt.user field', async () => {
    const user = learnerDoc({ id: 'u1', _id: 'u1' });
    userModel.find.mockReturnValue(chain([user]));
    userModel.countDocuments.mockReturnValue(chain(1));
    attemptModel.aggregate.mockReturnValue(chain([{ _id: 'u1', count: 3 }]));

    await service.listAppUsers();

    expect(attemptModel.aggregate).toHaveBeenCalledWith([
      { $match: { user: { $in: ['u1'] } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]);
  });

  it('refuses to map an admin document even if toListItem is called directly', () => {
    const admin = learnerDoc({ role: UserRole.ADMIN, name: 'Root' });
    expect((service as any).toListItem(admin, 9)).toBeNull();
  });

  it('falls back to empty name and email when those fields are missing', async () => {
    const user = learnerDoc({ _id: 'u1' });
    user.toObject.mockReturnValue({
      role: UserRole.USER,
    });
    userModel.find.mockReturnValue(chain([user]));
    userModel.countDocuments.mockReturnValue(chain(1));
    attemptModel.aggregate.mockReturnValue(chain([]));

    const result = await service.listAppUsers();
    expect(result.data[0].name).toBe('');
    expect(result.data[0].email).toBe('');
  });

  it('never serializes a full email or phone number on the list payload', async () => {
    const user = learnerDoc({
      email: 'anita.sharma@gmail.com',
      phoneNumber: '+919876543210',
    });
    userModel.find.mockReturnValue(chain([user]));
    userModel.countDocuments.mockReturnValue(chain(1));
    attemptModel.aggregate.mockReturnValue(chain([]));

    const result = await service.listAppUsers(1, 12, 'anita.sharma@gmail.com');
    const payload = JSON.stringify(result.data);

    expect(result.data[0].email).toBe('a***@gmail.com');
    expect(result.data[0].phoneNumber).toBe('+91**********');
    expect(payload).not.toContain('anita.sharma@gmail.com');
    expect(payload).not.toContain('anita.sharma');
    expect(payload).not.toContain('+919876543210');
    expect(payload).not.toContain('9876543210');
    expect(payload).toContain('gmail.com');
  });
});
