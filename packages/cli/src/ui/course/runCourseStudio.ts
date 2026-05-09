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
    '- 信息足够后，必须调用课程相关工具完成课程规划、方案选择、质量检查、课程设计、模板生成、素材/旁白处理和课程包验证。',
    '- 这是生成入口，不是只做方案预览；如果课程工具返回推荐方案或推荐 selectedPlanId，并且没有用户额外偏好冲突，就自动选择质量最高且实现稳定的推荐方案继续生成完整课程。',
    '- 课程生成必须先提炼用户核心诉求：用户真正想要的身份、操作、情绪、节奏、挑战和世界状态是什么。任何安全、版权或适龄改写都只能替换危险/侵权表象，不能删掉核心体验。',
    '- 课程必须从玩法分类库和 ready playlet 中选择可操作玩法，生成 `workflow`、`course_runtime` 和对应 playlet；不得绕过 Course GDD mapper 手写 React/Vite 静态题目页。',
    '- 课程必须把知识点做成真实互动游戏体验，不能只输出文字方案、静态页面、单按钮操作、连续选择题或明显模板换皮。',
    '- 用户偏好必须语义保真：喜欢侦探就保留搜证/推理/排除嫌疑；喜欢建造就保留放置/拼装/升级/验收；喜欢经营就保留资源分配/收益风险/调度；喜欢动作就保留瞄准/移动/节奏/命中。危险元素只替换表象，例如真实枪械改成水枪、泡沫飞镖或能量靶，不得退化成抽象泡泡或普通答题。',
    '- 课程 workflow 至少包含 3 个 playlet 节点，并至少覆盖 2 类学生核心动作；如果用户偏好强烈或主题复杂，应包含 4 个以上节点和更丰富的状态推进。',
    '- AI 必须在受控边界内发挥创造力：为每门课设计独特角色、任务目标、状态变化、奖励、错因反馈、素材 prompt 和过场构想；禁止生成一眼能看出是同一套模板替换题干的课程。',
    '- 课程素材必须服务玩法：调用 `generate_game_assets` 生成或登记关键图片、BGM、SFX；图片至少覆盖主场景、角色/引导员、关键道具和正确/错误反馈状态，不得只靠 CSS 色块或 emoji 作为完整视觉方案。',
    '- 如果监护人策略允许视频，优先规划 1 个可选开场或章节过场视频，并通过 `generate_game_assets` 的 video 能力或明确降级路径处理；视频失败不能阻断主流程，但必须在时间线中说明。',
    '- 讲解旁白必须调用 `course_tts_manifest`；TTS 失败时生成字幕降级 manifest，不要把未调用旁白工具说成已完成。',
    '- 学生看到的任务、按钮和反馈要用游戏目标表达，不要把内部教学目标直白暴露给学生。',
    '- 生成过程中如果质量检查、构建或验证失败，按课程修复流程修正后再继续。',
    '- 如果当前权限模式不允许执行构建、预览或浏览器 smoke 所需命令，不要伪造验证结果；先完成能完成的文件生成和课程包验证，并在最终回复中写清需要用户用更高权限重跑的命令。',
    `- 默认输出目录使用 ${DEFAULT_OUTPUT_DIR}，除非用户另有要求。`,
    '',
    '最终回复需要包含：',
    '- 课程生成结果位置。',
    '- 如何启动或预览课程。',
    '- 本次生成时间线：列出从需求解析、方案生成、质量评分、GDD、scaffold、图片/音效/视频素材、TTS/字幕、验证到预览的关键步骤及成功/失败状态。',
    '- 链路走向和参考资料：说明使用了哪些课程工具、玩法分类依据、模板/playlet、质量门禁和验证协议，便于复盘问题。',
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
