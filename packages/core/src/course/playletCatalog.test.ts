/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GAMEPLAY_SUPERCLASSES,
  PLAYLET_TEMPLATES,
  READY_PLAYLET_TEMPLATES,
  getPlayletTemplate,
  isReadyPlaylet,
} from './playletCatalog.js';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

describe('playletCatalog', () => {
  it('首批 40 个具体玩法模板为 ready，其余玩法进入 planned 池', () => {
    const ready = PLAYLET_TEMPLATES.filter(
      (template) => template.status === 'ready',
    );
    const planned = PLAYLET_TEMPLATES.filter(
      (template) => template.status === 'planned',
    );

    expect(ready).toHaveLength(40);
    expect(READY_PLAYLET_TEMPLATES).toHaveLength(40);
    expect(planned.length).toBeGreaterThan(60);
    expect(PLAYLET_TEMPLATES).toHaveLength(114);
  });

  it('首批玩法覆盖全部玩法超类', () => {
    const readySuperclasses = new Set(
      READY_PLAYLET_TEMPLATES.map((template) => template.superclass),
    );

    expect([...readySuperclasses].sort()).toEqual(
      [...GAMEPLAY_SUPERCLASSES].sort(),
    );
  });

  it('每个 ready playlet 都声明 schema、输出事件、过渡契约和占位资产', () => {
    for (const template of READY_PLAYLET_TEMPLATES) {
      expect(template.configSchema).toMatchObject({
        type: 'object',
      });
      expect(template.outputContract.resultEvent).toBe('playlet_completed');
      expect(template.transitionContract.supportsSubtitleFallback).toBe(true);
      expect(template.defaultAssets.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('planned 玩法不能被当作 ready 玩法使用', () => {
    const planned = getPlayletTemplate('playlet-找不同');

    expect(planned?.status).toBe('planned');
    expect(isReadyPlaylet('playlet-找不同')).toBe(false);
  });

  it.each([
    ['playlet-单选判断', '单选判断PlayletScene'],
    ['playlet-找目标', '找目标PlayletScene'],
    ['playlet-找异常', '找异常PlayletScene'],
    ['playlet-连线匹配', '连线匹配PlayletScene'],
    ['playlet-卡片配对', '卡片配对PlayletScene'],
    ['playlet-证据配对', '证据配对PlayletScene'],
    ['playlet-对话选择', '对话选择PlayletScene'],
    ['playlet-拖拽分箱', '拖拽分箱PlayletScene'],
    ['playlet-步骤排序', '步骤排序PlayletScene'],
    ['playlet-时间线排序', '时间线排序PlayletScene'],
    ['playlet-流程接线', '流程接线PlayletScene'],
    ['playlet-条件组合推理', '条件组合推理PlayletScene'],
    ['playlet-证据链拼接', '证据链拼接PlayletScene'],
    ['playlet-证明步骤补全', '证明步骤补全PlayletScene'],
    ['playlet-口算挑战', '口算挑战PlayletScene'],
    ['playlet-关键词提取', '关键词提取PlayletScene'],
    ['playlet-需求清单验收', '需求清单验收PlayletScene'],
    ['playlet-框选标注', '框选标注PlayletScene'],
    ['playlet-失败输出归因', '失败输出归因PlayletScene'],
    ['playlet-模块定位', '模块定位PlayletScene'],
    ['playlet-坐标定位', '坐标定位PlayletScene'],
    ['playlet-迷宫寻路', '迷宫寻路PlayletScene'],
    ['playlet-模块装配', '模块装配PlayletScene'],
    ['playlet-滑杆调参', '滑杆调参PlayletScene'],
    ['playlet-等式平衡', '等式平衡PlayletScene'],
    ['playlet-图形拼装', '图形拼装PlayletScene'],
    ['playlet-开关组合', '开关组合PlayletScene'],
  ])('首批真实 playlet 使用专用 renderer：%s', (playletId, renderer) => {
    const playletRoot = path.join(
      repoRoot,
      'agent-test/templates/playlets',
      playletId,
    );
    const source = readFileSync(path.join(playletRoot, 'index.ts'), 'utf8');
    const manifest = JSON.parse(
      readFileSync(path.join(playletRoot, 'manifest.json'), 'utf8'),
    ) as { renderer: string };

    expect(existsSync(path.join(playletRoot, 'schema.json'))).toBe(true);
    expect(existsSync(path.join(playletRoot, 'sample.json'))).toBe(true);
    expect(source).not.toContain('GenericPlayletScene as PlayletScene');
    expect(source).toContain('extends BasePlayletScene');
    expect(source).toContain("this.finish('success'");
    expect(manifest.renderer).toBe(renderer);
  });
});
