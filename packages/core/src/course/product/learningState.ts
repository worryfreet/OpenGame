/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SubjectLearningState {
  subject: string;
  weakPoints: string[];
  masteredGoals: string[];
  misconceptionTags: string[];
  hintUsageCount?: number;
  completionRate?: number;
  lastCoursePackageId?: string;
}

export interface LearningState {
  profileId: string;
  subjectStates: SubjectLearningState[];
}

export interface LearningReportSummary {
  profileId?: string;
  subject: string;
  weakPoints?: string[];
  masteredGoals?: string[];
  misconceptionTags?: string[];
  hintUsageCount?: number;
  completionRate?: number;
  coursePackageId?: string;
  rawTranscript?: string;
  rawStudentInput?: string;
  studentName?: string;
}

export interface LearningMemoryStore {
  preferences: unknown[];
  learningStates: LearningState[];
}

export function createEmptyLearningState(profileId: string): LearningState {
  if (!profileId.trim()) {
    throw new Error('LearningState 必须通过 profileId 关联学生档案。');
  }

  return {
    profileId,
    subjectStates: [],
  };
}

export function updateLearningStateFromReport(
  state: LearningState,
  report: LearningReportSummary,
): LearningState {
  if (report.profileId && report.profileId !== state.profileId) {
    throw new Error('学习报告 profileId 必须与 LearningState 一致。');
  }

  const subject = report.subject.trim();
  if (!subject) {
    throw new Error('LearningReportSummary 必须包含 subject。');
  }

  const existing = state.subjectStates.find((item) => item.subject === subject);
  const nextSubjectState: SubjectLearningState = {
    subject,
    weakPoints: mergeTags(existing?.weakPoints ?? [], report.weakPoints ?? []),
    masteredGoals: mergeTags(
      existing?.masteredGoals ?? [],
      report.masteredGoals ?? [],
    ),
    misconceptionTags: mergeTags(
      existing?.misconceptionTags ?? [],
      report.misconceptionTags ?? [],
    ),
    ...(existing?.hintUsageCount !== undefined ||
    report.hintUsageCount !== undefined
      ? {
          hintUsageCount:
            (existing?.hintUsageCount ?? 0) +
            Math.max(report.hintUsageCount ?? 0, 0),
        }
      : {}),
    ...(report.completionRate !== undefined ||
    existing?.completionRate !== undefined
      ? {
          completionRate: report.completionRate ?? existing?.completionRate,
        }
      : {}),
    lastCoursePackageId:
      report.coursePackageId ?? existing?.lastCoursePackageId,
  };

  return {
    ...state,
    subjectStates: [
      ...state.subjectStates.filter((item) => item.subject !== subject),
      nextSubjectState,
    ],
  };
}

export function deleteLearningStateForProfile(
  state: LearningState,
  profileId: string,
): LearningState | undefined {
  return state.profileId === profileId ? undefined : state;
}

export function deleteProfileLearningMemory(
  store: LearningMemoryStore,
  profileId: string,
): LearningMemoryStore {
  return {
    preferences: store.preferences.filter(
      (item) => !hasProfileId(item, profileId),
    ),
    learningStates: store.learningStates.filter(
      (state) => state.profileId !== profileId,
    ),
  };
}

export function sanitizeLearningReportForPersistence(
  report: LearningReportSummary,
): Required<
  Pick<
    LearningReportSummary,
    'subject' | 'weakPoints' | 'masteredGoals' | 'misconceptionTags'
  >
> &
  Pick<
    LearningReportSummary,
    'profileId' | 'hintUsageCount' | 'completionRate' | 'coursePackageId'
  > {
  return {
    profileId: trimOptional(report.profileId),
    subject: report.subject.trim(),
    weakPoints: mergeTags([], report.weakPoints ?? []),
    masteredGoals: mergeTags([], report.masteredGoals ?? []),
    misconceptionTags: mergeTags([], report.misconceptionTags ?? []),
    hintUsageCount: report.hintUsageCount,
    completionRate: report.completionRate,
    coursePackageId: trimOptional(report.coursePackageId),
  };
}

function mergeTags(existing: string[], incoming: string[]): string[] {
  return [
    ...new Set(
      [...existing, ...incoming].map((value) => value.trim()).filter(Boolean),
    ),
  ];
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hasProfileId(item: unknown, profileId: string): boolean {
  return (
    typeof item === 'object' &&
    item !== null &&
    'profileId' in item &&
    (item as { profileId?: unknown }).profileId === profileId
  );
}
