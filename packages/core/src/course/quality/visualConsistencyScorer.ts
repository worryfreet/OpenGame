/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CoursePlanOption, CourseSpec, StyleSpec } from '../schemas.js';

export type VisualConsistencyIssueDimension =
  | 'characterThemeConflict'
  | 'uiThemeConflict'
  | 'paletteMoodConflict'
  | 'forbiddenElement';

export interface VisualConsistencyIssue {
  dimension: VisualConsistencyIssueDimension;
  severity: 'warning' | 'blocking';
  message: string;
  improvementAction: string;
}

export interface VisualConsistencyReview {
  score: number;
  passed: boolean;
  issues: VisualConsistencyIssue[];
  improvementActions: string[];
}

export interface ScoreVisualConsistencyInput {
  courseSpec: CourseSpec;
  plan?: CoursePlanOption;
}

const THEME_GROUPS: Array<{
  name: string;
  keywords: string[];
  compatibleCharacters: string[];
  conflictingCharacters: string[];
  compatibleUi: string[];
  conflictingUi: string[];
}> = [
  {
    name: 'space',
    keywords: ['太空', '空间站', '星际', '月球', '宇宙', '星球'],
    compatibleCharacters: [
      '宇航',
      '工程师',
      '维修',
      '指挥官',
      '研究员',
      '记者',
    ],
    conflictingCharacters: ['骑士', '王子', '公主', '农夫', '海盗', '店主'],
    compatibleUi: ['仪表', '舱', '雷达', '星图', '任务面板', '控制台'],
    conflictingUi: ['木牌', '羊皮纸', '城堡', '卷轴', '菜单价签'],
  },
  {
    name: 'forest',
    keywords: ['森林', '花园', '植物', '自然', '生态'],
    compatibleCharacters: ['园丁', '探险', '生态', '研究员', '守护者'],
    conflictingCharacters: ['机甲', '黑客', '宇航', '主厨', '法官'],
    compatibleUi: ['地图', '标本', '叶片', '观察板', '生态面板'],
    conflictingUi: ['赛博', '霓虹', '仪表舱', '法庭', '餐厅菜单'],
  },
  {
    name: 'detective',
    keywords: ['侦探', '破案', '线索', '调查', '谜案'],
    compatibleCharacters: ['侦探', '调查员', '记者', '助手'],
    conflictingCharacters: ['宇航员', '主厨', '园丁', '鼓手'],
    compatibleUi: ['线索板', '证据', '档案', '地图', '便签'],
    conflictingUi: ['糖果', '花园', '厨房', '运动赛道'],
  },
  {
    name: 'restaurant',
    keywords: ['餐厅', '美食', '水果', '市场', '配方'],
    compatibleCharacters: ['主厨', '店主', '经理', '采购员'],
    conflictingCharacters: ['宇航', '侦探', '法官', '生态管理员'],
    compatibleUi: ['菜单', '订单', '库存', '配方', '价签'],
    conflictingUi: ['星图', '法庭卷宗', '魔法阵', '实验舱'],
  },
  {
    name: 'court',
    keywords: ['法庭', '辩论', '论证', '证据', '会议'],
    compatibleCharacters: ['辩护人', '代表', '主持人', '调查员'],
    conflictingCharacters: ['小店主', '宇航员', '鼓手', '园丁'],
    compatibleUi: ['证据板', '席位', '议程', '投票板'],
    conflictingUi: ['糖果', '飞船舱', '厨房菜单', '森林地图'],
  },
];

export function scoreVisualConsistency({
  courseSpec,
  plan,
}: ScoreVisualConsistencyInput): VisualConsistencyReview {
  const issues: VisualConsistencyIssue[] = [];
  const style = courseSpec.styleSpec;
  const text = collectVisualText(style, plan);
  const group = THEME_GROUPS.find((item) =>
    item.keywords.some((keyword) => style.theme.includes(keyword)),
  );

  if (group) {
    const characterConflict = findHit(
      style.characterStyle,
      group.conflictingCharacters,
    );
    if (
      characterConflict &&
      !containsAny(style.characterStyle, group.compatibleCharacters)
    ) {
      issues.push({
        dimension: 'characterThemeConflict',
        severity: 'blocking',
        message: `角色「${style.characterStyle}」与「${style.theme}」主题明显冲突。`,
        improvementAction:
          '重写角色方向，让身份、道具和任务职责服务同一个课程世界。',
      });
    }

    const uiConflict = findHit(text, group.conflictingUi);
    if (uiConflict && !containsAny(text, group.compatibleUi)) {
      issues.push({
        dimension: 'uiThemeConflict',
        severity: 'blocking',
        message: `UI 或场景元素「${uiConflict}」与「${style.theme}」主题明显冲突。`,
        improvementAction:
          '把 UI token、场景道具和反馈面板改成当前主题内的元素。',
      });
    }
  }

  if (hasPaletteMoodConflict(style)) {
    issues.push({
      dimension: 'paletteMoodConflict',
      severity: 'warning',
      message: '配色数量或情绪描述不足，难以形成稳定视觉基准。',
      improvementAction:
        '补齐 2-4 个可用色，并用视觉氛围约束按钮、反馈和场景状态。',
    });
  }

  const forbiddenHit = findHit(text, style.forbidden);
  if (forbiddenHit) {
    issues.push({
      dimension: 'forbiddenElement',
      severity: 'blocking',
      message: `视觉方案包含禁用元素「${forbiddenHit}」。`,
      improvementAction: '删除禁用元素，并用安全的同主题替代表达。',
    });
  }

  const score = scoreConsistency(style, group !== undefined, issues);
  return {
    score,
    passed:
      score >= 70 && !issues.some((issue) => issue.severity === 'blocking'),
    issues,
    improvementActions: [
      ...new Set(issues.map((issue) => issue.improvementAction)),
    ],
  };
}

function collectVisualText(
  style: StyleSpec,
  plan: CoursePlanOption | undefined,
): string {
  return [
    style.theme,
    style.characterStyle,
    style.visualMood,
    ...style.palette,
    ...(plan?.scenePlan ?? []),
    plan?.recommendationReason ?? '',
    ...(plan?.risks ?? []),
  ].join(' ');
}

function hasPaletteMoodConflict(style: StyleSpec): boolean {
  return style.palette.length < 2 || style.visualMood.trim().length < 2;
}

function scoreConsistency(
  style: StyleSpec,
  recognizedTheme: boolean,
  issues: VisualConsistencyIssue[],
): number {
  let score = 58;
  if (style.theme.trim().length >= 2) {
    score += 10;
  }
  if (style.characterStyle.trim().length >= 2) {
    score += 10;
  }
  if (style.visualMood.trim().length >= 2) {
    score += 8;
  }
  if (style.palette.length >= 2) {
    score += 8;
  }
  if (recognizedTheme) {
    score += 6;
  }
  score -= issues.filter((issue) => issue.severity === 'blocking').length * 28;
  score -= issues.filter((issue) => issue.severity === 'warning').length * 10;
  return clampScore(score);
}

function findHit(text: string, keywords: string[]): string | undefined {
  return keywords.find(
    (keyword) => keyword.length > 0 && text.includes(keyword),
  );
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
