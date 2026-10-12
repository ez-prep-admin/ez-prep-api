import { Global, Module } from '@nestjs/common';
import { CommerceConfigGuard } from './commerce-config.guard';
import { CommerceConfigService } from './commerce-config.service';
import { CommerceEnabledGuard } from './commerce-enabled.guard';

@Global()
@Module({
  providers: [CommerceConfigService, CommerceConfigGuard, CommerceEnabledGuard],
  exports: [CommerceConfigService, CommerceEnabledGuard],
})
export class CommerceModule {}
