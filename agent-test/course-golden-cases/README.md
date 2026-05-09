# MVP 3.0 Golden Cases

本目录保留给 MVP 3.0 一句话生成端到端回归使用。

阶段 0 的 canonical golden cases 暂存于 `packages/core/src/course/quality/goldenCases.ts`，因为当前验证需要直接复用 `validateCourseSpec()`、ready playlet 检查和精彩度评分单元测试。后续阶段 6 接入端到端回归时，再从该 TypeScript 数据源生成或映射到本目录下的文件型 case，避免同一基准维护两份内容。
