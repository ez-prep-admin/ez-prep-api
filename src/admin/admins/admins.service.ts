import { Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { CreateAdminDto } from '../auth/dto/create-admin.dto';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { hashPassword } from '../../common/utils/password.util';

@Injectable()
export class AdminsService {
  constructor(private readonly usersService: UsersService) {}

  async create(createAdminDto: CreateAdminDto): Promise<UserResponseDto> {
    const passwordHash = await hashPassword(createAdminDto.password);

    return this.usersService.createAdmin({
      name: createAdminDto.name,
      email: createAdminDto.email,
      phoneNumber: createAdminDto.phoneNumber,
      passwordHash,
    });
  }
}
