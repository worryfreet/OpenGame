/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadingLevel, StudentGrade } from '../schemas.js';

export interface TtsPreference {
  voice?: string;
  speed?: number;
  emotion?: string;
}

export interface StudentPreferenceProfile {
  profileId: string;
  grade: StudentGrade;
  interests: string[];
  preferredThemes: string[];
  preferredPalette?: string[];
  preferredGameplayTypes: string[];
  readingLevel: ReadingLevel;
  ttsPreference?: TtsPreference;
}

export interface RawPreferenceInput extends Partial<StudentPreferenceProfile> {
  studentName?: string;
  avatarUri?: string;
  voiceSampleUri?: string;
  rawConversation?: string;
  preciseTraits?: string[];
}

export interface PreferenceProfileUpdate {
  profileId: string;
  grade?: StudentGrade;
  interests?: string[];
  preferredThemes?: string[];
  preferredPalette?: string[];
  preferredGameplayTypes?: string[];
  readingLevel?: ReadingLevel;
  ttsPreference?: TtsPreference;
}

export const SENSITIVE_PREFERENCE_FIELDS = [
  'studentName',
  'avatarUri',
  'voiceSampleUri',
  'rawConversation',
  'preciseTraits',
] as const;

export function createPreferenceProfile(
  input: RawPreferenceInput,
): StudentPreferenceProfile {
  if (!input.profileId?.trim()) {
    throw new Error('StudentPreferenceProfile 必须包含 profileId。');
  }
  if (!input.grade) {
    throw new Error('StudentPreferenceProfile 必须包含小学年级。');
  }

  return {
    profileId: input.profileId,
    grade: input.grade,
    interests: dedupeNonEmpty(input.interests ?? []),
    preferredThemes: dedupeNonEmpty(input.preferredThemes ?? []),
    preferredPalette:
      input.preferredPalette && input.preferredPalette.length > 0
        ? dedupeNonEmpty(input.preferredPalette)
        : undefined,
    preferredGameplayTypes: dedupeNonEmpty(input.preferredGameplayTypes ?? []),
    readingLevel: input.readingLevel ?? 'medium',
    ttsPreference: input.ttsPreference
      ? sanitizeTtsPreference(input.ttsPreference)
      : undefined,
  };
}

export function sanitizePreferenceForPersistence(
  input: RawPreferenceInput,
): StudentPreferenceProfile {
  return createPreferenceProfile(input);
}

export function updatePreferenceProfile(
  profile: StudentPreferenceProfile,
  update: PreferenceProfileUpdate,
): StudentPreferenceProfile {
  assertSameProfile(profile.profileId, update.profileId);

  return {
    ...profile,
    grade: update.grade ?? profile.grade,
    interests: mergeList(profile.interests, update.interests),
    preferredThemes: mergeList(profile.preferredThemes, update.preferredThemes),
    preferredPalette: resolveOptionalList(
      profile.preferredPalette,
      update.preferredPalette,
    ),
    preferredGameplayTypes: mergeList(
      profile.preferredGameplayTypes,
      update.preferredGameplayTypes,
    ),
    readingLevel: update.readingLevel ?? profile.readingLevel,
    ttsPreference: update.ttsPreference
      ? sanitizeTtsPreference({
          ...profile.ttsPreference,
          ...update.ttsPreference,
        })
      : profile.ttsPreference,
  };
}

export function deletePreferenceProfileForProfile(
  profile: StudentPreferenceProfile,
  profileId: string,
): StudentPreferenceProfile | undefined {
  return profile.profileId === profileId ? undefined : profile;
}

function sanitizeTtsPreference(preference: TtsPreference): TtsPreference {
  return {
    voice: trimOptional(preference.voice),
    speed: preference.speed,
    emotion: trimOptional(preference.emotion),
  };
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function dedupeNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function mergeList(
  existing: string[],
  incoming: string[] | undefined,
): string[] {
  return incoming ? dedupeNonEmpty([...existing, ...incoming]) : existing;
}

function resolveOptionalList(
  existing: string[] | undefined,
  incoming: string[] | undefined,
): string[] | undefined {
  if (!incoming) {
    return existing;
  }

  const merged = dedupeNonEmpty([...(existing ?? []), ...incoming]);
  return merged.length > 0 ? merged : undefined;
}

function assertSameProfile(
  existingProfileId: string,
  updateProfileId: string,
): void {
  if (existingProfileId !== updateProfileId) {
    throw new Error('偏好记忆更新必须使用相同的 profileId。');
  }
}
