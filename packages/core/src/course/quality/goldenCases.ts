/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CourseArchetype,
  CoursePlanOption,
  CourseSpec,
  StudentGrade,
} from '../schemas.js';
import { COURSE_ARCHETYPES, SUPPORTED_GRADES } from '../schemas.js';

export type GoldenCaseSubject =
  | 'math'
  | 'chinese'
  | 'english'
  | 'science'
  | 'morality'
  | 'art';

export interface GoldenCasePlanDirection {
  archetype: CourseArchetype;
  gameplayType: string;
  playletIds: string[];
  stateChange: string;
}

export interface CourseGoldenCase {
  id: string;
  subjectCategory: GoldenCaseSubject;
  oneShotInput: string;
  expectedSpec: CourseSpec;
  expectedPlanDirection: GoldenCasePlanDirection;
  minimumExcitementScore: number;
}

export const GOLDEN_CASE_GRADE_BANDS = {
  lower: [1, 2],
  middle: [3, 4],
  upper: [5, 6],
  junior: [7, 8, 9],
  senior: [10, 11, 12],
} as const satisfies Record<string, readonly StudentGrade[]>;

export const goldenCaseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'subjectCategory',
    'oneShotInput',
    'expectedSpec',
    'expectedPlanDirection',
    'minimumExcitementScore',
  ],
  properties: {
    id: { type: 'string', minLength: 1 },
    subjectCategory: {
      enum: ['math', 'chinese', 'english', 'science', 'morality', 'art'],
    },
    oneShotInput: { type: 'string', minLength: 1 },
    expectedSpec: { type: 'object' },
    expectedPlanDirection: {
      type: 'object',
      additionalProperties: false,
      required: ['archetype', 'gameplayType', 'playletIds', 'stateChange'],
      properties: {
        archetype: { enum: COURSE_ARCHETYPES },
        gameplayType: { type: 'string', minLength: 1 },
        playletIds: {
          type: 'array',
          minItems: 1,
          items: { type: 'string', minLength: 1 },
        },
        stateChange: { type: 'string', minLength: 1 },
      },
    },
    minimumExcitementScore: { type: 'integer', minimum: 70, maximum: 100 },
  },
} as const;

export interface GoldenCaseCoverageSummary {
  total: number;
  bySubject: Record<GoldenCaseSubject, number>;
  byGrade: Record<StudentGrade, number>;
  byGradeBand: Record<keyof typeof GOLDEN_CASE_GRADE_BANDS, number>;
}

