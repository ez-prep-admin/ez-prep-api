import {
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  ValidateNested,
  IsMongoId,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StudyTimePreference } from '../../common/enums/study-time-preference.enum';

export class NotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'Email notifications', example: true })
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @ApiPropertyOptional({ description: 'Push notifications', example: true })
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @ApiPropertyOptional({ description: 'SMS notifications', example: false })
  @IsOptional()
  @IsBoolean()
  sms?: boolean;

  @ApiPropertyOptional({
    description: 'Study reminder notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  studyReminders?: boolean;

  @ApiPropertyOptional({
    description: 'Weekly progress report emails',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  weeklyReport?: boolean;

  @ApiPropertyOptional({
    description: 'Promotional and offer emails',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  promotionalOffers?: boolean;
}

export class InteractionsDto {
  @ApiPropertyOptional({
    description: 'Subject IDs the user is interested in (max 20)',
    type: [String],
    example: ['64f1a...', '64f1b...'],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @ArrayMaxSize(20)
  interestedSubjects?: string[];

  @ApiPropertyOptional({
    description: 'Topic IDs the user has liked (max 50)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @ArrayMaxSize(50)
  likedTopics?: string[];

  @ApiPropertyOptional({
    description: 'Topic IDs the user has disliked (max 50)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @ArrayMaxSize(50)
  dislikedTopics?: string[];

  @ApiPropertyOptional({
    description: 'Exam IDs the user is interested in (max 10)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @ArrayMaxSize(10)
  interestedExams?: string[];
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    description: 'Preferred time of day for studying',
    enum: StudyTimePreference,
    example: StudyTimePreference.MORNING,
  })
  @IsOptional()
  @IsEnum(StudyTimePreference)
  studyTime?: StudyTimePreference;

  @ApiPropertyOptional({
    description: 'Weekly study goal in hours (1–100)',
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  weeklyStudyGoalHours?: number;

  @ApiPropertyOptional({
    description: 'Notification preferences',
    type: NotificationPreferencesDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notifications?: NotificationPreferencesDto;

  @ApiPropertyOptional({
    description: 'User interaction signals (interests, likes, dislikes)',
    type: InteractionsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => InteractionsDto)
  interactions?: InteractionsDto;
}
