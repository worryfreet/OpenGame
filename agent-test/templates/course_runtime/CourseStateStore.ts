export interface PlayletResult {
  nodeId: string;
  playletId: string;
  status: 'success' | 'fail' | 'partial';
  accuracy: number;
  attempts: number;
  misconceptionTags: string[];
  evidence: string[];
}

export class CourseStateStore {
  private readonly results: PlayletResult[] = [];
  private readonly goalProgress = new Map<string, number>();

  recordResult(goalIds: string[], result: PlayletResult): void {
    this.results.push(result);
    for (const goalId of goalIds) {
      const previous = this.goalProgress.get(goalId) ?? 0;
      this.goalProgress.set(goalId, Math.max(previous, result.accuracy));
    }
  }

  getResults(): PlayletResult[] {
    return [...this.results];
  }

  getGoalProgress(goalId: string): number {
    return this.goalProgress.get(goalId) ?? 0;
  }
}
