import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Query, Types } from 'mongoose';
import { UserRole } from '../../common/enums/user-role.enum';
import { Gender } from '../../common/enums/gender.enum';
import { MembershipTier } from '../../common/enums/membership-tier.enum';
import { SubscriptionPlan } from '../../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { StudyTimePreference } from '../../common/enums/study-time-preference.enum';

export type UserDocument = User & Document;

// ─── Embedded sub-schemas (declared as plain classes; _id suppressed) ─────────

@Schema({ _id: false })
export class UserLocation {
  @Prop({ trim: true })
  city?: string;

  @Prop({ trim: true })
  state?: string;

  @Prop({ trim: true })
  country?: string;

  /** IANA timezone string, e.g. "Asia/Kolkata" */
  @Prop({ trim: true })
  timezone?: string;
}
export const UserLocationSchema = SchemaFactory.createForClass(UserLocation);

@Schema({ _id: false })
export class UserSubscription {
  @Prop({
    type: String,
    enum: SubscriptionPlan,
    default: SubscriptionPlan.FREE,
  })
  plan: SubscriptionPlan;

  @Prop({
    type: String,
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Prop()
  startedAt?: Date;

  @Prop()
  expiresAt?: Date;

  @Prop()
  trialEndsAt?: Date;

  @Prop({ default: false })
  autoRenew: boolean;
}
export const UserSubscriptionSchema =
  SchemaFactory.createForClass(UserSubscription);

@Schema({ _id: false })
export class NotificationPreferences {
  @Prop({ default: true })
  email: boolean;

  @Prop({ default: true })
  push: boolean;

  @Prop({ default: false })
  sms: boolean;

  @Prop({ default: true })
  studyReminders: boolean;

  @Prop({ default: true })
  weeklyReport: boolean;

  @Prop({ default: false })
  promotionalOffers: boolean;
}
export const NotificationPreferencesSchema = SchemaFactory.createForClass(
  NotificationPreferences,
);

@Schema({ _id: false })
export class UserPreferences {
  @Prop({ type: String, enum: StudyTimePreference })
  studyTime?: StudyTimePreference;

  /** Target study hours per week (1–100) */
  @Prop({ min: 1, max: 100 })
  weeklyStudyGoalHours?: number;

  @Prop({ type: NotificationPreferencesSchema, default: () => ({}) })
  notifications: NotificationPreferences;
}
export const UserPreferencesSchema =
  SchemaFactory.createForClass(UserPreferences);

@Schema({ _id: false })
export class UserInteractions {
  /** Subjects the user has expressed interest in (max 20). Used for personalisation & targeted ads. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Subject' }], default: [] })
  interestedSubjects: Types.ObjectId[];

  /** Topics the user has liked (max 50). */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Topic' }], default: [] })
  likedTopics: Types.ObjectId[];

  /** Topics the user has disliked (max 50). */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Topic' }], default: [] })
  dislikedTopics: Types.ObjectId[];

  /** Exams the user is interested in (max 10). Sparse-indexed for targeted exam campaigns. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Exam' }], default: [] })
  interestedExams: Types.ObjectId[];
}
export const UserInteractionsSchema =
  SchemaFactory.createForClass(UserInteractions);

// ─── Main User schema ──────────────────────────────────────────────────────────

@Schema({
  timestamps: true,
  versionKey: false,
})
export class User {
  // ── Core identity ────────────────────────────────────────────────────────────
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  })
  email: string;

  @Prop({
    required: true,
    match: /^[\+]?[1-9][\d]{0,15}$/,
  })
  phoneNumber: string;

  @Prop({
    type: String,
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  // ── Group 1: Extended profile ─────────────────────────────────────────────
  @Prop({ trim: true, maxlength: 500 })
  bio?: string;

  @Prop({ trim: true })
  avatarUrl?: string;

  @Prop()
  dateOfBirth?: Date;

  @Prop({ type: String, enum: Gender })
  gender?: Gender;

  @Prop({ type: UserLocationSchema })
  location?: UserLocation;

  // ── Group 2: Target exam ──────────────────────────────────────────────────
  @Prop({ type: Types.ObjectId, ref: 'Exam' })
  targetExam?: Types.ObjectId;

  @Prop()
  targetExamDate?: Date;

  // ── Group 3: Subscription summary ────────────────────────────────────────
  @Prop({ type: UserSubscriptionSchema, default: () => ({}) })
  subscription: UserSubscription;

  // ── Group 4: Achievement / gamification ──────────────────────────────────
  @Prop({
    type: String,
    enum: MembershipTier,
    default: MembershipTier.NONE,
    index: true,
  })
  membershipTier: MembershipTier;

  @Prop({ default: 0 })
  badgesEarnedCount: number;

  @Prop()
  lastTierUpdatedAt?: Date;

  // ── Group 5: Preferences ──────────────────────────────────────────────────
  @Prop({ type: UserPreferencesSchema, default: () => ({}) })
  preferences: UserPreferences;

  // ── Group 6: Interactions (personalisation & ads) ─────────────────────────
  @Prop({ type: UserInteractionsSchema, default: () => ({}) })
  interactions: UserInteractions;

  // Timestamps added automatically by mongoose (timestamps: true)
  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// ─── Indexes ───────────────────────────────────────────────────────────────────
UserSchema.index({ phoneNumber: 1 });
UserSchema.index({ isActive: 1, isDeleted: 1 });
UserSchema.index({ membershipTier: 1 });
UserSchema.index({ 'subscription.plan': 1, 'subscription.status': 1 });
UserSchema.index({ targetExam: 1 }, { sparse: true });
UserSchema.index({ 'interactions.interestedExams': 1 }, { sparse: true });

// Virtual for id field (removes _id and adds id)
UserSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Ensure virtual fields are serialised
UserSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Also set toObject to include virtuals
UserSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Pre-find middleware to handle soft delete queries
UserSchema.pre(/^find/, function (this: Query<unknown, UserDocument>) {
  // Only return non-deleted users by default
  this.where({ isDeleted: { $ne: true } });
});
