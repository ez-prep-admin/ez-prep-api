import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InstanceConfigResponseDto {
  @ApiProperty({ example: 'singleton' })
  id: string;

  @ApiProperty({
    description:
      'Stored shape version. Clients can ignore it until it changes.',
    example: 1,
  })
  schemaVersion: number;

  @ApiProperty({ example: 'EZ Prep' })
  name: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/logo.png',
    nullable: true,
  })
  logoUrl: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/favicon.png',
    nullable: true,
  })
  faviconUrl: string | null;

  @ApiProperty({ example: '2026-09-28T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-28T00:00:00.000Z' })
  updatedAt: Date;

  constructor(partial: Partial<InstanceConfigResponseDto>) {
    Object.assign(this, partial);
  }
}
