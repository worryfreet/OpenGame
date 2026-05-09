/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tool name constants to avoid circular dependencies.
 * These constants are used across multiple files and should be kept in sync
 * with the actual tool class names.
 */
export const ToolNames = {
  EDIT: 'edit',
  WRITE_FILE: 'write_file',
  READ_FILE: 'read_file',
  READ_MANY_FILES: 'read_many_files',
  GREP: 'grep_search',
  GLOB: 'glob',
  SHELL: 'run_shell_command',
  TODO_WRITE: 'todo_write',
  MEMORY: 'save_memory',
  TASK: 'task',
  SKILL: 'skill',
  EXIT_PLAN_MODE: 'exit_plan_mode',
  WEB_FETCH: 'web_fetch',
  WEB_SEARCH: 'web_search',
  LS: 'list_directory',
  GENERATE_ASSETS: 'generate_game_assets',
  GENERATE_TILEMAP: 'generate_tilemap',
  GAME_TYPE_CLASSIFIER: 'classify_game_type',
  GENERATE_GDD: 'generate_gdd',
  COMPLETE_COURSE_INTAKE: 'complete_course_intake',
  GENERATE_ONE_SHOT_COURSE_PLAN: 'generate_one_shot_course_plan',
  GENERATE_COURSE_PLAN: 'generate_course_plan',
  SCORE_COURSE_QUALITY: 'score_course_quality',
  REPAIR_COURSE_GENERATION: 'repair_course_generation',
  RECORD_COURSE_EXPERIENCE: 'record_course_experience',
  GENERATE_STYLE_PREVIEW: 'generate_style_preview',
  REVISE_COURSE_PLAN: 'revise_course_plan',
  GENERATE_NEXT_COURSE_SPEC: 'generate_next_course_spec',
  GENERATE_COURSE_GDD: 'generate_course_gdd',
  COURSE_TTS_MANIFEST: 'course_tts_manifest',
  VALIDATE_COURSE_PACKAGE: 'validate_course_package',
  //COPY_TEMPLATE: 'copy_template',
} as const;

/**
 * Tool display name constants to avoid circular dependencies.
 * These constants are used across multiple files and should be kept in sync
 * with the actual tool display names.
 */
export const ToolDisplayNames = {
  EDIT: 'Edit',
  WRITE_FILE: 'WriteFile',
  READ_FILE: 'ReadFile',
  READ_MANY_FILES: 'ReadManyFiles',
  GREP: 'Grep',
  GLOB: 'Glob',
  SHELL: 'Shell',
  TODO_WRITE: 'TodoWrite',
  MEMORY: 'SaveMemory',
  TASK: 'Task',
  SKILL: 'Skill',
  EXIT_PLAN_MODE: 'ExitPlanMode',
  WEB_FETCH: 'WebFetch',
  WEB_SEARCH: 'WebSearch',
  LS: 'ListFiles',
  GENERATE_ASSETS: 'GenerateAssets',
  GENERATE_TILEMAP: 'GenerateTilemap',
  GAME_TYPE_CLASSIFIER: 'GameTypeClassifier',
  GENERATE_GDD: 'GenerateGDD',
  COMPLETE_COURSE_INTAKE: 'CompleteCourseIntake',
  GENERATE_ONE_SHOT_COURSE_PLAN: 'GenerateOneShotCoursePlan',
  GENERATE_COURSE_PLAN: 'GenerateCoursePlan',
  SCORE_COURSE_QUALITY: 'ScoreCourseQuality',
  REPAIR_COURSE_GENERATION: 'RepairCourseGeneration',
  RECORD_COURSE_EXPERIENCE: 'RecordCourseExperience',
  GENERATE_STYLE_PREVIEW: 'GenerateStylePreview',
  REVISE_COURSE_PLAN: 'ReviseCoursePlan',
  GENERATE_NEXT_COURSE_SPEC: 'GenerateNextCourseSpec',
  GENERATE_COURSE_GDD: 'GenerateCourseGDD',
  COURSE_TTS_MANIFEST: 'CourseTTSManifest',
  VALIDATE_COURSE_PACKAGE: 'ValidateCoursePackage',
  //COPY_TEMPLATE: 'CopyTemplate',
} as const;

// Migration from old tool names to new tool names
// These legacy tool names were used in earlier versions and need to be supported
// for backward compatibility with existing user configurations
export const ToolNamesMigration = {
  search_file_content: ToolNames.GREP, // Legacy name from grep tool
  replace: ToolNames.EDIT, // Legacy name from edit tool
} as const;

// Migration from old tool display names to new tool display names
// These legacy display names were used before the tool naming standardization
export const ToolDisplayNamesMigration = {
  SearchFiles: ToolDisplayNames.GREP, // Old display name for Grep
  FindFiles: ToolDisplayNames.GLOB, // Old display name for Glob
  ReadFolder: ToolDisplayNames.LS, // Old display name for ListFiles
} as const;
