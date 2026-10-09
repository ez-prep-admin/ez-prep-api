import { Test, TestingModule } from '@nestjs/testing';
import { IndianStatesController } from './indian-states.controller';

describe('IndianStatesController', () => {
  let controller: IndianStatesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IndianStatesController],
    }).compile();
    controller = module.get(IndianStatesController);
  });

  it('returns GST codes including Kerala and Karnataka', () => {
    const result = controller.list();
    expect(result.data).toEqual(
      expect.arrayContaining([
        { code: '32', name: 'Kerala' },
        { code: '29', name: 'Karnataka' },
      ]),
    );
    expect(result.data.every(row => row.code && row.name)).toBe(true);
  });
});
