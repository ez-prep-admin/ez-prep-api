import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommerceSettings, parseCommerceSettings } from './commerce-config';

@Injectable()
export class CommerceConfigService {
  readonly settings: CommerceSettings;

  constructor(configService: ConfigService) {
    this.settings = parseCommerceSettings({
      get: key => configService.get<string>(key),
    });
  }
}
