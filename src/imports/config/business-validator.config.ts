export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface BusinessValidatorConfig {
  name: string;
  optionCount: number;
  optionLabels: string[];
  allowedDifficultyLevels: DifficultyLevel[];
  requireExplanation: boolean;
}

export const NEET_BUSINESS_VALIDATOR_CONFIG: BusinessValidatorConfig = {
  name: 'neet',
  optionCount: 4,
  optionLabels: ['a', 'b', 'c', 'd'],
  allowedDifficultyLevels: ['easy', 'medium', 'hard'],
  requireExplanation: true,
};
