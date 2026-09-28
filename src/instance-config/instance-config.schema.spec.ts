import { INSTANCE_CONFIG_ID } from './instance-config.constants';
import { InstanceConfigSchema } from './schemas/instance-config.schema';

describe('InstanceConfigSchema', () => {
  it('keeps a single string id per deployment database', () => {
    const id = InstanceConfigSchema.path('_id');
    expect(id.instance).toBe('String');
    expect(id.options.default).toBe(INSTANCE_CONFIG_ID);
    expect(InstanceConfigSchema.get('collection')).toBe('instance_configs');
  });
});
