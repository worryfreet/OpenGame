/**
 * UI Heavy Systems - Export index
 */
export { TurnManager } from './TurnManager';
export { DialogueManager } from './DialogueManager';
export { GameDataManager } from './GameDataManager';
export { QuizManager } from './QuizManager';
export { ComboManager } from './ComboManager';
export { CardManager } from './CardManager';
export { ChoiceManager } from './ChoiceManager';
export { DualPlayerSystem } from './DualPlayerSystem';
export { LessonProgressManager } from './LessonProgressManager';
export { HintManager } from './HintManager';
export { LearningReportManager } from './LearningReportManager';

// Types
export type { TurnManagerConfig, PhaseCallback } from './TurnManager';
export type { QuizFilter, QuizStats } from './QuizManager';
export type { ComboTier, ComboManagerConfig } from './ComboManager';
export type { EndingRule } from './GameDataManager';
export type {
  CourseProgressState,
  LearningGoalProgress,
} from './LessonProgressManager';
export type { HintUsage } from './HintManager';
export type { LearningReport } from './LearningReportManager';
export type {
  DualPlayerMode,
  DualPlayerConfig,
  DualPlayerSystemConfig,
  PlayerKeyConfig,
  RoundResult,
} from './DualPlayerSystem';
