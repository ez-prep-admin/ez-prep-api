/**
 * Enum representing the action a user should take for a mock test
 * Based on their attempt history
 */
export enum UserAttemptAction {
  /**
   * User has never attempted this mock test before
   */
  START = 'START',

  /**
   * User has a paused or in-progress attempt for this mock test
   */
  RESUME = 'RESUME',

  /**
   * User has completed this mock test at least once
   * and the test allows retakes
   */
  RETAKE = 'RETAKE',
}
