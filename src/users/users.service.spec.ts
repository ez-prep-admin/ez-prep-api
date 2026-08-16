import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../common/enums/user-role.enum';
import { MembershipTier } from '../common/enums/membership-tier.enum';
import { Gender } from '../common/enums/gender.enum';
import { StudyTimePreference } from '../common/enums/study-time-preference.enum';
import { SubscriptionPlan } from '../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../common/enums/subscription-status.enum';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

const OID = '507f1f77bcf86cd799439011';

function chain(result: unknown) {
  const q: any = {
    exec: jest.fn().mockResolvedValue(result),
    populate: jest.fn(),
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    lean: jest.fn(),
    select: jest.fn(),
  };
  q.populate.mockReturnValue(q);
  q.sort.mockReturnValue(q);
  q.skip.mockReturnValue(q);
  q.limit.mockReturnValue(q);
  q.lean.mockReturnValue(q);
  q.select.mockReturnValue(q);
  q.then = (resolve: any, reject: any) =>
    Promise.resolve(result).then(resolve, reject);
  return q;
}

describe('UsersService', () => {
  let service: UsersService;

  const mockUserDocument = (data: any) => ({
    ...data,
    _id: data._id || OID,
    toObject: jest.fn().mockReturnValue({ ...data, id: data.id || OID }),
    save: jest.fn().mockResolvedValue({
      ...data,
      toObject: jest.fn().mockReturnValue({ ...data, id: data.id || OID }),
    }),
  });

  const mockUserModel: any = jest.fn().mockImplementation(() => ({
    save: jest.fn(),
  }));

  mockUserModel.findOne = jest.fn();
  mockUserModel.findById = jest.fn();
  mockUserModel.findByIdAndUpdate = jest.fn();
  mockUserModel.findByIdAndDelete = jest.fn();
  mockUserModel.find = jest.fn();
  mockUserModel.findOneAndUpdate = jest.fn();
  mockUserModel.deleteOne = jest.fn();
  mockUserModel.create = jest.fn();
  mockUserModel.countDocuments = jest.fn();
  mockUserModel.updateOne = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      name: 'John Doe',
      email: 'john@example.com',
      phoneNumber: '+1234567890',
      role: UserRole.USER,
    };

    it('should create a user successfully', async () => {
      const savedUser = { ...createUserDto, _id: OID, id: OID };
      const mockDocument = mockUserDocument(savedUser);
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(mockDocument),
      }));

      const result = await service.create(createUserDto);

      expect(result).toBeDefined();
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        $or: [
          { email: createUserDto.email },
          { phoneNumber: createUserDto.phoneNumber },
        ],
      });
    });

    it('should throw BadRequestException when creating an admin via this method', async () => {
      await expect(
        service.create({ ...createUserDto, role: UserRole.ADMIN }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when user already exists', async () => {
      mockUserModel.findOne.mockResolvedValue({ email: createUserDto.email });

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException on duplicate key error', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue({ code: 11000 }),
      }));

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findOne', () => {
    it('should find user by ID successfully', async () => {
      const mockDocument = mockUserDocument({
        _id: OID,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        isActive: true,
      });
      mockUserModel.findById.mockReturnValue(chain(mockDocument));

      const result = await service.findOne(OID);

      expect(result).toBeDefined();
      expect(mockUserModel.findById).toHaveBeenCalledWith(OID);
    });

    it('should map populated targetExam and remaining days', async () => {
      const future = new Date(Date.now() + 3 * 86_400_000);
      const mockDocument = mockUserDocument({
        _id: OID,
        name: 'John',
        email: 'j@example.com',
        targetExam: { id: OID, name: 'SSC CGL' },
        targetExamDate: future,
        interactions: {
          interestedSubjects: [OID],
          likedTopics: [OID],
          dislikedTopics: [],
          interestedExams: [OID],
        },
      });
      mockUserModel.findById.mockReturnValue(chain(mockDocument));

      const result = await service.findOne(OID);
      expect(result.targetExam).toEqual({ id: OID, name: 'SSC CGL' });
      expect(result.targetExamRemainingDays).toBeGreaterThanOrEqual(2);
    });

    it('should omit unpopulated targetExam', async () => {
      const mockDocument = mockUserDocument({
        _id: OID,
        name: 'John',
        email: 'j@example.com',
        targetExam: OID,
      });
      mockUserModel.findById.mockReturnValue(chain(mockDocument));

      const result = await service.findOne(OID);
      expect(result.targetExam).toBeUndefined();
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserModel.findById.mockReturnValue(chain(null));

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should return a user when found', async () => {
      mockUserModel.findOne.mockReturnValue(
        chain(mockUserDocument({ email: 'a@b.com', name: 'A' })),
      );
      const result = await service.findByEmail('a@b.com');
      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockUserModel.findOne.mockReturnValue(chain(null));
      await expect(service.findByEmail('x@y.com')).resolves.toBeNull();
    });
  });

  describe('findByPhone', () => {
    it('should find user by phone successfully', async () => {
      mockUserModel.findOne.mockReturnValue(
        chain(mockUserDocument({ phoneNumber: '+1234567890', name: 'John' })),
      );
      const result = await service.findByPhone('+1234567890');
      expect(result).toBeDefined();
    });

    it('should return null when user not found', async () => {
      mockUserModel.findOne.mockReturnValue(chain(null));
      await expect(service.findByPhone('missing')).resolves.toBeNull();
    });
  });

  describe('countPasswordAdmins', () => {
    it('should count admins with password hashes', async () => {
      mockUserModel.countDocuments.mockReturnValue(chain(2));
      await expect(service.countPasswordAdmins()).resolves.toBe(2);
    });
  });

  describe('findByUsernameForAuth', () => {
    it('should query lowercase username with passwordHash selected', async () => {
      mockUserModel.findOne.mockReturnValue(chain({ username: 'admin' }));
      await service.findByUsernameForAuth('  Admin ');
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ username: 'admin' });
    });
  });

  describe('createAdmin', () => {
    it('should create an admin', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue(
        mockUserDocument({
          name: 'Admin',
          email: 'admin@admin.ezprep.local',
          username: 'admin',
          role: UserRole.ADMIN,
        }),
      );

      const result = await service.createAdmin({
        name: 'Admin',
        username: 'Admin',
        password: 'secret12',
      } as any);

      expect(result).toBeDefined();
      expect(mockUserModel.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when username exists', async () => {
      mockUserModel.findOne.mockResolvedValue({ username: 'admin' });
      await expect(
        service.createAdmin({
          name: 'Admin',
          username: 'admin',
          password: 'secret12',
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException on duplicate key', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockRejectedValue({ code: 11000 });
      await expect(
        service.createAdmin({
          name: 'Admin',
          username: 'admin',
          email: 'a@b.com',
          password: 'secret12',
        } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findByRole', () => {
    it('should return users for a role', async () => {
      mockUserModel.find.mockReturnValue(
        chain([mockUserDocument({ name: 'A', role: UserRole.USER })]),
      );
      const result = await service.findByRole(UserRole.USER);
      expect(result).toHaveLength(1);
    });
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = { name: 'Updated Name' };

    it('should update user successfully', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue(
        chain(mockUserDocument({ _id: OID, name: 'Updated Name' })),
      );
      const result = await service.update(OID, updateUserDto);
      expect(result).toBeDefined();
    });

    it('should throw ConflictException when email already exists', async () => {
      mockUserModel.findOne.mockResolvedValue({ email: 'taken@example.com' });
      await expect(
        service.update(OID, { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue(chain(null));
      await expect(service.update('missing', updateUserDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('softDelete', () => {
    it('should soft delete a user', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue(
        chain(mockUserDocument({ isDeleted: true })),
      );
      await expect(service.softDelete(OID)).resolves.toBeDefined();
    });

    it('should throw NotFoundException', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue(chain(null));
      await expect(service.softDelete('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('restore', () => {
    it('should restore a deleted user', async () => {
      mockUserModel.findOneAndUpdate.mockReturnValue(
        chain(mockUserDocument({ isDeleted: false })),
      );
      await expect(service.restore(OID)).resolves.toBeDefined();
    });

    it('should throw NotFoundException', async () => {
      mockUserModel.findOneAndUpdate.mockReturnValue(chain(null));
      await expect(service.restore('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete a user', async () => {
      mockUserModel.findByIdAndDelete.mockReturnValue(chain({ _id: OID }));
      await expect(service.hardDelete(OID)).resolves.toBeUndefined();
    });

    it('should throw NotFoundException', async () => {
      mockUserModel.findByIdAndDelete.mockReturnValue(chain(null));
      await expect(service.hardDelete('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      mockUserModel.find.mockReturnValue(
        chain([
          mockUserDocument({ name: 'User 1' }),
          mockUserDocument({ name: 'User 2' }),
        ]),
      );
      const result = await service.findAll();
      expect(result).toHaveLength(2);
    });
  });

  describe('findAllWithDeleted', () => {
    it('should return all users including deleted', async () => {
      mockUserModel.find.mockReturnValue(
        chain([mockUserDocument({ name: 'User 1' })]),
      );
      const result = await service.findAllWithDeleted();
      expect(result).toHaveLength(1);
    });
  });

  describe('toggleUserStatus', () => {
    it('should toggle isActive', async () => {
      const user = mockUserDocument({ isActive: true, name: 'John' });
      user.save = jest
        .fn()
        .mockResolvedValue(mockUserDocument({ isActive: false, name: 'John' }));
      mockUserModel.findById.mockResolvedValue(user);
      const result = await service.toggleUserStatus(OID);
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException', async () => {
      mockUserModel.findById.mockResolvedValue(null);
      await expect(service.toggleUserStatus('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserStats', () => {
    it('should return aggregated stats', async () => {
      mockUserModel.countDocuments
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      const stats = await service.getUserStats();
      expect(stats).toEqual({
        totalUsers: 10,
        activeUsers: 7,
        adminUsers: 2,
        deletedUsers: 1,
        inactiveUsers: 3,
      });
    });
  });

  describe('updateMe', () => {
    it('should update profile fields', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.findByIdAndUpdate.mockReturnValue(
        chain(
          mockUserDocument({
            name: 'New',
            email: 'n@e.com',
            bio: 'hi',
            gender: Gender.MALE,
          }),
        ),
      );

      const result = await service.updateMe(OID, {
        name: 'New',
        email: 'n@e.com',
        phoneNumber: '+111',
        bio: 'hi',
        avatarUrl: 'http://a',
        dateOfBirth: '2000-01-01',
        gender: Gender.MALE,
        location: { city: 'Kochi' },
        targetExam: OID,
        targetExamDate: '2027-01-01',
      } as any);

      expect(result).toBeDefined();
    });

    it('should throw ConflictException', async () => {
      mockUserModel.findOne.mockResolvedValue({ _id: 'other' });
      await expect(
        service.updateMe(OID, { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue(chain(null));
      await expect(service.updateMe(OID, { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update extended profile', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue(
        chain(mockUserDocument({ bio: 'updated' })),
      );
      await expect(
        service.updateProfile(OID, {
          bio: 'updated',
          avatarUrl: 'http://a',
          dateOfBirth: '2000-01-01',
          gender: Gender.FEMALE,
          location: { city: 'Delhi' },
          targetExam: OID,
          targetExamDate: '2027-01-01',
        } as any),
      ).resolves.toBeDefined();
    });

    it('should throw NotFoundException', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue(chain(null));
      await expect(service.updateProfile(OID, { bio: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences and interactions', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue(
        chain(mockUserDocument({ name: 'John' })),
      );
      await expect(
        service.updatePreferences(OID, {
          studyTime: StudyTimePreference.MORNING,
          weeklyStudyGoalHours: 10,
          notifications: {
            email: true,
            push: false,
            sms: false,
            studyReminders: true,
            weeklyReport: true,
            promotionalOffers: false,
          },
          interactions: {
            interestedSubjects: [OID],
            likedTopics: [OID],
            dislikedTopics: [OID],
            interestedExams: [OID],
          },
        } as any),
      ).resolves.toBeDefined();
    });

    it('should throw NotFoundException', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue(chain(null));
      await expect(
        service.updatePreferences(OID, {
          studyTime: StudyTimePreference.NIGHT,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription fields', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue(
        chain(mockUserDocument({ name: 'John' })),
      );
      await expect(
        service.updateSubscription(OID, {
          plan: SubscriptionPlan.PREMIUM,
          status: SubscriptionStatus.ACTIVE,
          autoRenew: true,
          startedAt: '2026-01-01',
          expiresAt: '2027-01-01',
          trialEndsAt: '2026-02-01',
        } as any),
      ).resolves.toBeDefined();
    });

    it('should throw NotFoundException', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue(chain(null));
      await expect(
        service.updateSubscription(OID, { plan: SubscriptionPlan.FREE }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMembershipTier', () => {
    it('should update membership silently', async () => {
      mockUserModel.updateOne.mockReturnValue(chain({ acknowledged: true }));
      await expect(
        service.updateMembershipTier(OID, MembershipTier.GOLD, 5),
      ).resolves.toBeUndefined();
    });
  });
});
