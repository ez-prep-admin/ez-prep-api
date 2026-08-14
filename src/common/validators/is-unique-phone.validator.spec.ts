import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ValidationArguments } from 'class-validator';
import { User } from '../../users/schemas/user.schema';
import {
  IsUniquePhone,
  IsUniquePhoneConstraint,
} from './is-unique-phone.validator';

describe('IsUniquePhoneConstraint', () => {
  let constraint: IsUniquePhoneConstraint;
  const exec = jest.fn();
  const findOne = jest.fn(() => ({ exec }));

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IsUniquePhoneConstraint,
        { provide: getModelToken(User.name), useValue: { findOne } },
      ],
    }).compile();

    constraint = module.get(IsUniquePhoneConstraint);
    jest.clearAllMocks();
    findOne.mockReturnValue({ exec });
  });

  it('should allow empty phone numbers', async () => {
    await expect(
      constraint.validate('', { object: {} } as ValidationArguments),
    ).resolves.toBe(true);
  });

  it('should normalize digits and return true when unused', async () => {
    exec.mockResolvedValue(null);

    await expect(
      constraint.validate('+1 (234) 567-8900', {
        object: {},
      } as ValidationArguments),
    ).resolves.toBe(true);

    expect(findOne).toHaveBeenCalledWith({ phoneNumber: '12345678900' });
  });

  it('should exclude current user by id', async () => {
    exec.mockResolvedValue(null);

    await expect(
      constraint.validate('999', {
        object: { id: 'u1' },
      } as ValidationArguments),
    ).resolves.toBe(true);

    expect(findOne).toHaveBeenCalledWith({
      phoneNumber: '999',
      _id: { $ne: 'u1' },
    });
  });

  it('should return false when phone exists', async () => {
    exec.mockResolvedValue({ _id: 'other' });

    await expect(
      constraint.validate('555', {
        object: { _id: 'u2' },
      } as ValidationArguments),
    ).resolves.toBe(false);
  });

  it('should provide a default message', () => {
    expect(
      constraint.defaultMessage({ value: '+1' } as ValidationArguments),
    ).toContain("Phone number '+1' is already registered");
  });

  it('should register the decorator', () => {
    class Sample {
      @IsUniquePhone()
      phone: string;
    }
    expect(new Sample()).toBeDefined();
  });
});