export const COURSE_GOLDEN_CASES: CourseGoldenCase[] = [
  goldenCase({
    id: 'math-g1-number-rescue',
    subjectCategory: 'math',
    oneShotInput: '一年级数学，做一个海底救援风格的 20 以内加减法游戏。',
    grade: 1,
    subject: '数学',
    topic: '20 以内加减法',
    goals: ['用凑十法完成加法', '用退位想法完成减法'],
    interests: ['海底探险', '救援'],
    theme: '海底救援队',
    characterStyle: '潜水小队长',
    gameplayType: '闯关练习',
    archetype: 'course_ui',
    playletIds: ['playlet-口算挑战', 'playlet-接落物'],
  }),
  goldenCase({
    id: 'math-g2-shape-builder',
    subjectCategory: 'math',
    oneShotInput: '二年级数学，想用积木工坊讲清楚平面图形的边和角。',
    grade: 2,
    subject: '数学',
    topic: '平面图形的边和角',
    goals: ['识别常见平面图形', '用边和角描述图形特征'],
    interests: ['积木', '搭建'],
    theme: '积木工坊',
    characterStyle: '小小建筑师',
    gameplayType: '图形拼装',
    archetype: 'course_grid',
    playletIds: ['playlet-图形拼装', 'playlet-框选标注'],
  }),
  goldenCase({
    id: 'math-g4-area-planet',
    subjectCategory: 'math',
    oneShotInput:
      '四年级数学，太空基地主题，让孩子理解长方形面积公式不是死背。',
    grade: 4,
    subject: '数学',
    topic: '长方形面积',
    goals: ['解释面积公式的来源', '用面积公式解决情境问题'],
    interests: ['太空基地', '工程'],
    theme: '月球基地建设',
    characterStyle: '基地工程师',
    gameplayType: '模块装配',
    archetype: 'course_grid',
    playletIds: ['playlet-模块装配', 'playlet-等式平衡'],
    depth: 'deep',
  }),
  goldenCase({
    id: 'math-g6-ratio-restaurant',
    subjectCategory: 'math',
    oneShotInput: '六年级数学，用餐厅经营讲比例和配比，最好有策略取舍。',
    grade: 6,
    subject: '数学',
    topic: '比例与配比',
    goals: ['解释比例关系', '根据约束调整配比方案'],
    interests: ['经营', '美食'],
    theme: '星级餐厅配方赛',
    characterStyle: '主厨经理',
    gameplayType: '资源分配',
    archetype: 'course_td',
    playletIds: ['playlet-资源分配', 'playlet-调参-plus-对比'],
    depth: 'challenge',
  }),
  goldenCase({
    id: 'chinese-g1-character-forest',
    subjectCategory: 'chinese',
    oneShotInput: '一年级语文，森林寻宝风格，学会区分形近字。',
    grade: 1,
    subject: '语文',
    topic: '形近字辨析',
    goals: ['观察形近字的关键差异', '在词语中正确选择汉字'],
    interests: ['森林', '寻宝'],
    theme: '森林字形寻宝',
    characterStyle: '小侦探',
    gameplayType: '找目标',
    archetype: 'course_ui',
    playletIds: ['playlet-找目标', 'playlet-找异常'],
  }),
  goldenCase({
    id: 'chinese-g3-story-order',
    subjectCategory: 'chinese',
    oneShotInput:
      '三年级语文，做一个侦探破案游戏，练习按事情发展顺序复述故事。',
    grade: 3,
    subject: '语文',
    topic: '按顺序复述故事',
    goals: ['提取故事关键事件', '按发展顺序组织复述'],
    interests: ['侦探', '线索'],
    theme: '图书馆谜案',
    characterStyle: '少年侦探',
    gameplayType: '时间线排序',
    archetype: 'course_grid',
    playletIds: ['playlet-时间线排序', 'playlet-证据链拼接'],
  }),
  goldenCase({
    id: 'chinese-g4-main-idea',
    subjectCategory: 'chinese',
    oneShotInput: '四年级语文，太空记者主题，训练概括段落主要内容。',
    grade: 4,
    subject: '语文',
    topic: '概括段落主要内容',
    goals: ['提取关键词', '用完整句概括段意'],
    interests: ['太空', '采访'],
    theme: '星际新闻社',
    characterStyle: '太空记者',
    gameplayType: '关键词提取',
    archetype: 'course_ui',
    playletIds: ['playlet-关键词提取', 'playlet-论证表达'],
    depth: 'deep',
  }),
  goldenCase({
    id: 'chinese-g6-argument-court',
    subjectCategory: 'chinese',
    oneShotInput: '六年级语文，用模拟法庭讲论点和论据，别只做选择题。',
    grade: 6,
    subject: '语文',
    topic: '论点与论据',
    goals: ['区分论点和论据', '用证据支持观点'],
    interests: ['辩论', '法庭'],
    theme: '校园模拟法庭',
    characterStyle: '学生辩护人',
    gameplayType: '论证表达',
    archetype: 'course_ui',
    playletIds: ['playlet-论证表达', 'playlet-证据配对'],
    depth: 'challenge',
  }),
  goldenCase({
    id: 'english-g1-word-market',
    subjectCategory: 'english',
    oneShotInput: '一年级英语，做一个水果市场小游戏，练 apple banana orange。',
    grade: 1,
    subject: '英语',
    topic: '水果单词',
    goals: ['识别常见水果单词', '把单词和图片正确匹配'],
    interests: ['水果', '购物'],
    theme: '水果市场',
    characterStyle: '小店主',
    gameplayType: '单词配对',
    archetype: 'course_ui',
    playletIds: ['playlet-卡片配对', 'playlet-接落物'],
  }),
  goldenCase({
    id: 'english-g2-dialogue-train',
    subjectCategory: 'english',
    oneShotInput: '二年级英语，火车旅行主题，练习 How are you 的问答。',
    grade: 2,
    subject: '英语',
    topic: '问候对话',
    goals: ['理解 How are you 的使用场景', '完成基本问候应答'],
    interests: ['火车', '旅行'],
    theme: '问候列车',
    characterStyle: '列车广播员',
    gameplayType: '对话选择',
    archetype: 'course_ui',
    playletIds: ['playlet-对话选择', 'playlet-词块排序'],
  }),
  goldenCase({
    id: 'english-g4-sentence-magic',
    subjectCategory: 'english',
    oneShotInput: '四年级英语，魔法学院风格但不要幼稚，练一般现在时句型。',
    grade: 4,
    subject: '英语',
    topic: '一般现在时句型',
    goals: ['识别一般现在时结构', '按主语选择正确动词形式'],
    interests: ['魔法学院', '解谜'],
    theme: '星辉魔法学院',
    characterStyle: '见习咒语整理师',
    gameplayType: '词块排序',
    archetype: 'course_grid',
    playletIds: ['playlet-词块排序', 'playlet-单选判断'],
    depth: 'deep',
  }),
  goldenCase({
    id: 'english-g5-reading-expedition',
    subjectCategory: 'english',
    oneShotInput: '五年级英语，探险日志主题，训练阅读短文找关键信息。',
    grade: 5,
    subject: '英语',
    topic: '阅读关键信息',
    goals: ['定位短文中的关键信息', '用证据回答阅读问题'],
    interests: ['探险', '日志'],
    theme: '遗迹探险日志',
    characterStyle: '探险记录员',
    gameplayType: '证据配对',
    archetype: 'course_ui',
    playletIds: ['playlet-证据配对', 'playlet-关键词提取'],
    depth: 'challenge',
  }),
  goldenCase({
    id: 'science-g2-plant-lab',
    subjectCategory: 'science',
    oneShotInput: '二年级科学，花园实验室主题，认识植物需要什么才能生长。',
    grade: 2,
    subject: '科学',
    topic: '植物生长条件',
    goals: ['说出植物生长需要的基本条件', '根据现象判断缺少的条件'],
    interests: ['花园', '实验'],
    theme: '花园实验室',
    characterStyle: '小园丁',
    gameplayType: '控制变量实验',
    archetype: 'course_grid',
    playletIds: ['playlet-控制变量实验', 'playlet-找异常'],
  }),
  goldenCase({
    id: 'science-g3-magnet-rescue',
    subjectCategory: 'science',
    oneShotInput: '三年级科学，机器人救援主题，讲磁铁能吸什么。',
    grade: 3,
    subject: '科学',
    topic: '磁铁性质',
    goals: ['区分能被磁铁吸引的材料', '用实验结果解释判断'],
    interests: ['机器人', '救援'],
    theme: '机器人磁力救援',
    characterStyle: '维修工程师',
    gameplayType: 'A/B 对比',
    archetype: 'course_grid',
    playletIds: ['playlet-ab-对比', 'playlet-拖拽分箱'],
  }),
  goldenCase({
    id: 'science-g5-circuit-station',
    subjectCategory: 'science',
    oneShotInput: '五年级科学，空间站维修游戏，理解简单电路为什么亮或不亮。',
    grade: 5,
    subject: '科学',
    topic: '简单电路',
    goals: ['识别电路闭合条件', '排查灯泡不亮的原因'],
    interests: ['空间站', '维修'],
    theme: '空间站电路维修',
    characterStyle: '电路工程师',
    gameplayType: '开关组合',
    archetype: 'course_grid',
    playletIds: ['playlet-开关组合', 'playlet-模块定位'],
    depth: 'deep',
  }),
  goldenCase({
    id: 'science-g6-ecosystem-balance',
    subjectCategory: 'science',
    oneShotInput: '六年级科学，用生态保护区沙盒讲食物链和生态平衡。',
    grade: 6,
    subject: '科学',
    topic: '食物链与生态平衡',
    goals: ['解释食物链能量传递', '预测某一角色变化的影响'],
    interests: ['生态保护', '沙盒'],
    theme: '生态保护区调度',
    characterStyle: '生态管理员',
    gameplayType: '调参 + 对比',
    archetype: 'course_grid',
    playletIds: ['playlet-调参-plus-对比', 'playlet-资源分配'],
    depth: 'challenge',
  }),
  goldenCase({
    id: 'morality-g1-safety-crossing',
    subjectCategory: 'morality',
    oneShotInput: '一年级道法，做一个安全过马路的情境选择游戏。',
    grade: 1,
    subject: '道法',
    topic: '安全过马路',
    goals: ['识别安全过马路信号', '选择合适的过马路行为'],
    interests: ['城市', '交通'],
    theme: '安全小交警',
    characterStyle: '交通安全员',
    gameplayType: '情境选择',
    archetype: 'course_ui',
    playletIds: ['playlet-单选判断', 'playlet-对话选择'],
  }),
  goldenCase({
    id: 'morality-g3-class-duty',
    subjectCategory: 'morality',
    oneShotInput: '三年级道法，班级值日主题，学会责任分工和合作。',
    grade: 3,
    subject: '道法',
    topic: '责任分工',
    goals: ['理解公共任务中的责任', '根据任务特点做合理分工'],
    interests: ['班级管理', '合作'],
    theme: '班级值日调度站',
    characterStyle: '值日队长',
    gameplayType: '资源分配',
    archetype: 'course_ui',
    playletIds: ['playlet-资源分配', 'playlet-多角色决策'],
  }),
  goldenCase({
    id: 'morality-g4-online-safety',
    subjectCategory: 'morality',
    oneShotInput: '四年级道法，网络安全侦探主题，判断哪些信息不能随便分享。',
    grade: 4,
    subject: '道法',
    topic: '个人信息保护',
    goals: ['识别个人敏感信息', '解释不能随意分享的原因'],
    interests: ['侦探', '网络安全'],
    theme: '网络安全侦探社',
    characterStyle: '安全调查员',
    gameplayType: '风险闸门',
    archetype: 'course_ui',
    playletIds: ['playlet-找异常', 'playlet-失败输出归因'],
    depth: 'deep',
  }),
  goldenCase({
    id: 'morality-g6-community-budget',
    subjectCategory: 'morality',
    oneShotInput: '六年级道法，用社区预算会议讲公共资源如何公平分配。',
    grade: 6,
    subject: '道法',
    topic: '公共资源分配',
    goals: ['比较不同群体的需求', '提出兼顾公平和效率的分配方案'],
    interests: ['城市规划', '会议决策'],
    theme: '社区预算会议',
    characterStyle: '社区议事代表',
    gameplayType: '多角色决策',
    archetype: 'course_ui',
    playletIds: ['playlet-多角色决策', 'playlet-资源分配'],
    depth: 'challenge',
  }),
  goldenCase({
    id: 'art-g1-rhythm-forest',
    subjectCategory: 'art',
    oneShotInput: '一年级音乐，森林鼓点游戏，练习强弱节奏。',
    grade: 1,
    subject: '音乐',
    topic: '强弱节奏',
    goals: ['听辨强弱节奏', '按节奏完成点击回应'],
    interests: ['森林', '鼓点'],
    theme: '森林鼓点派对',
    characterStyle: '小鼓手',
    gameplayType: '节奏点击',
    archetype: 'course_ui',
    playletIds: ['playlet-节奏点击', 'playlet-单选判断'],
  }),
  goldenCase({
    id: 'art-g2-color-museum',
    subjectCategory: 'art',
    oneShotInput: '二年级美术，博物馆小游戏，认识冷暖色。',
    grade: 2,
    subject: '美术',
    topic: '冷暖色',
    goals: ['区分冷色和暖色', '根据情绪选择合适色彩'],
    interests: ['博物馆', '配色'],
    theme: '色彩博物馆',
    characterStyle: '小策展人',
    gameplayType: '拖拽分箱',
    archetype: 'course_ui',
    playletIds: ['playlet-拖拽分箱', 'playlet-卡片配对'],
  }),
  goldenCase({
    id: 'art-g4-comic-storyboard',
    subjectCategory: 'art',
    oneShotInput: '四年级美术，漫画导演主题，学习用分镜表达一个小故事。',
    grade: 4,
    subject: '美术',
    topic: '漫画分镜',
    goals: ['识别分镜中的动作和视角', '按故事顺序安排画面'],
    interests: ['漫画', '导演'],
    theme: '漫画导演工作室',
    characterStyle: '分镜导演',
    gameplayType: '分镜板',
    archetype: 'course_ui',
    playletIds: ['playlet-分镜板', 'playlet-时间线排序'],
    depth: 'deep',
  }),
  goldenCase({
    id: 'art-g5-project-poster',
    subjectCategory: 'art',
    oneShotInput: '五年级综合实践，用环保海报项目讲需求清单和作品验收。',
    grade: 5,
    subject: '综合',
    topic: '环保海报项目',
    goals: ['提取作品需求清单', '根据标准验收并改进作品'],
    interests: ['环保', '设计'],
    theme: '环保海报发布会',
    characterStyle: '项目设计师',
    gameplayType: '需求清单验收',
    archetype: 'course_ui',
    playletIds: ['playlet-需求清单验收', 'playlet-分镜板'],
    depth: 'challenge',
  }),
];

