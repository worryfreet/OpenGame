import type { CourseContent } from '../courseContent';
import type { WaveDefinition } from './WaveManager';

export interface ReviewWaveResult {
  waveNumber: number;
  assessmentId: string;
  correct: boolean;
  misconceptionTag?: string;
}

export class ReviewWaveProgressManager {
  private readonly results: ReviewWaveResult[] = [];

  constructor(private readonly content: CourseContent) {
    if (!content.templateRules.reviewOnly) {
      throw new Error('course_td 只能用于复习巩固型课程。');
    }
  }

  getReviewPromptForWave(waveNumber: number): string {
    const assessment =
      this.content.assessments[
        (waveNumber - 1) % this.content.assessments.length
      ];
    return assessment?.question ?? '本波次没有配置复习题。';
  }

  resolveWaveAnswer(
    waveNumber: number,
    selectedIndex: number,
  ): ReviewWaveResult {
    const assessment =
      this.content.assessments[
        (waveNumber - 1) % this.content.assessments.length
      ];
    if (!assessment) {
      return { waveNumber, assessmentId: 'missing', correct: false };
    }
    const correct = selectedIndex === assessment.correctIndex;
    const result: ReviewWaveResult = {
      waveNumber,
      assessmentId: assessment.id,
      correct,
      misconceptionTag: correct ? undefined : assessment.misconceptionTag,
    };
    this.results.push(result);
    return result;
  }

  applyReviewPacing(waves: WaveDefinition[]): WaveDefinition[] {
    return waves.map((wave, index) => ({
      ...wave,
      preDelay: Math.max(wave.preDelay ?? 0, index === 0 ? 2000 : 1000),
      reward: wave.reward ?? 10,
    }));
  }

  getAccuracy(): number {
    if (this.results.length === 0) return 0;
    const correctCount = this.results.filter((result) => result.correct).length;
    return correctCount / this.results.length;
  }

  getResults(): ReviewWaveResult[] {
    return this.results.map((result) => ({ ...result }));
  }
}
