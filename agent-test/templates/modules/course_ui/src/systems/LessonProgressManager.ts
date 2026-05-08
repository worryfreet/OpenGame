import type {
  CourseAssessmentItem,
  CourseContent,
  CourseInteraction,
  CourseLessonUnit,
} from '../courseContent';

export type CourseProgressState = 'not_started' | 'in_progress' | 'completed';

export interface LearningGoalProgress {
  goalId: string;
  state: CourseProgressState;
  completedUnitIds: string[];
  completedInteractionIds: string[];
  completedAssessmentIds: string[];
  correctAssessmentIds: string[];
}

export class LessonProgressManager {
  private progressByGoal = new Map<string, LearningGoalProgress>();

  constructor(private readonly content: CourseContent) {
    for (const goal of content.learningGoals) {
      this.progressByGoal.set(goal.id, {
        goalId: goal.id,
        state: 'not_started',
        completedUnitIds: [],
        completedInteractionIds: [],
        completedAssessmentIds: [],
        correctAssessmentIds: [],
      });
    }
  }

  startGoal(goalId: string): void {
    const progress = this.requireProgress(goalId);
    if (progress.state === 'not_started') {
      progress.state = 'in_progress';
    }
  }

  completeLessonUnit(unit: CourseLessonUnit | string): void {
    const unitId = typeof unit === 'string' ? unit : unit.id;
    const lessonUnit = this.content.lessonUnits.find(
      (item) => item.id === unitId,
    );
    if (!lessonUnit) return;
    const progress = this.requireProgress(lessonUnit.goalId);
    progress.state = 'in_progress';
    this.addUnique(progress.completedUnitIds, lessonUnit.id);
    this.updateGoalState(lessonUnit.goalId);
  }

  completeInteraction(interaction: CourseInteraction | string): void {
    const interactionId =
      typeof interaction === 'string' ? interaction : interaction.id;
    const courseInteraction = this.content.interactions.find(
      (item) => item.id === interactionId,
    );
    if (!courseInteraction) return;
    const progress = this.requireProgress(courseInteraction.goalId);
    progress.state = 'in_progress';
    this.addUnique(progress.completedInteractionIds, courseInteraction.id);
    this.updateGoalState(courseInteraction.goalId);
  }

  completeAssessment(
    assessment: CourseAssessmentItem | string,
    correct: boolean,
  ): void {
    const assessmentId =
      typeof assessment === 'string' ? assessment : assessment.id;
    const assessmentItem = this.content.assessments.find(
      (item) => item.id === assessmentId,
    );
    if (!assessmentItem) return;
    const progress = this.requireProgress(assessmentItem.goalId);
    progress.state = 'in_progress';
    this.addUnique(progress.completedAssessmentIds, assessmentItem.id);
    if (correct) {
      this.addUnique(progress.correctAssessmentIds, assessmentItem.id);
    }
    this.updateGoalState(assessmentItem.goalId);
  }

  getGoalProgress(goalId: string): LearningGoalProgress | undefined {
    const progress = this.progressByGoal.get(goalId);
    return progress ? this.cloneProgress(progress) : undefined;
  }

  getAllProgress(): LearningGoalProgress[] {
    return Array.from(this.progressByGoal.values()).map((progress) =>
      this.cloneProgress(progress),
    );
  }

  getCompletedGoalCount(): number {
    return this.getAllProgress().filter(
      (progress) => progress.state === 'completed',
    ).length;
  }

  private updateGoalState(goalId: string): void {
    const progress = this.requireProgress(goalId);
    const requiredUnitIds = this.content.lessonUnits
      .filter((unit) => unit.goalId === goalId)
      .map((unit) => unit.id);
    const requiredInteractionIds = this.content.interactions
      .filter((interaction) => interaction.goalId === goalId)
      .map((interaction) => interaction.id);
    const requiredAssessmentIds = this.content.assessments
      .filter((assessment) => assessment.goalId === goalId)
      .map((assessment) => assessment.id);

    const completed =
      this.includesAll(progress.completedUnitIds, requiredUnitIds) &&
      this.includesAll(
        progress.completedInteractionIds,
        requiredInteractionIds,
      ) &&
      this.includesAll(progress.completedAssessmentIds, requiredAssessmentIds);

    progress.state = completed ? 'completed' : 'in_progress';
  }

  private requireProgress(goalId: string): LearningGoalProgress {
    const progress = this.progressByGoal.get(goalId);
    if (!progress) {
      throw new Error(`Unknown learning goal: ${goalId}`);
    }
    return progress;
  }

  private addUnique(target: string[], value: string): void {
    if (!target.includes(value)) {
      target.push(value);
    }
  }

  private includesAll(actual: string[], expected: string[]): boolean {
    return expected.every((item) => actual.includes(item));
  }

  private cloneProgress(progress: LearningGoalProgress): LearningGoalProgress {
    return {
      ...progress,
      completedUnitIds: [...progress.completedUnitIds],
      completedInteractionIds: [...progress.completedInteractionIds],
      completedAssessmentIds: [...progress.completedAssessmentIds],
      correctAssessmentIds: [...progress.correctAssessmentIds],
    };
  }
}
