import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { SearchService } from './search.service';
import { Category } from '../categories/schemas/category.schema';
import { Exam } from '../exams/schemas/exam.schema';

function chainable(resolved: unknown) {
  const query: any = {};
  ['populate', 'sort', 'skip', 'limit', 'lean', 'select', 'session'].forEach(
    m => {
      query[m] = jest.fn().mockReturnValue(query);
    },
  );
  query.exec = jest.fn().mockResolvedValue(resolved);
  return query;
}

describe('SearchService', () => {
  let service: SearchService;
  const categoryModel: any = { find: jest.fn() };
  const examModel: any = { find: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: getModelToken(Category.name), useValue: categoryModel },
        { provide: getModelToken(Exam.name), useValue: examModel },
      ],
    }).compile();

    service = module.get(SearchService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should search categories and exams and map ids from id field', async () => {
    const catId = '507f1f77bcf86cd799439011';
    const examId = '507f1f77bcf86cd799439012';
    const categoryId = '507f1f77bcf86cd799439013';
    const groupId = '507f1f77bcf86cd799439014';

    categoryModel.find.mockReturnValue(
      chainable([
        {
          id: catId,
          name: 'SSC',
          shortName: 'SSC',
          imageUrl: 'https://img',
          description: 'Staff',
        },
      ]),
    );
    examModel.find.mockReturnValue(
      chainable([
        {
          id: examId,
          name: 'SSC CGL',
          description: 'Tier 1',
          duration: 60,
          totalQuestions: 100,
          totalMarks: 200,
          category: {
            id: categoryId,
            name: 'SSC',
            shortName: 'SSC',
          },
          examGroup: {
            id: groupId,
            name: 'CGL',
            shortName: 'CGL',
          },
        },
      ]),
    );

    const result = await service.search('SSC', 10);

    expect(result.categories[0].id).toBe(catId);
    expect(result.exams[0].id).toBe(examId);
    expect(result.exams[0].category.id).toBe(categoryId);
    expect(result.exams[0].examGroup.id).toBe(groupId);
    expect(categoryModel.find).toHaveBeenCalled();
    expect(examModel.find).toHaveBeenCalled();
  });

  it('should fall back to _id when id is missing and clamp limit', async () => {
    categoryModel.find.mockReturnValue(
      chainable([{ _id: { toString: () => 'cat1' }, name: 'A', shortName: 'A' }]),
    );
    examModel.find.mockReturnValue(
      chainable([
        {
          _id: { toString: () => 'exam1' },
          name: 'Exam',
          category: { _id: { toString: () => 'c1' }, name: 'C', shortName: 'C' },
          examGroup: { _id: { toString: () => 'g1' }, name: 'G' },
        },
      ]),
    );

    const result = await service.search('  SS.C  ', 99);

    expect(result.categories[0].id).toBe('cat1');
    expect(result.exams[0].id).toBe('exam1');
    expect(result.exams[0].examGroup.shortName).toBeUndefined();
    const examQuery = examModel.find.mock.results[0].value;
    expect(examQuery.limit).toHaveBeenCalledWith(20);
  });

  it('should clamp limit to at least 1', async () => {
    categoryModel.find.mockReturnValue(chainable([]));
    examModel.find.mockReturnValue(chainable([]));

    await service.search('x', 0);

    const catQuery = categoryModel.find.mock.results[0].value;
    expect(catQuery.limit).toHaveBeenCalledWith(1);
  });
});
