import type {
  CourseContent,
  CourseInteraction,
  CourseLessonUnit,
} from '../courseContent';

export interface TaskObjective {
  id: string;
  goalId: string;
  sceneKey: string;
  prompt: string;
  requiredStepIds: string[];
  completedStepIds: string[];
  completed: boolean;
}

export class TaskObjectiveManager {
  private objectives = new Map<string, TaskObjective>();

  constructor(private readonly content: CourseContent) {
    for (const interaction of content.interactions) {
      const relatedUnit = this.findUnitForInteraction(interaction);
      this.objectives.set(interaction.id, {
        id: interaction.id,
        goalId: interaction.goalId,
        sceneKey: interaction.sceneKey,
        prompt: interaction.prompt,
        requiredStepIds: relatedUnit?.assessmentItemIds ?? [],
        completedStepIds: [],
        completed: false,
      });
    }
  }

  completeStep(objectiveId: string, stepId: string): TaskObjective | undefined {
    const objective = this.objectives.get(objectiveId);
    if (!objective) return undefined;
    if (!objective.completedStepIds.includes(stepId)) {
      objective.completedStepIds.push(stepId);
    }
    objective.completed = objective.requiredStepIds.every((requiredStepId) =>
      objective.completedStepIds.includes(requiredStepId),
    );
    return this.cloneObjective(objective);
  }

  completeObjective(objectiveId: string): TaskObjective | undefined {
    const objective = this.objectives.get(objectiveId);
    if (!objective) return undefined;
    objective.completed = true;
    objective.completedStepIds = [...objective.requiredStepIds];
    return this.cloneObjective(objective);
  }

  getObjective(objectiveId: string): TaskObjective | undefined {
    const objective = this.objectives.get(objectiveId);
    return objective ? this.cloneObjective(objective) : undefined;
  }

  getObjectivesForScene(sceneKey: string): TaskObjective[] {
    return Array.from(this.objectives.values())
      .filter((objective) => objective.sceneKey === sceneKey)
      .map((objective) => this.cloneObjective(objective));
  }

  getCompletionRatio(): number {
    if (this.objectives.size === 0) return 0;
    const completed = Array.from(this.objectives.values()).filter(
      (objective) => objective.completed,
    ).length;
    return completed / this.objectives.size;
  }

  private findUnitForInteraction(
    interaction: CourseInteraction,
  ): CourseLessonUnit | undefined {
    return this.content.lessonUnits.find((unit) =>
      unit.interactionIds.includes(interaction.id),
    );
  }

  private cloneObjective(objective: TaskObjective): TaskObjective {
    return {
      ...objective,
      requiredStepIds: [...objective.requiredStepIds],
      completedStepIds: [...objective.completedStepIds],
    };
  }
}
