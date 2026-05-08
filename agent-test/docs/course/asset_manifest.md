# 课程资产与旁白 Manifest 协议

本文档约束课程链路中图片、普通音频、讲解 TTS 和可选视频的边界。普通游戏仍使用 `generate_game_assets`；课程旁白独立生成 narration manifest，避免把讲解音频混入普通 SFX 语义。

## 生成位置

```text
Course GDD
  -> mapCourseGddToOpenGameScaffold
  -> generate_game_assets 生成图片、BGM、SFX
  -> lessonin TTS 批量生成旁白
  -> 写入 narration manifest
  -> validate_course_package
```

## 普通素材

`CourseGDD.assetPlan.images` 和 `CourseGDD.assetPlan.audio` 继续交给 `generate_game_assets`：

- `images`：课程背景、角色、道具、关卡图。
- `audio[audioType=bgm]`：背景音乐。
- `audio[audioType=sfx]`：点击、答对、答错、通关等短音效。

普通素材产物仍写入 `public/assets/asset-pack.json`。课程模板代码引用普通素材时必须使用 asset key，不允许直接写死临时 URL。

## 课程 TTS

`CourseGDD.narrationPlan.segments` 只用于讲解、引导和反馈旁白。批量请求 lessonin-server 时必须使用后端标准结构：

```json
{
  "basePath": "course-id/audio/narration",
  "type": "mp3",
  "scriptList": [
    {
      "name": "lesson_intro",
      "script": "欢迎进入今天的课程。"
    }
  ]
}
```

字段规则：

- `basePath`：对象存储目录前缀，建议使用 `${courseId}/audio/narration`。
- `type`：MVP 1.0 固定为 `mp3`。
- `scriptList[].name`：文件名安全字符串，不能包含 `/`、`\` 或 `..`，同一请求内必须唯一。
- `scriptList[].script`：逐字稿正文，不包含舞台提示、文件名或实现说明。

响应中必须持久化 `data.items[].audio_uri`。`audio_url` 只允许用于当次预览或下载，不能写入课程长期配置作为唯一播放来源。

## Narration Manifest

TTS 成功后生成的 narration manifest 至少包含：

```ts
interface CourseNarrationManifest {
  courseId: string;
  basePath: string;
  type: 'mp3';
  outputDir: string;
  segments: Array<{
    id: string;
    name: string;
    targetScene: string;
    text: string;
    audio_uri?: string;
    local_path?: string;
    fallbackSubtitle: string;
    status: 'ready' | 'fallback_subtitle';
  }>;
  fallbackMode: 'none' | 'subtitle_only';
  warnings: string[];
}
```

`audio_uri` 是运行时换取临时播放 URL 的持久字段；`fallbackSubtitle` 是 TTS 失败或音频缺失时必须显示的字幕。

## 视频边界

视频只允许用于开场或章节过场，并且必须可关闭。监护人关闭生成视频时，Course GDD 和后续资产 manifest 都不能要求视频作为必需资源。

## 降级规则

- 图片失败：使用模板占位图或纯色背景，不阻断课程互动。
- 普通音效失败：关闭对应音效，不影响答题、反馈和学习报告。
- TTS 失败：生成 `subtitle_only` narration manifest，所有旁白分段显示字幕。
- 视频失败：跳过视频过场，直接进入课程场景。
