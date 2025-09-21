import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

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
        throw new ConflictException('User with this email or phone number already exists');
      }

      const createdUser = new this.userModel(createUserDto);
      const savedUser = await createdUser.save();
      
      return new UserResponseDto(savedUser.toObject());
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('User with this email or phone number already exists');
      }
      throw error;
    }
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userModel.find().exec();
    return users.map(user => new UserResponseDto(user.toObject()));
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return new UserResponseDto(user.toObject());
  }

  async findByEmail(email: string): Promise<UserResponseDto | null> {
    const user = await this.userModel.findOne({ email }).exec();
    return user ? new UserResponseDto(user.toObject()) : null;
  }

  async findByRole(role: UserRole): Promise<UserResponseDto[]> {
    const users = await this.userModel.find({ role }).exec();
    return users.map(user => new UserResponseDto(user.toObject()));
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    // Check if email or phone is being updated and already exists
    if (updateUserDto.email || updateUserDto.phoneNumber) {
      const existingUser = await this.userModel.findOne({
        _id: { $ne: id },
        $or: [
          ...(updateUserDto.email ? [{ email: updateUserDto.email }] : []),
          ...(updateUserDto.phoneNumber ? [{ phoneNumber: updateUserDto.phoneNumber }] : []),
        ],
      });

      if (existingUser) {
        throw new ConflictException('User with this email or phone number already exists');
      }
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return new UserResponseDto(updatedUser.toObject());
  }

  async softDelete(id: string): Promise<UserResponseDto> {
    const deletedUser = await this.userModel
      .findByIdAndUpdate(id, { isDeleted: true, isActive: false }, { new: true })
      .exec();

    if (!deletedUser) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return new UserResponseDto(deletedUser.toObject());
  }

  async restore(id: string): Promise<UserResponseDto> {
    // Use findOneAndUpdate to bypass the soft delete middleware
    const restoredUser = await this.userModel
      .findOneAndUpdate(
        { _id: id, isDeleted: true },
        { isDeleted: false, isActive: true },
        { new: true }
      )
      .exec();

    if (!restoredUser) {
      throw new NotFoundException(`Deleted user with ID "${id}" not found`);
    }

    return new UserResponseDto(restoredUser.toObject());
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
    return users.map(user => new UserResponseDto(user.toObject()));
  }

  async toggleUserStatus(id: string): Promise<UserResponseDto> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    user.isActive = !user.isActive;
    const updatedUser = await user.save();

    return new UserResponseDto(updatedUser.toObject());
  }

  async getUserStats() {
    const [totalUsers, activeUsers, adminUsers, deletedUsers] = await Promise.all([
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
}
