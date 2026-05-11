/** Static badge definitions — evaluated against user metrics at runtime */

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  category: 'Milestone' | 'Consistency' | 'Performance' | 'Mastery';
  criteria: string;
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  {
    id: 'first-test',
    name: 'First Test',
    description: 'Complete your first mock test',
    category: 'Milestone',
    criteria: 'Complete 1 test',
  },
  {
    id: 'streak-7',
    name: '7-Day Streak',
    description: 'Maintain a 7-day consecutive activity streak',
    category: 'Consistency',
    criteria: 'Achieve a 7-day consecutive test attempt streak',
  },
  {
    id: 'streak-30',
    name: '30-Day Streak',
    description: 'Maintain a 30-day consecutive activity streak',
    category: 'Consistency',
    criteria: 'Achieve a 30-day consecutive test attempt streak',
  },
  {
    id: 'tests-10',
    name: 'Dedicated Learner',
    description: 'Complete 10 mock tests',
    category: 'Milestone',
    criteria: 'Complete 10 tests',
  },
  {
    id: 'tests-50',
    name: 'Exam Warrior',
    description: 'Complete 50 mock tests',
    category: 'Milestone',
    criteria: 'Complete 50 tests',
  },
  {
    id: 'top-scorer',
    name: 'Top Scorer',
    description: 'Score 90% or above on any single test',
    category: 'Performance',
    criteria: 'Score 90%+ on any test',
  },
  {
    id: 'perfect-score',
    name: 'Perfect Score',
    description: 'Achieve a perfect 100% score on any test',
    category: 'Performance',
    criteria: 'Score 100% on any test',
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    description:
      'Complete a test in under 50% of the allotted time with 70%+ score',
    category: 'Performance',
    criteria: 'Finish a test in under half the time with 70%+ score',
  },
  {
    id: 'accuracy-master',
    name: 'Accuracy Master',
    description: 'Maintain 80%+ overall accuracy across 10+ completed tests',
    category: 'Consistency',
    criteria: '80%+ accuracy with at least 10 completed tests',
  },
  {
    id: 'subject-expert',
    name: 'Subject Expert',
    description: 'Score 85%+ average in any subject with at least 5 attempts',
    category: 'Mastery',
    criteria: '85%+ average in any subject with 5+ attempts',
  },
];
