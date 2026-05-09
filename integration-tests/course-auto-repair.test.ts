/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  COURSE_GOLDEN_CASES,
  buildGoldenCasePlanOption,
} from '../packages/core/src/course/quality/goldenCases.js';
import { buildDefaultGuardianPolicy } from '../packages/core/src/course/product/guardianPolicy.js';
import {
  createAutoRepairLoopState,
  decideAutoRepair,
} from '../packages/core/src/course/quality/autoRepairLoop.js';

describe('MVP 3.0 课程自动修复集成', () => {
  it('质量失败会产出方案层修复尝试，不进入资产或浏览器', () => {
    const goldenCase = COURSE_GOLDEN_CASES[0]!;
    const state = createAutoRepairLoopState({
      sessionId: 'integration_repair_quality',
      profileId: 'profile_integration',
      artifacts: {
        courseSpec: goldenCase.expectedSpec,
        selectedPlan: buildGoldenCasePlanOption(goldenCase),
      },
    });
    const decision = decideAutoRepair({
      state,
      policy: buildDefaultGuardianPolicy('profile_integration'),
      issue: {
        target: 'quality',
        severity: 'blocking',
        message: '精彩度和教学深度低于门禁',
      },
    });

    expect(decision.status).toBe('continue');
    expect(decision.action).toBe('quality_gate_rewrite');
    expect(decision.attempt?.target).toBe('quality');
  });

  it('TTS 失败自动降级字幕，仍保留可发布前检查项', () => {
    const state = createAutoRepairLoopState({
      sessionId: 'integration_repair_tts',
      profileId: 'profile_integration',
    });
    const decision = decideAutoRepair({
      state,
      policy: buildDefaultGuardianPolicy('profile_integration'),
      issue: {
        target: 'tts',
        severity: 'warning',
        message: 'TTS 服务超时',
      },
    });

    expect(decision.status).toBe('fallback');
    expect(decision.action).toBe('subtitle_tts_fallback');
    expect(decision.fallbackChecks).toContain(
      '旁白 manifest 包含 fallbackSubtitle',
    );
  });
});
