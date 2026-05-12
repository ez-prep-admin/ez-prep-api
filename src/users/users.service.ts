import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { MembershipTier } from '../common/enums/membership-tier.enum';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    try {
      // Check if user already exists
      const existingUser = await this.userModel.findOne({
        $or: [
          { email: createUserDto.email },
          { phoneNumber: createUserDto.phoneNumber },
        ],
      });

      if (existingUser) {
        throw new ConflictException(
          'User with this email or phone number already exists',
        );
      }

      const createdUser = new this.userModel(createUserDto);
      const savedUser = await createdUser.save();

      return this.toResponseDto(savedUser);
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException(
          'User with this email or phone number already exists',
        );
      }
      throw error;
    }
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userModel.find().exec();
    return users.map(user => this.toResponseDto(user));
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.userModel
      .findById(id)
      .populate('targetExam', 'name')
      .exec();
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return this.toResponseDto(user);
  }

  async findByEmail(email: string): Promise<UserResponseDto | null> {
    const user = await this.userModel.findOne({ email }).exec();
    return user ? this.toResponseDto(user) : null;
  }

  async findByPhone(phoneNumber: string): Promise<UserResponseDto | null> {
    const user = await this.userModel.findOne({ phoneNumber }).exec();
    return user ? this.toResponseDto(user) : null;
  }

  async findByRole(role: UserRole): Promise<UserResponseDto[]> {
    const users = await this.userModel.find({ role }).exec();
    return users.map(user => this.toResponseDto(user));
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    // Check if email or phone is being updated and already exists
    if (updateUserDto.email || updateUserDto.phoneNumber) {
      const existingUser = await this.userModel.findOne({
        _id: { $ne: id },
        $or: [
          ...(updateUserDto.email ? [{ email: updateUserDto.email }] : []),
          ...(updateUserDto.phoneNumber
            ? [{ phoneNumber: updateUserDto.phoneNumber }]
            : []),
        ],
      });

      if (existingUser) {
        throw new ConflictException(
          'User with this email or phone number already exists',
        );
      }
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return this.toResponseDto(updatedUser);
  }

  async softDelete(id: string): Promise<UserResponseDto> {
    const deletedUser = await this.userModel
      .findByIdAndUpdate(
        id,
        { isDeleted: true, isActive: false },
        { new: true },
      )
      .exec();

    if (!deletedUser) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return this.toResponseDto(deletedUser);
  }

  async restore(id: string): Promise<UserResponseDto> {
    // Use findOneAndUpdate to bypass the soft delete middleware
    const restoredUser = await this.userModel
      .findOneAndUpdate(
        { _id: id, isDeleted: true },
        { isDeleted: false, isActive: true },
        { new: true },
      )
      .exec();

    if (!restoredUser) {
      throw new NotFoundException(`Deleted user with ID "${id}" not found`);
    }

    return this.toResponseDto(restoredUser);
  }

  async hardDelete(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
  }

  // Admin-specific methods
  async findAllWithDeleted(): Promise<UserResponseDto[]> {
    const users = await this.userModel.find({}).exec();
    return users.map(user => this.toResponseDto(user));
  }

  async toggleUserStatus(id: string): Promise<UserResponseDto> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    user.isActive = !user.isActive;
    const updatedUser = await user.save();

    return this.toResponseDto(updatedUser);
  }

  async getUserStats() {
    const [totalUsers, activeUsers, adminUsers, deletedUsers] =
      await Promise.all([
        this.userModel.countDocuments({}),
        this.userModel.countDocuments({ isActive: true }),
        this.userModel.countDocuments({ role: UserRole.ADMIN }),
        this.userModel.countDocuments({ isDeleted: true }),
      ]);

    return {
      totalUsers,
      activeUsers,
      adminUsers,
      deletedUsers,
      inactiveUsers: totalUsers - activeUsers,
    };
  }

  // ── Extended profile ──────────────────────────────────────────────────────

  /**
   * Single-call update for the authenticated user's own profile.
   * Handles both core identity fields (name, email, phone) and extended
   * profile fields (bio, avatar, location, target exam, etc.) in one DB write.
   */
  async updateMe(id: string, dto: UpdateMeDto): Promise<UserResponseDto> {
    // Uniqueness check for email / phone (exclude the caller's own document)
    if (dto.email || dto.phoneNumber) {
      const conflict = await this.userModel.findOne({
        _id: { $ne: id },
        $or: [
          ...(dto.email ? [{ email: dto.email }] : []),
          ...(dto.phoneNumber ? [{ phoneNumber: dto.phoneNumber }] : []),
        ],
      });
      if (conflict) {
        throw new ConflictException(
          'Another account already uses this email or phone number',
        );
      }
    }

    const $set: Record<string, unknown> = {};

    // Core identity
    if (dto.name !== undefined) $set.name = dto.name;
    if (dto.email !== undefined) $set.email = dto.email;
    if (dto.phoneNumber !== undefined) $set.phoneNumber = dto.phoneNumber;

    // Extended profile
    if (dto.bio !== undefined) $set.bio = dto.bio;
    if (dto.avatarUrl !== undefined) $set.avatarUrl = dto.avatarUrl;
    if (dto.dateOfBirth !== undefined)
      $set.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.gender !== undefined) $set.gender = dto.gender;
    if (dto.location !== undefined) $set.location = dto.location;
    if (dto.targetExam !== undefined)
      $set.targetExam = new Types.ObjectId(dto.targetExam);
    if (dto.targetExamDate !== undefined)
      $set.targetExamDate = new Date(dto.targetExamDate);

    const user = await this.userModel
      .findByIdAndUpdate(new Types.ObjectId(id), { $set }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return this.toResponseDto(user);
  }

  async updateProfile(
    id: string,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const update: FilterQuery<UserDocument> = {};

    if (dto.bio !== undefined) update.bio = dto.bio;
    if (dto.avatarUrl !== undefined) update.avatarUrl = dto.avatarUrl;
    if (dto.dateOfBirth !== undefined)
      update.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.gender !== undefined) update.gender = dto.gender;
    if (dto.location !== undefined) update.location = dto.location;
    if (dto.targetExam !== undefined) {
      update.targetExam = new Types.ObjectId(dto.targetExam);
    }
    if (dto.targetExamDate !== undefined) {
      update.targetExamDate = new Date(dto.targetExamDate);
    }

    const user = await this.userModel
      .findByIdAndUpdate(
        new Types.ObjectId(id),
        { $set: update },
        { new: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return this.toResponseDto(user);
  }

  // ── Preferences & interactions ────────────────────────────────────────────

  async updatePreferences(
    id: string,
    dto: UpdatePreferencesDto,
  ): Promise<UserResponseDto> {
    // Build a flat $set map so we only touch the provided nested keys
    const $set: Record<string, unknown> = {};

    if (dto.studyTime !== undefined)
      $set['preferences.studyTime'] = dto.studyTime;
    if (dto.weeklyStudyGoalHours !== undefined) {
      $set['preferences.weeklyStudyGoalHours'] = dto.weeklyStudyGoalHours;
    }

    if (dto.notifications) {
      const n = dto.notifications;
      if (n.email !== undefined)
        $set['preferences.notifications.email'] = n.email;
      if (n.push !== undefined) $set['preferences.notifications.push'] = n.push;
      if (n.sms !== undefined) $set['preferences.notifications.sms'] = n.sms;
      if (n.studyReminders !== undefined) {
        $set['preferences.notifications.studyReminders'] = n.studyReminders;
      }
      if (n.weeklyReport !== undefined) {
        $set['preferences.notifications.weeklyReport'] = n.weeklyReport;
      }
      if (n.promotionalOffers !== undefined) {
        $set['preferences.notifications.promotionalOffers'] =
          n.promotionalOffers;
      }
    }

    if (dto.interactions) {
      const i = dto.interactions;
      if (i.interestedSubjects !== undefined) {
        $set['interactions.interestedSubjects'] = i.interestedSubjects.map(
          s => new Types.ObjectId(s),
        );
      }
      if (i.likedTopics !== undefined) {
        $set['interactions.likedTopics'] = i.likedTopics.map(
          t => new Types.ObjectId(t),
        );
      }
      if (i.dislikedTopics !== undefined) {
        $set['interactions.dislikedTopics'] = i.dislikedTopics.map(
          t => new Types.ObjectId(t),
        );
      }
      if (i.interestedExams !== undefined) {
        $set['interactions.interestedExams'] = i.interestedExams.map(
          e => new Types.ObjectId(e),
        );
      }
    }

    const user = await this.userModel
      .findByIdAndUpdate(new Types.ObjectId(id), { $set }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return this.toResponseDto(user);
  }

  // ── Subscription (admin-internal) ─────────────────────────────────────────

  async updateSubscription(
    id: string,
    dto: UpdateSubscriptionDto,
  ): Promise<UserResponseDto> {
    const $set: Record<string, unknown> = {};

    if (dto.plan !== undefined) $set['subscription.plan'] = dto.plan;
    if (dto.status !== undefined) $set['subscription.status'] = dto.status;
    if (dto.autoRenew !== undefined)
      $set['subscription.autoRenew'] = dto.autoRenew;
    if (dto.startedAt !== undefined)
      $set['subscription.startedAt'] = new Date(dto.startedAt);
    if (dto.expiresAt !== undefined)
      $set['subscription.expiresAt'] = new Date(dto.expiresAt);
    if (dto.trialEndsAt !== undefined) {
      $set['subscription.trialEndsAt'] = new Date(dto.trialEndsAt);
    }

    const user = await this.userModel
      .findByIdAndUpdate(new Types.ObjectId(id), { $set }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return this.toResponseDto(user);
  }

  // ── Membership tier (fire-and-forget from analytics) ─────────────────────

  /**
   * Silently updates the membership tier and badge count.
   * Designed to be called fire-and-forget; never throws externally.
   */
  async updateMembershipTier(
    id: string,
    tier: MembershipTier,
    earnedCount: number,
  ): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: new Types.ObjectId(id) },
        {
          $set: {
            membershipTier: tier,
            badgesEarnedCount: earnedCount,
            lastTierUpdatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private toResponseDto(user: UserDocument): UserResponseDto {
    const obj = user.toObject() as Record<string, unknown>;

    // Map targetExam: if populated (has name), extract id + name; otherwise omit
    if (obj.targetExam != null) {
      const exam = obj.targetExam as Record<string, unknown>;
      if (typeof exam === 'object' && 'name' in exam && exam.name) {
        // Note: Use exam.id (virtual field), not exam._id (deleted by schema transform)
        obj.targetExam = {
          id: String(exam.id),
          name: exam.name,
        };
      } else {
        // Not populated or orphaned reference — omit the field
        delete obj.targetExam;
      }
    }

    // Stringify ObjectId arrays in interactions
    const interactions = obj.interactions as
      | Record<string, unknown[]>
      | undefined;
    if (interactions) {
      for (const key of [
        'interestedSubjects',
        'likedTopics',
        'dislikedTopics',
        'interestedExams',
      ] as const) {
        if (Array.isArray(interactions[key])) {
          interactions[key] = interactions[key].map(String);
        }
      }
    }

    // Compute remaining days to target exam date (not persisted)
    if (obj.targetExamDate instanceof Date) {
      const now = new Date();
      const diff = (obj.targetExamDate as Date).getTime() - now.getTime();
      obj.targetExamRemainingDays = Math.max(0, Math.ceil(diff / 86_400_000));
    }

    return new UserResponseDto(obj);
  }
}
