/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { mapCourseGddToOpenGameScaffold } from './courseGddMapper.js';
import { buildCourseGdd } from './courseGddMapper.fixtures.js';
import type { CourseGDD } from './schemas.js';

describe('mapCourseGddToOpenGameScaffold round 9 playlets', () => {
  it('按 workflow 注册第九轮新增的真实 playlet Scene', () => {
    const result = mapCourseGddToOpenGameScaffold(buildRound9CourseGdd());
    const main = getGeneratedText(result, 'src/main.ts');

    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene1 } from './playlets/playlet-等式平衡';",
    );
    expect(main).toContain(
      "game.scene.add('等式平衡PlayletScene', WorkflowPlayletScene1);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene2 } from './playlets/playlet-图形拼装';",
    );
    expect(main).toContain(
      "game.scene.add('图形拼装PlayletScene', WorkflowPlayletScene2);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene3 } from './playlets/playlet-开关组合';",
    );
    expect(main).toContain(
      "game.scene.add('开关组合PlayletScene', WorkflowPlayletScene3);",
    );
  });
});

function getGeneratedText(
  result: ReturnType<typeof mapCourseGddToOpenGameScaffold>,
  pathSuffix: string,
): string {
  const generatedFile = result.writeFiles.find((file) =>
    file.path.endsWith(pathSuffix),
  );
  if (!generatedFile || typeof generatedFile.content !== 'string') {
    throw new Error(`测试需要 scaffold 输出 ${pathSuffix} 文本。`);
  }
  return generatedFile.content;
}

function buildRound9CourseGdd(): CourseGDD {
  const gdd = buildCourseGdd('course_grid');
  gdd.selectedPlan.workflow = {
        startNodeId: 'equation',
        nodes: [
          {
            id: 'equation',
            playletId: 'playlet-等式平衡',
            goalIds: ['goal_1'],
            config: {
              prompt: '补全等式。',
              terms: [
                { id: 'left_base', label: '7', value: 7, side: 'left' },
                { id: 'right_base', label: '9', value: 9, side: 'right' },
              ],
              slots: [
                {
                  id: 'left_gap',
                  label: '左侧空格',
                  side: 'left',
                  accepts: 'five',
                },
                {
                  id: 'right_gap',
                  label: '右侧空格',
                  side: 'right',
                  accepts: 'three',
                },
              ],
              options: [
                { id: 'five', label: '5', value: 5 },
                { id: 'three', label: '3', value: 3 },
              ],
              successCriteria: '左右相等。',
            },
            styleBindingId: 'default',
          },
          {
            id: 'shape',
            playletId: 'playlet-图形拼装',
            goalIds: ['goal_1'],
            config: {
              prompt: '拼装面积模型。',
              pieces: [
                { id: 'rect_long', label: '长条矩形', shape: 'rect' },
                { id: 'marker', label: '单位标记', shape: 'circle' },
              ],
              slots: [
                { id: 'slot_a', label: '主体区域', accepts: 'rect_long' },
                { id: 'slot_b', label: '单位标记', accepts: 'marker' },
              ],
              successCriteria: '拼装正确。',
            },
            styleBindingId: 'default',
          },
          {
            id: 'switches',
            playletId: 'playlet-开关组合',
            goalIds: ['goal_2'],
            config: {
              prompt: '调整学习模式。',
              switches: [
                {
                  id: 'example',
                  label: '显示例题',
                  initialOn: false,
                  targetOn: true,
                },
                {
                  id: 'hard_mode',
                  label: '挑战模式',
                  initialOn: true,
                  targetOn: false,
                },
              ],
              successCriteria: '开关组合正确。',
            },
            styleBindingId: 'default',
          },
        ],
        edges: [
          { from: 'equation', to: 'shape', when: 'success' },
          { from: 'shape', to: 'switches', when: 'success' },
        ],
        recoveryPolicy: 'hint_then_retry',
  };
  return gdd;
}
