import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { UserRole } from '../../common/enums/user-role.enum';
import { hashPassword } from '../../common/utils/password.util';

@Injectable()
export class AdminSeedService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.configService.get<string>('ADMIN_SEED_EMAIL');
    const password = this.configService.get<string>('ADMIN_SEED_PASSWORD');

    if (!email || !password) {
      this.logger.log(
        'Admin seed skipped: ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD not set',
      );
      return;
    }

    const existingAdmin = await this.userModel.findOne({
      email: email.toLowerCase(),
      role: UserRole.ADMIN,
    });

    if (existingAdmin) {
      this.logger.log(`Admin seed skipped: admin already exists for ${email}`);
      return;
    }

    const name =
      this.configService.get<string>('ADMIN_SEED_NAME') || 'Super Admin';
    const phoneNumber =
      this.configService.get<string>('ADMIN_SEED_PHONE') || '+10000000000';

    const passwordHash = await hashPassword(password);

    await this.userModel.create({
      name,
      email: email.toLowerCase(),
      phoneNumber,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    });

    this.logger.log(`Admin seed complete: created admin for ${email}`);
  }
}
