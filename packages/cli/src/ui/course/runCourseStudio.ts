/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  promptToCourseSpec,
  type PromptToCourseSpecResult,
} from '@opengame/opengame-core';

export interface CourseStudioPromptInput {
  goal?: string;
}

const DEFAULT_OUTPUT_DIR = 'agent-test/games/generated-course';
const MAX_INTAKE_ROUNDS = 6;

export async function collectCourseStudioGoal(
  initialGoal = '',
): Promise<string> {
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    let goal = initialGoal.trim();
    if (!goal) {
      process.stdout.write(
        [
          '请输入学生的目标学习需求。',
          '可以写年级、学科、主题、学习目标和喜欢的玩法，例如：四年级数学，学习面积，喜欢太空探索。',
          '',
        ].join('\n'),
      );
      goal = await askRequired(rl, '学习需求：');
    }

    for (let round = 0; round < MAX_INTAKE_ROUNDS; round++) {
      const analysis = analyzeCourseStudioGoal(goal);
      if (analysis.courseSpec) {
        return goal;
      }
      if (analysis.blockedReasons.length > 0) {
        return goal;
      }

      const questions = analysis.requiredClarifications;
      if (questions.length === 0) {
        return goal;
      }

      process.stdout.write(
        [
          '',
          '还需要补充这些信息，补完后会继续生成课程：',
          ...questions.map(
            (question, index) => `${index + 1}. ${question.prompt}`,
          ),
          '',
        ].join('\n'),
      );
      const answer = await askRequired(rl, '补充信息：');
      goal = `${goal}\n${answer}`;
    }

    return goal;
  } finally {
    rl.close();
  }
}

export const promptForCourseStudioGoal = collectCourseStudioGoal;

export function buildCourseStudioPrompt({
  goal = '',
}: CourseStudioPromptInput = {}): string {
  const trimmedGoal = goal.trim();
  const request = trimmedGoal || '请先询问学生的目标学习需求。';

  return [
    '你正在帮助用户制作一门游戏化课程。',
    '',
    '用户会提供学生的目标学习需求。你的任务不是只给建议，而是沿用 OpenGame 原生生成链路、工具调用、配置、认证、沙箱与文件生成能力，最终产出一门可以运行和验收的游戏化课程。',
    '',
    '学生学习需求：',
    request,
    '',
    '工作要求：',
    '- 进入本任务前，CLI 已尽量收集年级、学科、主题、学习目标和讲解深度；不要再把普通追问作为最终结果，除非存在安全阻断或完全无法判断课程方向。',
    '- 信息足够后，调用课程相关工具完成课程规划、方案选择、质量检查、课程设计、模板生成、素材/旁白处理和课程包验证。',
    '- 这是生成入口，不是只做方案预览；如果课程工具返回推荐方案或推荐 selectedPlanId，并且没有用户额外偏好冲突，就自动选择质量最高且实现稳定的推荐方案继续生成完整课程。',
    '- 课程必须把知识点做成真实互动游戏体验，不能只输出文字方案或静态页面。',
    '- 学生看到的任务、按钮和反馈要用游戏目标表达，不要把内部教学目标直白暴露给学生。',
    '- 生成过程中如果质量检查、构建或验证失败，按课程修复流程修正后再继续。',
    '- 如果当前权限模式不允许执行构建、预览或浏览器 smoke 所需命令，不要伪造验证结果；先完成能完成的文件生成和课程包验证，并在最终回复中写清需要用户用更高权限重跑的命令。',
    `- 默认输出目录使用 ${DEFAULT_OUTPUT_DIR}，除非用户另有要求。`,
    '',
    '最终回复需要包含：',
    '- 课程生成结果位置。',
    '- 如何启动或预览课程。',
    '- 已完成的关键验证。',
    '- 如果仍有阻断项，清楚说明还缺什么信息或哪一步失败。',
  ].join('\n');
}

export function analyzeCourseStudioGoal(
  goal: string,
): Pick<
  PromptToCourseSpecResult,
  'courseSpec' | 'requiredClarifications' | 'blockedReasons'
> {
  const result = promptToCourseSpec({ text: goal });
  return {
    courseSpec: result.courseSpec,
    requiredClarifications: result.requiredClarifications,
    blockedReasons: result.blockedReasons,
  };
}

async function askRequired(
  rl: Awaited<
    ReturnType<(typeof import('node:readline/promises'))['createInterface']>
  >,
  prompt: string,
): Promise<string> {
  while (true) {
    const answer = (await rl.question(prompt)).trim();
    if (answer) {
      return answer;
    }
    process.stdout.write('输入不能为空，请重新输入。\n');
  }
}
