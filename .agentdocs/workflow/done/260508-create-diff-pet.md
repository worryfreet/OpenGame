# 创建 Diff Codex 宠物

## 目标

基于用户在当前项目中体现出的工程偏好，创建一个 Codex 兼容的自定义宠物。宠物应体现务实、重视代码质量、文档约束和审查边界的工程伙伴气质，但不做真人肖像化表达。

## 设计约束

- 宠物名称：`Diff`。
- 视觉定位：小型像素风 Codex 宠物，显示器头、暖白屏幕脸、青绿色状态灯、炭灰身体和简洁折角文档补丁。
- 不使用可读文字、代码片段、UI 面板、悬浮符号、阴影、速度线或漂浮特效。
- 遵循 `hatch-pet` 技能流程：主形象先生成，姿态行基于主形象作为 canonical reference。
- 姿态行生成按技能要求应使用子代理；若工具策略不允许或需要用户明确授权，则在主形象后暂停确认。

## 阶段计划

- [x] 准备运行目录、任务清单和 imagegen 任务 manifest。
- [x] 生成并记录 Diff 主形象。
- [x] 获取用户对使用子代理生成姿态行的授权。
- [x] 生成姿态行，必要时镜像 `running-left`。
- [x] 合成 spritesheet，检查 contact sheet、validation 和 preview。
- [x] 打包到 `${CODEX_HOME:-$HOME/.codex}/pets/diff/`。

## 当前状态

已完成。

产物：

- 运行目录：`.agentdocs/pet-runs/diff/`
- 最终 spritesheet：`.agentdocs/pet-runs/diff/final/spritesheet.webp`
- contact sheet：`.agentdocs/pet-runs/diff/qa/contact-sheet.png`
- validation：`.agentdocs/pet-runs/diff/final/validation.json`
- review：`.agentdocs/pet-runs/diff/qa/review.json`
- Codex 宠物包：`/Users/shawn/.codex/pets/diff/`

验证结果：

- `finalize_pet_run.py` 完成提帧、帧检查、atlas 合成、atlas 验证、contact sheet、preview videos 和打包。
- `validation.json` 中 `errors=[]`、`warnings=[]`。
- `qa/review.json` 中 `errors=[]`、`warnings=[]`。
- contact sheet 目检通过，身份一致，未见明显裁切、游离特效或禁用效果。

执行记录：

- 2026-05-08 按用户要求重新读取新版 `/Users/shawn/.codex/skills/.system/imagegen/SKILL.md`。
- 用户说明 `IMAGEGEN_*` 变量在 `~/.zshrc` 中。通过 `source ~/.zshrc` 读取 `IMAGEGEN_API_KEY`、`IMAGEGEN_BASE_URL=https://tokenutopia.ai/v1`、`IMAGEGEN_MODEL=gpt-image-2-reverse`。
- `hatch-pet` 二级脚本 `generate_pet_images.py` 写死官方 API 地址，无法直接使用该 base URL。改用 `$imagegen` CLI/SDK 路径，并临时映射 `IMAGEGEN_API_KEY` 到 `OPENAI_API_KEY`、`IMAGEGEN_BASE_URL` 到 `OPENAI_BASE_URL`。
- 兼容端返回 URL 型图片结果，使用 Bearer 鉴权下载到 `/Users/shawn/.codex/generated_images/diff-pet/` 后按 hatch-pet provenance 记录。
- 姿态行使用子代理并行生成：`idle`、`running-right`、`running-left`、`waving`、`jumping`、`failed`、`waiting`、`running`、`review`。
- `running-left` 未镜像：因为青绿色状态灯是单侧身份细节，镜像会改变身份语义，因此独立生成。
