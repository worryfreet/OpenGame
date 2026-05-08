import type { CourseAssessmentItem, CourseContent } from '../courseContent';

export interface StepFeedback {
  correct: boolean;
  message: string;
  misconceptionTag?: string;
  nextHint?: string;
}

export class StepFeedbackManager {
  constructor(private readonly content: CourseContent) {}

  buildAssessmentFeedback(
    assessmentId: string,
    selectedIndex: number,
  ): StepFeedback {
    const assessment = this.content.assessments.find(
      (item) => item.id === assessmentId,
    );
    if (!assessment) {
      return {
        correct: false,
        message: '没有找到当前步骤对应的评价题。',
        nextHint: '检查 courseContent.json 中的 assessment id。',
      };
    }
    return this.buildFeedbackFromAssessment(assessment, selectedIndex);
  }

  buildInteractionFeedback(
    interactionId: string,
    correct: boolean,
  ): StepFeedback {
    const interaction = this.content.interactions.find(
      (item) => item.id === interactionId,
    );
    if (!interaction) {
      return {
        correct: false,
        message: '没有找到当前网格任务。',
        nextHint: '检查 courseContent.json 中的 interaction id。',
      };
    }
    return {
      correct,
      message: correct
        ? interaction.successFeedback
        : interaction.failureFeedback,
      nextHint: correct ? undefined : interaction.failureFeedback,
    };
  }

  private buildFeedbackFromAssessment(
    assessment: CourseAssessmentItem,
    selectedIndex: number,
  ): StepFeedback {
    const correct = selectedIndex === assessment.correctIndex;
    return {
      correct,
      message: correct
        ? assessment.explanation
        : `${assessment.explanation} 提示：${assessment.hint}`,
      misconceptionTag: correct ? undefined : assessment.misconceptionTag,
      nextHint: correct ? undefined : assessment.hint,
    };
  }
}
