/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export const SUPPORTED_GRADES = [1, 2, 3, 4, 5, 6] as const;
export type StudentGrade = (typeof SUPPORTED_GRADES)[number];

export const READING_LEVELS = ['low', 'medium', 'high'] as const;
export type ReadingLevel = (typeof READING_LEVELS)[number];

export const CONTENT_STRICTNESS = ['normal', 'strict'] as const;
export type ContentStrictness = (typeof CONTENT_STRICTNESS)[number];

export const EXPLANATION_DEPTH_LEVELS = [
  'intro',
  'standard',
  'deep',
  'challenge',
] as const;
export type ExplanationDepthLevel = (typeof EXPLANATION_DEPTH_LEVELS)[number];

export const REPRESENTATION_TYPES = [
  'story',
  'visual_model',
  'formula',
  'experiment',
  'case',
  'dialogue',
] as const;
export type RepresentationType = (typeof REPRESENTATION_TYPES)[number];

export const FEEDBACK_DEPTH_LEVELS = [
  'answer_only',
  'short_reason',
  'step_by_step',
  'socratic_hint',
] as const;
export type FeedbackDepthLevel = (typeof FEEDBACK_DEPTH_LEVELS)[number];

export const COURSE_ARCHETYPES = [
  'course_ui',
  'course_grid',
  'course_td',
] as const;
export type CourseArchetype = (typeof COURSE_ARCHETYPES)[number];

export const ASSET_COMPLEXITIES = ['low', 'medium', 'high'] as const;
export type AssetComplexity = (typeof ASSET_COMPLEXITIES)[number];

export const WORKFLOW_EDGE_CONDITIONS = [
  'success',
  'fail',
  'partial',
  'always',
] as const;
export type WorkflowEdgeCondition = (typeof WORKFLOW_EDGE_CONDITIONS)[number];

export const RECOVERY_POLICIES = [
  'retry_same',
  'hint_then_retry',
  'remediate_then_return',
] as const;
export type RecoveryPolicy = (typeof RECOVERY_POLICIES)[number];

export interface StudentProfile {
  grade: StudentGrade;
  age?: number;
  readingLevel?: ReadingLevel;
  interests: string[];
  weakPoints?: string[];
  preferredInteraction?: string[];
  ttsPreference?: {
    voice?: string;
    speed?: number;
    emotion?: string;
  };
  guardianLimits?: {
    maxSessionMinutes: number;
    allowUploadedImages: boolean;
    allowGeneratedVideo: boolean;
    contentStrictness: ContentStrictness;
  };
}

export interface StyleSpec {
  theme: string;
  palette: string[];
  referenceImages?: string[];
  visualMood: string;
  characterStyle: string;
  uiDensity: 'low' | 'medium' | 'high';
  forbidden: string[];
}

export interface ExplanationDepthSpec {
  depthLevel: ExplanationDepthLevel;
  priorKnowledgeCheck: boolean;
  conceptLayers: Array<{
    concept: string;
    whyItMatters: string;
    misconceptionToAddress: string[];
    representation: RepresentationType;
  }>;
  examplePlan: {
    workedExamples: number;
    guidedPractice: number;
    independentChallenges: number;
    transferTasks: number;
  };
  feedbackDepth: FeedbackDepthLevel;
  masteryEvidence: string[];
}

export interface CourseSpec {
  subject: string;
  topic: string;
  learningGoals: string[];
  durationMinutes: number;
  studentProfile: StudentProfile;
  styleSpec: StyleSpec;
  explanationDepth: ExplanationDepthSpec;
}

export interface CoursePlanScore {
  learningFit: number;
  explanationDepthFit: number;
  fun: number;
  ageFit: number;
  implementationStability: number;
  cost: number;
  safety: number;
}

export interface CoursePlanOption {
  id: string;
  title: string;
  courseArchetype: CourseArchetype;
  gameplayType: string;
  workflow?: CourseWorkflow;
  learningLoop: string[];
  scenePlan: string[];
  assessmentPoints: string[];
  assetComplexity: AssetComplexity;
  score: CoursePlanScore;
  recommendationReason: string;
  risks: string[];
}

export interface LessonUnit {
  id: string;
  learningGoal: string;
  concept: string;
  explanationScript: string;
  interactionTask: string;
  feedbackStrategy: string;
  assessmentPointId: string;
}

export interface InteractionSpec {
  id: string;
  lessonUnitId: string;
  type: string;
  prompt: string;
  expectedAction: string;
  feedback: {
    correct: string;
    incorrect: string;
    misconceptionTag: string;
    hint: string;
  };
}

