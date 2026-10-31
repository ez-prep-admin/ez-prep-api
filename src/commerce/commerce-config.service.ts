import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INSTANCE_RUNTIME_SNAPSHOT } from '../instance-config/instance-config.constants';
import { InstanceRuntimeSnapshot } from '../instance-config/instance-runtime.snapshot';
import {
  CommerceSettings,
  commerceSettingsSource,
  parseCommerceSettings,
} from './commerce-config';

@Injectable()
export class CommerceConfigService {
  readonly settings: CommerceSettings;

  constructor(
    configService: ConfigService,
    @Inject(INSTANCE_RUNTIME_SNAPSHOT)
    runtime?: InstanceRuntimeSnapshot,
  ) {
    this.settings = parseCommerceSettings(
      commerceSettingsSource(
        { get: key => configService.get<string>(key) },
        runtime,
      ),
    );
  }
}
