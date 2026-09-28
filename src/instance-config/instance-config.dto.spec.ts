import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateInstanceConfigDto } from './dto/create-instance-config.dto';
import { UpdateInstanceConfigDto } from './dto/update-instance-config.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

async function parse<T>(
  metatype: new () => T,
  body: Record<string, unknown>,
): Promise<T> {
  return pipe.transform(body, {
    type: 'body',
    metatype,
  }) as Promise<T>;
}

async function rejection(
  metatype: new () => object,
  body: Record<string, unknown>,
) {
  try {
    await parse(metatype, body);
  } catch (error) {
    return error;
  }
  throw new Error('expected validation to fail');
}

describe('instance config DTOs', () => {
  it('trims the name and keeps a valid logo', async () => {
    const dto = await parse(CreateInstanceConfigDto, {
      name: '  EZ Prep  ',
      logoUrl: ' https://cdn.example.com/logo.png ',
    });
    expect(dto).toEqual({
      name: 'EZ Prep',
      logoUrl: 'https://cdn.example.com/logo.png',
    });
  });

  it('treats a blank logo as null on create', async () => {
    const dto = await parse(CreateInstanceConfigDto, {
      name: 'ExamFlex',
      logoUrl: '   ',
    });
    expect(dto.logoUrl).toBeNull();
  });

  it('rejects a non-http logo', async () => {
    const error = await rejection(CreateInstanceConfigDto, {
      name: 'EZ Prep',
      logoUrl: 'javascript:alert(1)',
    });
    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown fields so new settings are added explicitly', async () => {
    const error = await rejection(CreateInstanceConfigDto, {
      name: 'EZ Prep',
      features: { leaderboard: true },
    });
    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('rejects a blank name', async () => {
    const error = await rejection(CreateInstanceConfigDto, { name: '   ' });
    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('lets an update clear the favicon with null', async () => {
    const dto = await parse(UpdateInstanceConfigDto, { faviconUrl: null });
    expect(dto).toEqual({ faviconUrl: null });
  });

  it('lets an update clear the logo with an empty string', async () => {
    const dto = await parse(UpdateInstanceConfigDto, { logoUrl: '' });
    expect(dto.logoUrl).toBeNull();
  });

  it('rejects an invalid favicon on update', async () => {
    const error = await rejection(UpdateInstanceConfigDto, {
      faviconUrl: 'not a url',
    });
    expect(error).toBeInstanceOf(BadRequestException);
  });
});