export function summarizeGoldenCaseCoverage(
  cases: CourseGoldenCase[] = COURSE_GOLDEN_CASES,
): GoldenCaseCoverageSummary {
  const bySubject = {
    math: 0,
    chinese: 0,
    english: 0,
    science: 0,
    morality: 0,
    art: 0,
  } satisfies Record<GoldenCaseSubject, number>;
  const byGrade = Object.fromEntries(
    SUPPORTED_GRADES.map((grade) => [grade, 0]),
  ) as Record<StudentGrade, number>;
  const byGradeBand = {
    lower: 0,
    middle: 0,
    upper: 0,
    junior: 0,
    senior: 0,
  } satisfies Record<keyof typeof GOLDEN_CASE_GRADE_BANDS, number>;

  for (const item of cases) {
    bySubject[item.subjectCategory] += 1;
    byGrade[item.expectedSpec.studentProfile.grade] += 1;
    for (const [band, grades] of Object.entries(GOLDEN_CASE_GRADE_BANDS)) {
      const bandGrades = grades as readonly StudentGrade[];
      if (bandGrades.includes(item.expectedSpec.studentProfile.grade)) {
        byGradeBand[band as keyof typeof GOLDEN_CASE_GRADE_BANDS] += 1;
      }
    }
  }

  return {
    total: cases.length,
    bySubject,
    byGrade,
    byGradeBand,
  };
}

