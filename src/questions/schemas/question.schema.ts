import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Query } from 'mongoose';

export type QuestionDocument = Question & Document;

@Schema({ _id: false })
export class ImageMetadata {
  @Prop({ type: String, required: true })
  key: string;

  @Prop({ type: String, required: true })
  bucket: string;

  @Prop({ type: String, required: true })
  region: string;

  @Prop({ type: String })
  contentType?: string;

  @Prop({ type: Number })
  size?: number;

  @Prop({ type: Date })
  lastModified?: Date;

  @Prop({ type: String })
  url?: string;
}

export const ImageMetadataSchema = SchemaFactory.createForClass(ImageMetadata);

@Schema({ _id: false })
export class QuestionTextLanguage {
  @Prop({ type: String })
  text?: string;

  @Prop({ type: ImageMetadataSchema })
  image?: ImageMetadata;
}

export const QuestionTextLanguageSchema =
  SchemaFactory.createForClass(QuestionTextLanguage);

@Schema({ _id: false })
export class QuestionText {
  @Prop({ type: QuestionTextLanguageSchema })
  en: QuestionTextLanguage;

  @Prop({ type: QuestionTextLanguageSchema })
  ml: QuestionTextLanguage;
}

export const QuestionTextSchema = SchemaFactory.createForClass(QuestionText);

@Schema({ _id: false })
export class QuestionOption {
  @Prop({ type: String })
  id: string;

  @Prop({ type: String, enum: ['text', 'image'] })
  type: string;

  @Prop({ type: String })
  en?: string | null;

  @Prop({ type: String })
  ml?: string | null;

  @Prop({ type: ImageMetadataSchema })
  image?: ImageMetadata;
}

export const QuestionOptionSchema =
  SchemaFactory.createForClass(QuestionOption);

@Schema({ _id: false })
export class Explanation {
  @Prop({ type: String })
  en?: string;

  @Prop({ type: String })
  ml?: string;

  @Prop({ type: ImageMetadataSchema })
  image?: ImageMetadata;
}

export const ExplanationSchema = SchemaFactory.createForClass(Explanation);

@Schema({
  collection: 'questions',
  timestamps: true,
  versionKey: false,
})
export class Question {
  @Prop({ type: QuestionTextSchema, required: true })
  questionText: QuestionText;

  @Prop({ type: String, enum: ['text', 'image'], default: 'text' })
  optionType?: string;

  @Prop({ type: [QuestionOptionSchema], required: true })
  options: QuestionOption[];

  @Prop({ type: ExplanationSchema })
  explanation?: Explanation;

  @Prop({ type: String, required: true })
  correctAnswer: string;

  @Prop({ type: Types.ObjectId, ref: 'Subject', index: true })
  subject?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Topic', index: true })
  topic?: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Exam' }] })
  exams?: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Tag' })
  tag?: Types.ObjectId;

  @Prop({ type: String, enum: ['easy', 'medium', 'hard'] })
  difficultyLevel?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);

QuestionSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

QuestionSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

QuestionSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

QuestionSchema.pre(/^find/, function (this: Query<unknown, QuestionDocument>) {
  this.where({ isDeleted: { $ne: true } });
});
