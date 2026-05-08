import courseContentJson from './courseContent.json';

export type CourseArchetype = 'course_ui' | 'course_grid' | 'course_td';
export type CourseDepthLevel = 'intro' | 'standard' | 'deep' | 'challenge';

export interface CourseLearningGoal {
  id: string;
  text: string;
  masteryEvidence: string[];
}

export interface CourseLessonUnit {
  id: string;
  goalId: string;
  sceneKey: string;
  concept: string;
  script: string;
  workedExample: string;
  misconceptions: string[];
  interactionIds: string[];
  assessmentItemIds: string[];
}

export interface CourseInteraction {
  id: string;
  goalId: string;
  sceneKey: string;
  type: string;
  prompt: string;
  successFeedback: string;
  failureFeedback: string;
}

export interface CourseAssessmentItem {
  id: string;
  goalId: string;
  sceneKey: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  misconceptionTag: string;
  hint: string;
}

export interface NarrationSegment {
  id: string;
  targetScene: string;
  text: string;
  audio_uri?: string;
  fallbackSubtitle: string;
}

export interface VideoTransition {
  key: string;
  targetScene: string;
  description: string;
  optional: true;
  skipLabel: string;
}

export interface PlayletNode {
  id: string;
  playletId: string;
  goalIds: string[];
  config: Record<string, unknown>;
  styleBindingId: string;
  enterTransition?: string;
  exitTransition?: string;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  when: 'success' | 'fail' | 'partial' | 'always';
}

export interface CourseWorkflow {
  startNodeId: string;
  nodes: PlayletNode[];
  edges: WorkflowEdge[];
  recoveryPolicy: 'retry_same' | 'hint_then_retry' | 'remediate_then_return';
}

export interface StyleBible {
  theme: string;
  palette: string[];
  characterDirection: string;
  uiTokens: Record<string, string>;
  motionMood: string;
  audioMood: string;
  forbiddenElements: string[];
}

export interface CourseContent {
  course: {
    id: string;
    title: string;
    subject: string;
    topic: string;
    grade: number;
    archetype: CourseArchetype;
    depthLevel: CourseDepthLevel;
    durationMinutes: number;
  };
  learningGoals: CourseLearningGoal[];
  lessonUnits: CourseLessonUnit[];
  interactions: CourseInteraction[];
  assessments: CourseAssessmentItem[];
  narration: { segments: NarrationSegment[] };
  videoTransitions: VideoTransition[];
  workflow?: CourseWorkflow;
  styleBible?: StyleBible;
  report: { masteryEvidence: string[]; metrics: string[] };
  templateRules: {
    allowedUse: string;
    requiresFeedback: boolean;
    reviewOnly: boolean;
  };
}

export const courseContent = courseContentJson as CourseContent;

export function getLessonUnitsForGoal(goalId: string): CourseLessonUnit[] {
  return courseContent.lessonUnits.filter((unit) => unit.goalId === goalId);
}

export function getInteractionsForGoal(goalId: string): CourseInteraction[] {
  return courseContent.interactions.filter(
    (interaction) => interaction.goalId === goalId,
  );
}

export function getAssessmentsForGoal(goalId: string): CourseAssessmentItem[] {
  return courseContent.assessments.filter((item) => item.goalId === goalId);
}

export function getNarrationForScene(sceneKey: string): NarrationSegment[] {
  return courseContent.narration.segments.filter(
    (segment) => segment.targetScene === sceneKey,
  );
}

export function getVideoTransitionForScene(
  sceneKey: string,
): VideoTransition | undefined {
  return courseContent.videoTransitions.find(
    (transition) => transition.targetScene === sceneKey,
  );
}
