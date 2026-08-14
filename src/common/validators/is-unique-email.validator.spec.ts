import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ValidationArguments } from 'class-validator';
import { User } from '../../users/schemas/user.schema';
import {
  IsUniqueEmail,
  IsUniqueEmailConstraint,
} from './is-unique-email.validator';

describe('IsUniqueEmailConstraint', () => {
  let constraint: IsUniqueEmailConstraint;
  const exec = jest.fn();
  const findOne = jest.fn(() => ({ exec }));

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IsUniqueEmailConstraint,
        { provide: getModelToken(User.name), useValue: { findOne } },
      ],
    }).compile();

    constraint = module.get(IsUniqueEmailConstraint);
    jest.clearAllMocks();
    findOne.mockReturnValue({ exec });
  });

  it('should allow empty email', async () => {
    await expect(
      constraint.validate('', { object: {} } as ValidationArguments),
    ).resolves.toBe(true);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('should return true when email is unused', async () => {
    exec.mockResolvedValue(null);

    await expect(
      constraint.validate('Ada@Example.com', {
        object: {},
      } as ValidationArguments),
    ).resolves.toBe(true);

    expect(findOne).toHaveBeenCalledWith({ email: 'ada@example.com' });
  });

  it('should exclude current user id when present', async () => {
    exec.mockResolvedValue(null);

    await expect(
      constraint.validate('a@b.com', {
        object: { id: 'user-1' },
      } as ValidationArguments),
    ).resolves.toBe(true);

    expect(findOne).toHaveBeenCalledWith({
      email: 'a@b.com',
      _id: { $ne: 'user-1' },
    });
  });

  it('should use _id when id is missing', async () => {
    exec.mockResolvedValue({ _id: 'other' });

    await expect(
      constraint.validate('a@b.com', {
        object: { _id: 'user-2' },
      } as ValidationArguments),
    ).resolves.toBe(false);
  });

  it('should provide a default message', () => {
    expect(
      constraint.defaultMessage({ value: 'a@b.com' } as ValidationArguments),
    ).toContain("Email 'a@b.com' is already registered");
  });

  it('should register the decorator', () => {
    class Sample {
      @IsUniqueEmail()
      email: string;
    }
    expect(new Sample()).toBeDefined();
  });
});