export interface AssessmentItem {
  id: string;
  learningGoal: string;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  answer: string;
  explanation: string;
  misconceptionTag: string;
  hint: string;
}

export interface AssessmentSpec {
  items: AssessmentItem[];
  masteryCriteria: string[];
}

export interface CourseAssetPlan {
  images: Array<{ key: string; description: string }>;
  audio: Array<{ key: string; description: string; audioType: 'bgm' | 'sfx' }>;
  video?: Array<{ key: string; description: string; optional: boolean }>;
}

export interface NarrationPlan {
  segments: Array<{
    id: string;
    name: string;
    text: string;
    targetScene: string;
  }>;
}

export interface ValidationPlan {
  requiredChecks: string[];
  browserFlow: string[];
  fallbackChecks: string[];
}

export interface PlayletNode {
  id: string;
  playletId: string;
  goalIds: string[];
  config: unknown;
  styleBindingId: string;
  enterTransition?: string;
  exitTransition?: string;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  when: WorkflowEdgeCondition;
}

export interface CourseWorkflow {
  startNodeId: string;
  nodes: PlayletNode[];
  edges: WorkflowEdge[];
  recoveryPolicy: RecoveryPolicy;
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

export interface CourseGDD {
  courseSpec: CourseSpec;
  selectedPlan: CoursePlanOption;
  workflow?: CourseWorkflow;
  styleBible?: StyleBible;
  lessonUnits: LessonUnit[];
  interactionSpecs: InteractionSpec[];
  assessmentSpec: AssessmentSpec;
  assetPlan: CourseAssetPlan;
  narrationPlan: NarrationPlan;
  validationPlan: ValidationPlan;
}

const nonEmptyStringSchema = { type: 'string', minLength: 1 };
const nonEmptyStringArraySchema = {
  type: 'array',
  items: nonEmptyStringSchema,
  minItems: 1,
};

export const explanationDepthSpecSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'depthLevel',
    'priorKnowledgeCheck',
    'conceptLayers',
    'examplePlan',
    'feedbackDepth',
    'masteryEvidence',
  ],
  properties: {
    depthLevel: { enum: EXPLANATION_DEPTH_LEVELS },
    priorKnowledgeCheck: { type: 'boolean' },
    conceptLayers: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'concept',
          'whyItMatters',
          'misconceptionToAddress',
          'representation',
        ],
        properties: {
          concept: nonEmptyStringSchema,
          whyItMatters: nonEmptyStringSchema,
          misconceptionToAddress: {
            type: 'array',
            items: nonEmptyStringSchema,
          },
          representation: { enum: REPRESENTATION_TYPES },
        },
      },
    },
    examplePlan: {
      type: 'object',
      additionalProperties: false,
      required: [
        'workedExamples',
        'guidedPractice',
        'independentChallenges',
        'transferTasks',
      ],
      properties: {
        workedExamples: { type: 'integer', minimum: 0 },
        guidedPractice: { type: 'integer', minimum: 0 },
        independentChallenges: { type: 'integer', minimum: 0 },
        transferTasks: { type: 'integer', minimum: 0 },
      },
    },
    feedbackDepth: { enum: FEEDBACK_DEPTH_LEVELS },
    masteryEvidence: nonEmptyStringArraySchema,
  },
} as const;

