import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../common/enums/user-role.enum';

describe('UsersService', () => {
  let service: UsersService;

  const mockUserDocument = (data: any) => ({
    ...data,
    toObject: jest.fn().mockReturnValue(data),
    save: jest.fn().mockResolvedValue({
      ...data,
      toObject: jest.fn().mockReturnValue(data),
    }),
  });

  // Create a proper model mock that can work both as constructor and static methods
  const mockUserModel: any = jest.fn().mockImplementation(() => ({
    save: jest.fn(),
  }));

  // Add static methods to the mock
  mockUserModel.findOne = jest.fn();
  mockUserModel.findById = jest.fn();
  mockUserModel.findByIdAndUpdate = jest.fn();
  mockUserModel.find = jest.fn();
  mockUserModel.findOneAndUpdate = jest.fn();
  mockUserModel.deleteOne = jest.fn();
  mockUserModel.create = jest.fn();

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

    // Reset all mocks before each test
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
      const savedUser = { ...createUserDto, _id: '507f1f77bcf86cd799439011' };
      const mockDocument = mockUserDocument(savedUser);
      // Mock findOne for existing user check
      mockUserModel.findOne.mockResolvedValue(null);
      // Mock constructor and save pattern
      const mockInstance = {
        save: jest.fn().mockResolvedValue(mockDocument),
      };
      mockUserModel.mockImplementation(() => mockInstance);

      const result = await service.create(createUserDto);

      expect(result).toBeDefined();
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        $or: [
          { email: createUserDto.email },
          { phoneNumber: createUserDto.phoneNumber },
        ],
      });
    });

    it('should throw ConflictException when user already exists', async () => {
      const existingUser = { email: createUserDto.email };
      mockUserModel.findOne.mockResolvedValue(existingUser);

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findOne', () => {
    const userId = 'valid-user-id';

    it('should find user by ID successfully', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@example.com',
        phoneNumber: '+1234567890',
        role: 'user',
        isActive: true,
      };

      const mockDocument = mockUserDocument(mockUser);
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDocument),
      });

      const result = await service.findOne(userId);

      expect(result).toBeDefined();
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByPhone', () => {
    const phoneNumber = '+1234567890';

    it('should find user by phone successfully', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        phoneNumber: '+1234567890',
        role: 'user',
      };

      const mockDocument = mockUserDocument(mockUser);
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDocument),
      });

      const result = await service.findByPhone(phoneNumber);

      expect(result).toBeDefined();
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ phoneNumber });
    });

    it('should return null when user not found', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.findByPhone('non-existent-phone');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const userId = 'valid-user-id';
    const updateUserDto: UpdateUserDto = {
      name: 'Updated Name',
    };

    it('should update user successfully', async () => {
      const updatedUser = {
        _id: userId,
        name: 'Updated Name',
        email: 'john@example.com',
      };
      const mockDocument = mockUserDocument(updatedUser);
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDocument),
      });

      const result = await service.update(userId, updateUserDto);

      expect(result).toBeDefined();
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        updateUserDto,
        { new: true },
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.update('non-existent-id', updateUserDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const mockUsers = [
        { _id: '1', name: 'User 1', email: 'user1@example.com' },
        { _id: '2', name: 'User 2', email: 'user2@example.com' },
      ];

      const mockDocuments = mockUsers.map(user => mockUserDocument(user));
      mockUserModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDocuments),
      });

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(mockUserModel.find).toHaveBeenCalled();
    });
  });
});
