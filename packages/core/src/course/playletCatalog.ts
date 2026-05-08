/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export const GAMEPLAY_SUPERCLASSES = [
  'information_organization',
  'sequence_reasoning',
  'quantity_space_system',
  'experiment_simulation',
  'action_fluency',
  'language_communication',
  'diagnosis_verification',
  'strategy_roleplay',
  'creation_project',
  'composite_pattern',
] as const;

export type GameplaySuperclass = (typeof GAMEPLAY_SUPERCLASSES)[number];

export const PLAYLET_ENGINE_FAMILIES = [
  'ui',
  'grid',
  'action',
  'simulation',
  'strategy',
  'creation',
] as const;

export type PlayletEngineFamily = (typeof PLAYLET_ENGINE_FAMILIES)[number];

export const PLAYLET_STATUS = ['ready', 'planned'] as const;
export type PlayletStatus = (typeof PLAYLET_STATUS)[number];

export interface PlayletInputContract {
  requiredConfigFields: string[];
  requiredStateKeys: string[];
}

export interface PlayletOutputContract {
  resultEvent: 'playlet_completed';
  requiredEvidence: string[];
  writesStateKeys: string[];
}

export interface TransitionContract {
  enter: 'static_card' | 'motion_card' | 'video_optional';
  exit: 'result_bridge' | 'reflection_bridge' | 'instant';
  supportsSubtitleFallback: boolean;
}

export interface PlaceholderAssetSpec {
  key: string;
  type: 'shape' | 'icon' | 'sfx' | 'background';
  description: string;
}

export interface PlayletTemplate {
  id: string;
  title: string;
  superclass: GameplaySuperclass;
  concreteGameplay: string;
  engineFamily: PlayletEngineFamily;
  status: PlayletStatus;
  configSchema: Record<string, unknown>;
  inputContract: PlayletInputContract;
  outputContract: PlayletOutputContract;
  transitionContract: TransitionContract;
  defaultAssets: PlaceholderAssetSpec[];
}

interface PlayletSeed {
  title: string;
  superclass: GameplaySuperclass;
  engineFamily: PlayletEngineFamily;
  status: PlayletStatus;
}

const READY_TITLES = new Set([
  '找目标',
  '找异常',
  '单选判断',
  '拖拽分箱',
  '连线匹配',
  '卡片配对',
  '证据配对',
  '框选标注',
  '步骤排序',
  '时间线排序',
  '流程接线',
  '条件组合推理',
  '证据链拼接',
  '证明步骤补全',
  '口算挑战',
  '等式平衡',
  '图形拼装',
  '坐标定位',
  '迷宫寻路',
  '模块装配',
  '滑杆调参',
  '开关组合',
  'A/B 对比',
  '控制变量实验',
  '点击射击',
  '接落物',
  '节奏点击',
  '错题回炉',
  '词块排序',
  '对话选择',
  '关键词提取',
  '论证表达',
  '模块定位',
  '失败输出归因',
  '回归测试',
  '资源分配',
  '多角色决策',
  '分镜板',
  '需求清单验收',
  '调参 + 对比',
]);

