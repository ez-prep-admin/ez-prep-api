import { Module, forwardRef } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { ExamsModule } from '../exams/exams.module';
import { MockTestsModule } from '../mock-tests/mock-tests.module';
import { AccessControlService } from './access-control.service';

@Module({
  imports: [
    forwardRef(() => EntitlementsModule),
    forwardRef(() => MockTestsModule),
    ExamsModule,
  ],
  providers: [AccessControlService],
  exports: [AccessControlService],
})
export class AccessModule {}
