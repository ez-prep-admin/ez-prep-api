import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateFeedbackDto } from './create-feedback.dto';

describe('CreateFeedbackDto', () => {
  it('trims text and accepts ratings from 1 to 5', async () => {
    const dto = plainToInstance(CreateFeedbackDto, {
      text: '  Smoother navigation please  ',
      userInterface: 5,
      questions: 1,
      fullMockTests: 3,
      topicWisePractice: 4,
      easeOfUse: 5,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.text).toBe('Smoother navigation please');
  });

  it('treats a blank note as omitted', async () => {
    const dto = plainToInstance(CreateFeedbackDto, {
      text: '   ',
      easeOfUse: 4,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.text).toBeUndefined();
  });

  it('rejects a rating above 5', async () => {
    const dto = plainToInstance(CreateFeedbackDto, { easeOfUse: 6 });
    const errors = await validate(dto);

    expect(errors.map(error => error.property)).toContain('easeOfUse');
  });

  it('rejects a rating of 0', async () => {
    const dto = plainToInstance(CreateFeedbackDto, { questions: 0 });
    const errors = await validate(dto);

    expect(errors.map(error => error.property)).toContain('questions');
  });
});
