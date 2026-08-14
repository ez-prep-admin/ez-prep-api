import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  const searchService = { search: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: searchService }],
    }).compile();

    controller = module.get(SearchController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return search results with meta', async () => {
    const data = {
      categories: [{ id: '1', name: 'SSC', shortName: 'SSC' }],
      exams: [{ id: '2', name: 'CGL' }],
    };
    searchService.search.mockResolvedValue(data);

    const result = await controller.search({ q: 'SSC', limit: 5 });

    expect(searchService.search).toHaveBeenCalledWith('SSC', 5);
    expect(result.message).toBe('Search results for "SSC"');
    expect(result.data).toEqual(data);
    expect(result.meta).toEqual({
      query: 'SSC',
      categoriesCount: 1,
      examsCount: 1,
    });
  });

  it('should default limit to 10', async () => {
    searchService.search.mockResolvedValue({ categories: [], exams: [] });

    await controller.search({ q: 'NEET' });

    expect(searchService.search).toHaveBeenCalledWith('NEET', 10);
  });
});
