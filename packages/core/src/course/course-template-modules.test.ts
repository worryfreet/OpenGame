/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

const courseTemplates = [
  {
    name: 'course_ui',
    sceneFile: 'CourseUIScenes.ts',
    transitionScene: 'LessonScene',
    systems: [
      'LessonProgressManager.ts',
      'HintManager.ts',
      'LearningReportManager.ts',
      'VideoTransitionManager.ts',
    ],
    docs: ['design_rules.md', 'template_api.md'],
  },
  {
    name: 'course_grid',
    sceneFile: 'CourseGridScenes.ts',
    transitionScene: 'GridLessonScene',
    systems: [
      'TaskObjectiveManager.ts',
      'StepFeedbackManager.ts',
      'VideoTransitionManager.ts',
    ],
    docs: ['design_rules.md', 'template_api.md'],
  },
  {
    name: 'course_td',
    sceneFile: 'CourseTDScenes.ts',
    transitionScene: 'ReviewPrepScene',
    systems: ['ReviewWaveProgressManager.ts', 'VideoTransitionManager.ts'],
    docs: ['design_rules.md', 'template_api.md'],
  },
];

describe('课程模板族结构', () => {
  it('生产构建不编译 headless 测试环境 setup', () => {
    const tsconfigPath = path.join(
      repoRoot,
      'agent-test/templates/core/tsconfig.json',
    );
    const parsed = ts.parseConfigFileTextToJson(
      tsconfigPath,
      readFileSync(tsconfigPath, 'utf8'),
    );
    const tsconfig = parsed.config as {
      compilerOptions: { types?: string[] };
      include?: string[];
      exclude?: string[];
    };

    expect(tsconfig.include).toContain('src');
    expect(tsconfig.exclude).toContain('src/test');
    expect(tsconfig.compilerOptions.types).toEqual([]);
  });

  it.each(courseTemplates)('提供统一课程配置和专用系统：$name', (template) => {
    const templateRoot = path.join(
      repoRoot,
      'agent-test/templates/modules',
      template.name,
    );
    const contentPath = path.join(templateRoot, 'src/courseContent.json');
    const typePath = path.join(templateRoot, 'src/courseContent.ts');
    const gameConfigPath = path.join(templateRoot, 'src/gameConfig.json');

    expect(existsSync(contentPath)).toBe(true);
    expect(existsSync(typePath)).toBe(true);
    expect(existsSync(gameConfigPath)).toBe(true);

    const content = JSON.parse(readFileSync(contentPath, 'utf8')) as {
      course: { archetype: string };
      learningGoals: unknown[];
      lessonUnits: unknown[];
      interactions: unknown[];
      assessments: unknown[];
      narration: { segments: unknown[] };
      videoTransitions?: unknown[];
      templateRules: { requiresFeedback: boolean };
    };

    expect(content.course.archetype).toBe(template.name);
    expect(content.learningGoals.length).toBeGreaterThan(0);
    expect(content.lessonUnits.length).toBeGreaterThan(0);
    expect(content.interactions.length).toBeGreaterThan(0);
    expect(content.assessments.length).toBeGreaterThan(0);
    expect(content.narration.segments.length).toBeGreaterThan(0);
    expect(Array.isArray(content.videoTransitions)).toBe(true);
    expect(content.templateRules.requiresFeedback).toBe(true);

    const gameConfig = JSON.parse(readFileSync(gameConfigPath, 'utf8')) as {
      screenSize?: { width?: unknown; height?: unknown };
      debugConfig?: { debug?: unknown };
      renderConfig?: { pixelArt?: unknown };
    };

    expect(gameConfig.screenSize?.width).toBeDefined();
    expect(gameConfig.screenSize?.height).toBeDefined();
    expect(gameConfig.debugConfig?.debug).toBeDefined();
    expect(gameConfig.renderConfig?.pixelArt).toBeDefined();

    for (const systemFile of template.systems) {
      expect(
        existsSync(path.join(templateRoot, 'src/systems', systemFile)),
      ).toBe(true);
    }
  });

  it.each(courseTemplates)(
    '视频过场接入可播放且可降级运行时：$name',
    (template) => {
      const templateRoot = path.join(
        repoRoot,
        'agent-test/templates/modules',
        template.name,
      );
      const managerSource = readFileSync(
        path.join(templateRoot, 'src/systems/VideoTransitionManager.ts'),
        'utf8',
      );
      const sceneSource = readFileSync(
        path.join(templateRoot, 'src/scenes', template.sceneFile),
        'utf8',
      );

      expect(managerSource).toContain('scene.cache.video.exists');
      expect(managerSource).toContain('scene.add');
      expect(managerSource).toContain('.video(');
      expect(managerSource).toContain("video.once('complete'");
      expect(managerSource).toContain('keydown-SPACE');
      expect(managerSource).toContain('视频资源未加载，已降级为静态过场');
      expect(sceneSource).toContain('playOptionalVideoTransition');
      expect(sceneSource).toContain(
        `getVideoTransitionForScene('${template.transitionScene}')`,
      );
    },
  );

  it.each(courseTemplates)('登记课程模板文档：$name', (template) => {
    const docsRoot = path.join(
      repoRoot,
      'agent-test/docs/modules',
      template.name,
    );

    for (const docFile of template.docs) {
      const docPath = path.join(docsRoot, docFile);
      expect(existsSync(docPath)).toBe(true);
      const content = readFileSync(docPath, 'utf8');
      expect(content).toContain('courseContent.json');
      expect(content).toContain(template.name);
    }
  });

  it('没有保留复制过程中产生的嵌套原模板目录', () => {
    const nestedDirs = [
      'agent-test/templates/modules/course_ui/ui_heavy',
      'agent-test/templates/modules/course_grid/grid_logic',
      'agent-test/templates/modules/course_td/tower_defense',
    ];

    for (const nestedDir of nestedDirs) {
      expect(existsSync(path.join(repoRoot, nestedDir))).toBe(false);
    }
  });
});
