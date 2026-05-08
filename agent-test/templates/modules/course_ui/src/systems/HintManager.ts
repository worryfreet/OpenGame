import type { CourseAssessmentItem, CourseContent } from '../courseContent';

export interface HintUsage {
  assessmentId: string;
  misconceptionTag: string;
  hint: string;
  usedAt: number;
}

export class HintManager {
  private readonly usage: HintUsage[] = [];

  constructor(private readonly content: CourseContent) {}

  getHintForAssessment(assessment: CourseAssessmentItem | string): string {
    const assessmentId =
      typeof assessment === 'string' ? assessment : assessment.id;
    const item = this.content.assessments.find(
      (candidate) => candidate.id === assessmentId,
    );
    if (!item) {
      return '先回到题目，找出它对应的学习目标。';
    }
    const usage: HintUsage = {
      assessmentId: item.id,
      misconceptionTag: item.misconceptionTag,
      hint: item.hint,
      usedAt: Date.now(),
    };
    this.usage.push(usage);
    return item.hint;
  }

  getFailureFeedback(assessment: CourseAssessmentItem | string): string {
    const assessmentId =
      typeof assessment === 'string' ? assessment : assessment.id;
    const item = this.content.assessments.find(
      (candidate) => candidate.id === assessmentId,
    );
    if (!item) {
      return '这一步需要重新定位题目和学习目标。';
    }
    return `${item.explanation} 提示：${item.hint}`;
  }

  getUsage(): HintUsage[] {
    return this.usage.map((item) => ({ ...item }));
  }

  getUsageCount(assessmentId?: string): number {
    if (!assessmentId) return this.usage.length;
    return this.usage.filter((item) => item.assessmentId === assessmentId)
      .length;
  }
}
