import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UploadQuestionPdfDto } from './upload-question-pdf.dto';

const SUBJECT_ID = '507f1f77bcf86cd799439011';
const TOPIC_ID = '507f1f77bcf86cd799439012';
const EXAM_ID = '507f1f77bcf86cd799439013';
const TAG_ID = '507f1f77bcf86cd799439016';

function toDto(body: Record<string, unknown>) {
  return plainToInstance(UploadQuestionPdfDto, body);
}

async function errorsFor(body: Record<string, unknown>) {
  return validate(toDto(body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('UploadQuestionPdfDto', () => {
  const base = {
    subjectId: SUBJECT_ID,
    topicId: TOPIC_ID,
    examIds: EXAM_ID,
  };

  it('accepts an upload with no tags', async () => {
    const dto = toDto(base);
    expect(await errorsFor(base)).toHaveLength(0);
    expect(dto.tagIds).toBeUndefined();
    expect(dto.examIds).toEqual([EXAM_ID]);
  });

  it('accepts a single multipart tag id and a tag id list', async () => {
    const single = toDto({ ...base, tagIds: TAG_ID });
    expect(await errorsFor({ ...base, tagIds: TAG_ID })).toHaveLength(0);
    expect(single.tagIds).toEqual([TAG_ID]);

    const many = toDto({ ...base, tagIds: [TAG_ID, SUBJECT_ID] });
    expect(many.tagIds).toEqual([TAG_ID, SUBJECT_ID]);
  });

  it('rejects an unknown field', async () => {
    const errors = await errorsFor({ ...base, unexpected: 'x' });
    expect(errors.map(error => error.property)).toContain('unexpected');
  });
});
