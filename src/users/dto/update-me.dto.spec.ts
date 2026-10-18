import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateMeDto } from './update-me.dto';

describe('UpdateMeDto feedback', () => {
  it('accepts ratings from 0 to 5 and a text note', async () => {
    const dto = plainToInstance(UpdateMeDto, {
      feedback: {
        text: '  Smoother navigation please  ',
        userInterface: 5,
        questions: 0,
        fullMockTests: 3,
        topicWisePractice: 4,
        easeOfUse: 5,
      },
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.feedback?.text).toBe('Smoother navigation please');
  });

  it('rejects a rating above 5', async () => {
    const dto = plainToInstance(UpdateMeDto, {
      feedback: { easeOfUse: 6 },
    });
    const errors = await validate(dto);
    const feedbackError = errors.find(error => error.property === 'feedback');

    expect(feedbackError?.children?.[0]?.property).toBe('easeOfUse');
  });
});