export function buildGoldenCasePlanOption(
  goldenCase: CourseGoldenCase,
): CoursePlanOption {
  const direction = goldenCase.expectedPlanDirection;
  return {
    id: `${goldenCase.id}-plan`,
    title: `${goldenCase.expectedSpec.topic} · ${direction.gameplayType}`,
    courseArchetype: direction.archetype,
    gameplayType: direction.gameplayType,
    learningLoop: [
      '情境导入',
      '观察示例',
      '核心操作挑战',
      '即时反馈',
      '复盘评价',
    ],
    scenePlan: [
      `${goldenCase.expectedSpec.styleSpec.theme}导入`,
      `${direction.gameplayType}核心关卡`,
      `${direction.stateChange}解锁变化`,
      '迁移挑战与学习报告',
    ],
    assessmentPoints: goldenCase.expectedSpec.learningGoals,
    assetComplexity: direction.archetype === 'course_td' ? 'high' : 'medium',
    score: {
      learningFit: 88,
      explanationDepthFit: 86,
      fun: 90,
      ageFit: 88,
      implementationStability: 82,
      cost: 76,
      safety: 92,
    },
    recommendationReason: `${direction.gameplayType}能把学习目标转成可观察操作，并通过${direction.stateChange}体现掌握进展。`,
    risks: [],
  };
}

