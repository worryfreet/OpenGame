/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import AjvPkg from 'ajv';
import { describe, expect, it } from 'vitest';
import { isReadyPlaylet } from '../playletCatalog.js';
import { validateCourseSpec } from '../validation.js';
import { scoreCourseExcitement } from './excitementRubric.js';
import {
  COURSE_GOLDEN_CASES,
  buildGoldenCasePlanOption,
  goldenCaseSchema,
  summarizeGoldenCaseCoverage,
} from './goldenCases.js';

// Ajv 的 ESM/CJS 互操作类型不稳定，这里与 validation.ts 保持一致。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AjvClass = (AjvPkg as any).default || AjvPkg;

describe('COURSE_GOLDEN_CASES', () => {
  it('每个 golden case 都符合结构 schema、CourseSpec 业务校验和 ready playlet 约束', () => {
    const ajv = new AjvClass({ allErrors: true, strictSchema: false });
    const validate = ajv.compile(goldenCaseSchema);

    for (const goldenCase of COURSE_GOLDEN_CASES) {
      expect({
        id: goldenCase.id,
        valid: validate(goldenCase),
        errors: validate.errors,
      }).toMatchObject({ valid: true });

      const specValidation = validateCourseSpec(goldenCase.expectedSpec);
      expect({
        id: goldenCase.id,
        valid: specValidation.valid,
        errors: specValidation.errors,
      }).toMatchObject({ valid: true, errors: [] });

      for (const playletId of goldenCase.expectedPlanDirection.playletIds) {
        expect({
          goldenCaseId: goldenCase.id,
          playletId,
          ready: isReadyPlaylet(playletId),
        }).toMatchObject({ ready: true });
      }
    }
  });

  it('覆盖 24 个跨学科、跨年级、跨风格基准样例', () => {
    const ids = new Set(COURSE_GOLDEN_CASES.map((item) => item.id));
    const prompts = new Set(
      COURSE_GOLDEN_CASES.map((item) => item.oneShotInput),
    );
    const coverage = summarizeGoldenCaseCoverage();

    expect(COURSE_GOLDEN_CASES).toHaveLength(24);
    expect(ids.size).toBe(COURSE_GOLDEN_CASES.length);
    expect(prompts.size).toBe(COURSE_GOLDEN_CASES.length);
    expect(
      Math.min(...Object.values(coverage.bySubject)),
    ).toBeGreaterThanOrEqual(4);
    expect(
      Math.min(
        ...COURSE_GOLDEN_CASES.map(
          (item) => coverage.byGrade[item.expectedSpec.studentProfile.grade],
        ),
      ),
    ).toBeGreaterThanOrEqual(1);
    expect(
      Math.min(
        coverage.byGradeBand.lower,
        coverage.byGradeBand.middle,
        coverage.byGradeBand.upper,
      ),
    ).toBeGreaterThanOrEqual(7);
  });

  it('每个 golden case 的默认方案达到最低精彩度门槛', () => {
    for (const goldenCase of COURSE_GOLDEN_CASES) {
      const review = scoreCourseExcitement({
        courseSpec: goldenCase.expectedSpec,
        plan: buildGoldenCasePlanOption(goldenCase),
      });

      expect({
        id: goldenCase.id,
        total: review.score.total,
        minimum: goldenCase.minimumExcitementScore,
      }).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
        }),
      );
      expect(review.score.total).toBeGreaterThanOrEqual(
        goldenCase.minimumExcitementScore,
      );
      expect({ id: goldenCase.id, passed: review.passed }).toMatchObject({
        passed: true,
      });
    }
  });
});
