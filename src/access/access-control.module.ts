import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { ExamsModule } from '../exams/exams.module';
import { MockTestsModule } from '../mock-tests/mock-tests.module';
import { AccessControlService } from './access-control.service';

@Module({
  imports: [EntitlementsModule, MockTestsModule, ExamsModule],
  providers: [AccessControlService],
  exports: [AccessControlService],
})
export class AccessModule {}
