import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { ROLES_KEY, Roles } from './roles.decorator';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    SetMetadata: jest.fn((...args: unknown[]) => actual.SetMetadata(...args)),
  };
});

describe('Roles', () => {
  it('should expose the metadata key', () => {
    expect(ROLES_KEY).toBe('roles');
  });

  it('should set roles metadata', () => {
    Roles(UserRole.ADMIN, UserRole.USER);
    expect(SetMetadata).toHaveBeenCalledWith(ROLES_KEY, [
      UserRole.ADMIN,
      UserRole.USER,
    ]);
  });
});
