import type { CourseContent } from '../courseContent';
import type { HintUsage } from './HintManager';
import type { LearningGoalProgress } from './LessonProgressManager';

export interface LearningReport {
  courseId: string;
  title: string;
  completedGoals: number;
  totalGoals: number;
  accuracy: number;
  hintUsageCount: number;
  weakGoalIds: string[];
  masteryEvidence: string[];
}

export class LearningReportManager {
  constructor(private readonly content: CourseContent) {}

  buildReport(
    progressList: LearningGoalProgress[],
    hintUsage: HintUsage[],
  ): LearningReport {
    const totalAnswers = progressList.reduce(
      (sum, progress) => sum + progress.completedAssessmentIds.length,
      0,
    );
    const correctAnswers = progressList.reduce(
      (sum, progress) => sum + progress.correctAssessmentIds.length,
      0,
    );
    const completedGoals = progressList.filter(
      (progress) => progress.state === 'completed',
    ).length;

    return {
      courseId: this.content.course.id,
      title: this.content.course.title,
      completedGoals,
      totalGoals: this.content.learningGoals.length,
      accuracy: totalAnswers > 0 ? correctAnswers / totalAnswers : 0,
      hintUsageCount: hintUsage.length,
      weakGoalIds: this.findWeakGoalIds(progressList),
      masteryEvidence: [...this.content.report.masteryEvidence],
    };
  }

  private findWeakGoalIds(progressList: LearningGoalProgress[]): string[] {
    return progressList
      .filter((progress) => {
        if (progress.state !== 'completed') return true;
        if (progress.completedAssessmentIds.length === 0) return true;
        return (
          progress.correctAssessmentIds.length <
          progress.completedAssessmentIds.length
        );
      })
      .map((progress) => progress.goalId);
  }
}
