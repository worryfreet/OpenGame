/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IntakeMissingField } from '../product/intakeSession.js';

export interface IntentConfidenceInput {
  missingFields: IntakeMissingField[];
  inferredFieldCount: number;
  assumptionCount: number;
  safetyAdjustmentCount?: number;
  blockedReasonCount?: number;
}

export function calculateOneShotIntentConfidence(
  input: IntentConfidenceInput,
): number {
  const highImpactMissing = input.missingFields.filter(
    (field) => field.impact === 'high',
  ).length;
  const lowImpactMissing = input.missingFields.length - highImpactMissing;
  const inferredBonus = Math.min(input.inferredFieldCount, 6) * 0.035;
  const assumptionPenalty = input.assumptionCount * 0.035;
  const safetyPenalty = (input.safetyAdjustmentCount ?? 0) * 0.08;
  const blockedPenalty = (input.blockedReasonCount ?? 0) * 0.35;

  return clamp01(
    0.62 +
      inferredBonus -
      highImpactMissing * 0.2 -
      lowImpactMissing * 0.06 -
      assumptionPenalty -
      safetyPenalty -
      blockedPenalty,
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}
