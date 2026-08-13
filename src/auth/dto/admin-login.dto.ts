import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({ example: 'sharun' })
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  username: string;

  @ApiProperty({ example: 'choose-a-long-passphrase' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
