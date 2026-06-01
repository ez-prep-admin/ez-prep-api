import { Module } from '@nestjs/common';
import { AdminQuestionsModule } from '../questions/admin/questions.module';
import { AdminAuthModule } from './auth/admin-auth.module';

@Module({
  imports: [AdminQuestionsModule, AdminAuthModule],
})
export class AdminModule {}