const PLAYLET_SEEDS: PlayletSeed[] = [
  ...seeds('information_organization', 'ui', [
    '找不同',
    '找目标',
    '找异常',
    '单选判断',
    '多选判断',
    '放行 / 打回',
    '拖拽分箱',
    '点击分流',
    '盖章分类',
    '层级分类树',
    '连线匹配',
    '卡片配对',
    '证据配对',
    '框选标注',
    '切分划线',
    '删除纠错',
  ]),
  ...seeds('sequence_reasoning', 'grid', [
    '步骤排序',
    '时间线排序',
    '句子续接',
    '流程接线',
    '现象找原因',
    '原因推后果',
    '条件组合推理',
    '线索收集',
    '证据链拼接',
    '侦探推理',
    '密码锁',
    '机关房',
    '谜题链',
    '论点论据搭建',
    '证明步骤补全',
  ]),
  ...seeds('quantity_space_system', 'grid', [
    '口算挑战',
    '数量配对',
    '等式平衡',
    '图形拼装',
    '立体搭建',
    '坐标定位',
    '迷宫寻路',
    '地图路线规划',
    '轨道切换',
    '模块装配',
    '节点网络',
    '承重结构',
  ]),
  ...seeds('experiment_simulation', 'simulation', [
    '滑杆调参',
    '开关组合',
    '参数面板',
    'A/B 对比',
    '控制变量实验',
    '误差实验',
    '多轮迭代',
    '调参挑战',
    '生态 / 城市沙盒',
    '物理沙盒',
    'AI 行为沙盒',
  ]),
  ...seeds('action_fluency', 'action', [
    '点击射击',
    '拖拽瞄准',
    '接落物',
    '收集路线',
    '躲避错误项',
    '限时生存',
    '节奏点击',
    '顺序复现',
    '计时抢答',
    '错题回炉',
  ]),
  ...seeds('language_communication', 'ui', [
    '模糊表达修复',
    '风格改写',
    '词块排序',
    '句式套用',
    '对话选择',
    '澄清追问',
    '苏格拉底式引导',
    '关键词提取',
    '一句话总结',
    '论证表达',
  ]),
  ...seeds('diagnosis_verification', 'grid', [
    '模块定位',
    '日志排查',
    '失败输出归因',
    '实验失败归因',
    '工具修复',
    '补丁编辑',
    '回归测试',
    '质量验收',
    '风险闸门',
  ]),
  ...seeds('strategy_roleplay', 'strategy', [
    '资源分配',
    '风险收益选择',
    '排班调度',
    '路线调度',
    '系统经营',
    '事件响应',
    '职业任务',
    '多角色决策',
    '听证裁决',
  ]),
  ...seeds('creation_project', 'creation', [
    '字段填充生成',
    '规则模板生成',
    '分镜板',
    '时间轴编辑',
    '画布排版',
    '游戏规则描述',
    '智能体设计',
    '工作流搭建',
    '需求清单验收',
    '版本对比',
    '用户测试',
  ]),
  ...seeds('composite_pattern', 'grid', [
    '观察 + 分类',
    '标注 + 路径',
    '搜证 + 裁决',
    '调参 + 对比',
    '拼装 + 测试',
    '创作 + 验收',
    '新概念导入',
    '概念辨析',
    '机制理解',
    '熟练巩固',
    '高阶迁移',
  ]),
];

export const PLAYLET_TEMPLATES: PlayletTemplate[] = PLAYLET_SEEDS.map((seed) =>
  buildPlayletTemplate(seed),
);

export const READY_PLAYLET_TEMPLATES = PLAYLET_TEMPLATES.filter(
  (template) => template.status === 'ready',
);

export function getPlayletTemplate(
  playletId: string,
): PlayletTemplate | undefined {
  return PLAYLET_TEMPLATES.find((template) => template.id === playletId);
}

export function isReadyPlaylet(playletId: string): boolean {
  return getPlayletTemplate(playletId)?.status === 'ready';
}

export function slugifyPlayletTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/a\/b/gi, 'ab')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function seeds(
  superclass: GameplaySuperclass,
  engineFamily: PlayletEngineFamily,
  titles: string[],
): PlayletSeed[] {
  return titles.map((title) => ({
    title,
    superclass,
    engineFamily,
    status: READY_TITLES.has(title) ? 'ready' : 'planned',
  }));
}

function buildPlayletTemplate(seed: PlayletSeed): PlayletTemplate {
  const id = `playlet-${slugifyPlayletTitle(seed.title)}`;
  return {
    id,
    title: seed.title,
    superclass: seed.superclass,
    concreteGameplay: seed.title,
    engineFamily: seed.engineFamily,
    status: seed.status,
    configSchema: buildConfigSchema(),
    inputContract: {
      requiredConfigFields: ['prompt', 'items', 'successCriteria'],
      requiredStateKeys: ['courseId', 'activeGoalIds'],
    },
    outputContract: {
      resultEvent: 'playlet_completed',
      requiredEvidence: ['accuracy', 'attempts', 'misconceptionTags'],
      writesStateKeys: ['playletResults', 'goalProgress'],
    },
    transitionContract: {
      enter: 'static_card',
      exit: 'result_bridge',
      supportsSubtitleFallback: true,
    },
    defaultAssets: [
      {
        key: `${id}-background`,
        type: 'background',
        description: `${seed.title} 抽象占位背景`,
      },
      {
        key: `${id}-success`,
        type: 'sfx',
        description: `${seed.title} 正确反馈占位音效`,
      },
    ],
  };
}

function buildConfigSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: true,
    required: ['prompt', 'items', 'successCriteria'],
    properties: {
      prompt: { type: 'string', minLength: 1 },
      items: { type: 'array', minItems: 1 },
      successCriteria: { type: 'string', minLength: 1 },
      feedback: { type: 'object' },
    },
  };
}