export const courseSpecSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'subject',
    'topic',
    'learningGoals',
    'durationMinutes',
    'studentProfile',
    'styleSpec',
    'explanationDepth',
  ],
  properties: {
    subject: nonEmptyStringSchema,
    topic: nonEmptyStringSchema,
    learningGoals: nonEmptyStringArraySchema,
    durationMinutes: { type: 'integer', minimum: 5, maximum: 60 },
    studentProfile: {
      type: 'object',
      additionalProperties: false,
      required: ['grade', 'interests'],
      properties: {
        grade: { enum: SUPPORTED_GRADES },
        age: { type: 'integer', minimum: 5, maximum: 13 },
        readingLevel: { enum: READING_LEVELS },
        interests: {
          type: 'array',
          items: nonEmptyStringSchema,
        },
        weakPoints: {
          type: 'array',
          items: nonEmptyStringSchema,
        },
        preferredInteraction: {
          type: 'array',
          items: nonEmptyStringSchema,
        },
        ttsPreference: {
          type: 'object',
          additionalProperties: false,
          properties: {
            voice: nonEmptyStringSchema,
            speed: { type: 'number', minimum: 0.5, maximum: 2 },
            emotion: nonEmptyStringSchema,
          },
        },
        guardianLimits: {
          type: 'object',
          additionalProperties: false,
          required: [
            'maxSessionMinutes',
            'allowUploadedImages',
            'allowGeneratedVideo',
            'contentStrictness',
          ],
          properties: {
            maxSessionMinutes: { type: 'integer', minimum: 5, maximum: 60 },
            allowUploadedImages: { type: 'boolean' },
            allowGeneratedVideo: { type: 'boolean' },
            contentStrictness: { enum: CONTENT_STRICTNESS },
          },
        },
      },
    },
    styleSpec: {
      type: 'object',
      additionalProperties: false,
      required: [
        'theme',
        'palette',
        'visualMood',
        'characterStyle',
        'uiDensity',
        'forbidden',
      ],
      properties: {
        theme: nonEmptyStringSchema,
        palette: {
          type: 'array',
          items: nonEmptyStringSchema,
          minItems: 1,
        },
        referenceImages: {
          type: 'array',
          items: nonEmptyStringSchema,
        },
        visualMood: nonEmptyStringSchema,
        characterStyle: nonEmptyStringSchema,
        uiDensity: { enum: ['low', 'medium', 'high'] },
        forbidden: {
          type: 'array',
          items: nonEmptyStringSchema,
        },
      },
    },
    explanationDepth: explanationDepthSpecSchema,
  },
} as const;

const scoreSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'learningFit',
    'explanationDepthFit',
    'fun',
    'ageFit',
    'implementationStability',
    'cost',
    'safety',
  ],
  properties: {
    learningFit: { type: 'integer', minimum: 0, maximum: 100 },
    explanationDepthFit: { type: 'integer', minimum: 0, maximum: 100 },
    fun: { type: 'integer', minimum: 0, maximum: 100 },
    ageFit: { type: 'integer', minimum: 0, maximum: 100 },
    implementationStability: { type: 'integer', minimum: 0, maximum: 100 },
    cost: { type: 'integer', minimum: 0, maximum: 100 },
    safety: { type: 'integer', minimum: 0, maximum: 100 },
  },
} as const;

export const courseWorkflowSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['startNodeId', 'nodes', 'edges', 'recoveryPolicy'],
  properties: {
    startNodeId: nonEmptyStringSchema,
    nodes: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'playletId', 'goalIds', 'config', 'styleBindingId'],
        properties: {
          id: nonEmptyStringSchema,
          playletId: nonEmptyStringSchema,
          goalIds: nonEmptyStringArraySchema,
          config: { type: 'object' },
          styleBindingId: nonEmptyStringSchema,
          enterTransition: { type: 'string' },
          exitTransition: { type: 'string' },
        },
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['from', 'to', 'when'],
        properties: {
          from: nonEmptyStringSchema,
          to: nonEmptyStringSchema,
          when: { enum: WORKFLOW_EDGE_CONDITIONS },
        },
      },
    },
    recoveryPolicy: { enum: RECOVERY_POLICIES },
  },
} as const;

export const styleBibleSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'theme',
    'palette',
    'characterDirection',
    'uiTokens',
    'motionMood',
    'audioMood',
    'forbiddenElements',
  ],
  properties: {
    theme: nonEmptyStringSchema,
    palette: {
      type: 'array',
      items: nonEmptyStringSchema,
      minItems: 1,
    },
    characterDirection: nonEmptyStringSchema,
    uiTokens: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    motionMood: nonEmptyStringSchema,
    audioMood: nonEmptyStringSchema,
    forbiddenElements: {
      type: 'array',
      items: nonEmptyStringSchema,
    },
  },
} as const;

export const coursePlanOptionSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'title',
    'courseArchetype',
    'gameplayType',
    'learningLoop',
    'scenePlan',
    'assessmentPoints',
    'assetComplexity',
    'score',
    'recommendationReason',
    'risks',
  ],
  properties: {
    id: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    courseArchetype: { enum: COURSE_ARCHETYPES },
    gameplayType: nonEmptyStringSchema,
    workflow: courseWorkflowSchema,
    learningLoop: nonEmptyStringArraySchema,
    scenePlan: nonEmptyStringArraySchema,
    assessmentPoints: nonEmptyStringArraySchema,
    assetComplexity: { enum: ASSET_COMPLEXITIES },
    score: scoreSchema,
    recommendationReason: nonEmptyStringSchema,
    risks: {
      type: 'array',
      items: nonEmptyStringSchema,
    },
  },
} as const;

const lessonUnitSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'learningGoal',
    'concept',
    'explanationScript',
    'interactionTask',
    'feedbackStrategy',
    'assessmentPointId',
  ],
  properties: {
    id: nonEmptyStringSchema,
    learningGoal: nonEmptyStringSchema,
    concept: nonEmptyStringSchema,
    explanationScript: nonEmptyStringSchema,
    interactionTask: nonEmptyStringSchema,
    feedbackStrategy: nonEmptyStringSchema,
    assessmentPointId: nonEmptyStringSchema,
  },
} as const;

const interactionSpecSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'lessonUnitId',
    'type',
    'prompt',
    'expectedAction',
    'feedback',
  ],
  properties: {
    id: nonEmptyStringSchema,
    lessonUnitId: nonEmptyStringSchema,
    type: nonEmptyStringSchema,
    prompt: nonEmptyStringSchema,
    expectedAction: nonEmptyStringSchema,
    feedback: {
      type: 'object',
      additionalProperties: false,
      required: ['correct', 'incorrect', 'misconceptionTag', 'hint'],
      properties: {
        correct: nonEmptyStringSchema,
        incorrect: nonEmptyStringSchema,
        misconceptionTag: nonEmptyStringSchema,
        hint: nonEmptyStringSchema,
      },
    },
  },
} as const;

const assessmentItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'learningGoal',
    'prompt',
    'answer',
    'explanation',
    'misconceptionTag',
    'hint',
  ],
  properties: {
    id: nonEmptyStringSchema,
    learningGoal: nonEmptyStringSchema,
    prompt: nonEmptyStringSchema,
    options: {
      type: 'array',
      items: nonEmptyStringSchema,
    },
    correctIndex: { type: 'integer', minimum: 0 },
    answer: nonEmptyStringSchema,
    explanation: nonEmptyStringSchema,
    misconceptionTag: nonEmptyStringSchema,
    hint: nonEmptyStringSchema,
  },
} as const;

export const courseGddSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'courseSpec',
    'selectedPlan',
    'lessonUnits',
    'interactionSpecs',
    'assessmentSpec',
    'assetPlan',
    'narrationPlan',
    'validationPlan',
  ],
  properties: {
    courseSpec: courseSpecSchema,
    selectedPlan: coursePlanOptionSchema,
    workflow: courseWorkflowSchema,
    styleBible: styleBibleSchema,
    lessonUnits: {
      type: 'array',
      minItems: 1,
      items: lessonUnitSchema,
    },
    interactionSpecs: {
      type: 'array',
      minItems: 1,
      items: interactionSpecSchema,
    },
    assessmentSpec: {
      type: 'object',
      additionalProperties: false,
      required: ['items', 'masteryCriteria'],
      properties: {
        items: {
          type: 'array',
          minItems: 1,
          items: assessmentItemSchema,
        },
        masteryCriteria: nonEmptyStringArraySchema,
      },
    },
    assetPlan: {
      type: 'object',
      additionalProperties: false,
      required: ['images', 'audio'],
      properties: {
        images: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['key', 'description'],
            properties: {
              key: nonEmptyStringSchema,
              description: nonEmptyStringSchema,
            },
          },
        },
        audio: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['key', 'description', 'audioType'],
            properties: {
              key: nonEmptyStringSchema,
              description: nonEmptyStringSchema,
              audioType: { enum: ['bgm', 'sfx'] },
            },
          },
        },
        video: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['key', 'description', 'optional'],
            properties: {
              key: nonEmptyStringSchema,
              description: nonEmptyStringSchema,
              optional: { type: 'boolean' },
            },
          },
        },
      },
    },
    narrationPlan: {
      type: 'object',
      additionalProperties: false,
      required: ['segments'],
      properties: {
        segments: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'name', 'text', 'targetScene'],
            properties: {
              id: nonEmptyStringSchema,
              name: nonEmptyStringSchema,
              text: nonEmptyStringSchema,
              targetScene: nonEmptyStringSchema,
            },
          },
        },
      },
    },
    validationPlan: {
      type: 'object',
      additionalProperties: false,
      required: ['requiredChecks', 'browserFlow', 'fallbackChecks'],
      properties: {
        requiredChecks: nonEmptyStringArraySchema,
        browserFlow: nonEmptyStringArraySchema,
        fallbackChecks: nonEmptyStringArraySchema,
      },
    },
  },
} as const;
