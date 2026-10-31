import { Global, Module } from '@nestjs/common';
import { InstanceConfigModule } from '../instance-config/instance-config.module';
import { CommerceConfigGuard } from './commerce-config.guard';
import { CommerceConfigService } from './commerce-config.service';
import { CommerceEnabledGuard } from './commerce-enabled.guard';

@Global()
@Module({
  imports: [InstanceConfigModule],
  providers: [CommerceConfigService, CommerceConfigGuard, CommerceEnabledGuard],
  exports: [CommerceConfigService, CommerceEnabledGuard],
})
export class CommerceModule {}
