import { FilterQuery } from 'mongoose';

/**
 * Generic MongoDB filter query type
 */
export type MongoFilterQuery<T> = FilterQuery<T>;

/**
 * Common query filter for active/deleted status
 */
export interface StatusFilterQuery {
  isActive?: boolean;
  isDeleted?: boolean | { $ne: boolean };
}

/**
 * Search query filter with text search
 */
export interface SearchFilterQuery extends StatusFilterQuery {
  $or?: Array<Record<string, { $regex: string; $options: string }>>;
  $text?: { $search: string };
}

/**
 * Category-based filter query
 */
export interface CategoryFilterQuery extends StatusFilterQuery {
  category?: unknown; // ObjectId
}

/**
 * Email/Phone validation query
 */
export interface UniqueFieldQuery {
  email?: string;
  phoneNumber?: string;
  _id?: { $ne: string };
}

/**
 * Tag filter query with subject and topic
 */
export interface TagFilterQuery extends StatusFilterQuery {
  subject?: unknown; // ObjectId
  topic?: unknown; // ObjectId
  name?: string;
  _id?: { $ne: string };
}

/**
 * Update data type for partial updates
 */
export type UpdateData<T> = Partial<T> & Record<string, unknown>;

/**
 * Populated document field type
 */
export interface PopulatedField {
  _id?: unknown;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Error validation detail
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * MongoDB error with code
 */
export interface MongoError extends Error {
  code?: number;
  keyPattern?: Record<string, number>;
  keyValue?: Record<string, unknown>;
}

/**
 * Mongoose query context for pre-find middleware
 */
export interface MongooseQueryContext {
  where(condition: Record<string, unknown>): void;
  [key: string]: unknown;
}