interface GoldenCaseInput {
  id: string;
  subjectCategory: GoldenCaseSubject;
  oneShotInput: string;
  grade: StudentGrade;
  subject: string;
  topic: string;
  goals: string[];
  interests: string[];
  theme: string;
  characterStyle: string;
  gameplayType: string;
  archetype: CourseArchetype;
  playletIds: string[];
  depth?: CourseSpec['explanationDepth']['depthLevel'];
}

function goldenCase(input: GoldenCaseInput): CourseGoldenCase {
  const depth = input.depth ?? (input.grade <= 2 ? 'standard' : 'deep');
  return {
    id: input.id,
    subjectCategory: input.subjectCategory,
    oneShotInput: input.oneShotInput,
    expectedSpec: {
      subject: input.subject,
      topic: input.topic,
      learningGoals: input.goals,
      durationMinutes: input.grade <= 2 ? 18 : 25,
      studentProfile: {
        grade: input.grade,
        readingLevel: input.grade <= 2 ? 'low' : 'medium',
        interests: input.interests,
        guardianLimits: {
          maxSessionMinutes: input.grade <= 2 ? 20 : 30,
          allowUploadedImages: false,
          allowGeneratedVideo: false,
          contentStrictness: 'strict',
        },
      },
      styleSpec: {
        theme: input.theme,
        palette: ['#2563EB', '#F59E0B', '#10B981'],
        visualMood: '明亮、有探索感',
        characterStyle: input.characterStyle,
        uiDensity: input.grade <= 2 ? 'low' : 'medium',
        forbidden: ['惊吓', '血腥', '知名 IP 复刻'],
      },
      explanationDepth: buildDepth(depth, input.goals),
    },
    expectedPlanDirection: {
      archetype: input.archetype,
      gameplayType: input.gameplayType,
      playletIds: input.playletIds,
      stateChange: input.grade <= 2 ? '徽章收集进度' : '任务状态推进',
    },
    minimumExcitementScore: depth === 'challenge' ? 78 : 75,
  };
}

function buildDepth(
  depthLevel: CourseSpec['explanationDepth']['depthLevel'],
  goals: string[],
): CourseSpec['explanationDepth'] {
  const conceptLayers = goals.map((goal) => ({
    concept: goal,
    whyItMatters: `学生需要掌握「${goal}」，才能在游戏任务中做出正确判断。`,
    misconceptionToAddress: [`把「${goal}」当成只需记忆的答案`],
    representation: depthLevel === 'standard' ? 'visual_model' : 'case',
  })) satisfies CourseSpec['explanationDepth']['conceptLayers'];

  return {
    depthLevel,
    priorKnowledgeCheck: true,
    conceptLayers,
    examplePlan:
      depthLevel === 'challenge'
        ? {
            workedExamples: 2,
            guidedPractice: 2,
            independentChallenges: 2,
            transferTasks: 2,
          }
        : {
            workedExamples: 2,
            guidedPractice: 2,
            independentChallenges: 2,
            transferTasks: depthLevel === 'standard' ? 0 : 1,
          },
    feedbackDepth: depthLevel === 'standard' ? 'step_by_step' : 'socratic_hint',
    masteryEvidence: goals.map((goal) => `能在新情境中完成：${goal}`),
  };
}
