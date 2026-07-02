## Context

Mediary Scout 的搜索页目前是纯输入框 + 结果列表，交互较基础。已有针对搜索建议、热门推荐、智能助手、重新搜索的部分代码在 untracked 文件中，需要完善和集成。此外，用户无法手动对已追踪的节目触发重新采集——当首次采集结果不理想（配置缺失、字幕源不可用）时，只能等待不知何时到来的定时巡检（type3），体验较差。

## Goals / Non-Goals

**Goals:**
- 完善已部分实现的搜索建议、热门推荐、智能助手面板，确保加载态/空态/错误态完整
- 新增手动重新采集功能：在节目详情页和搜索结果中允许用户触发完整采集流水线
- 重新采集带频率限制（同一节目 10 分钟内最多一次）
- 所有新增组件支持明暗主题、响应式布局

**Non-Goals:**
- 不涉及采集流水线本身的逻辑修改（仅触发机制）
- 不涉及 TMDB/PanSou API 适配层改动
- 不改动现有工作流引擎（Worker/Agent）

## Decisions

### 1. 搜索建议：客户端防抖 + AbortController

已实现的 `search-suggestions.tsx` 使用 250ms 防抖 + AbortController 取消过期请求。保持此方案，仅补全加载/错误状态 UI。

### 2. 热门推荐：Server Component 数据获取

已在 `page.tsx` 的 `TrendingSection` async 组件中实现服务端获取。好处是不暴露 API Key，避免瀑布流请求。保持不变，仅优化错误降级。

### 3. 重新采集：新建独立 API 端点

已有 `POST /api/activity/retry` 仅处理 `failed` 状态。需要新建 `POST /api/workflows/recollect`。

**为什么不用现有 retry 端点？** retry 是 `failed → queued` 的单向状态转移，而 recollect 需要对 `succeeded/partial/no_coverage` 状态创建全新的 WorkflowRun（因为原运行已终结）。

**流程：**
```
用户点击 → Server Action → 
  ① 检查频率限制 (10min 窗口内同一 TMDB ID 是否已有 recollect)
  ② 查找该标题最近的 succeeded/partial/no_coverage WorkflowRun
  ③ 克隆新 WorkflowRun (status: queued) 
  ④ 记录 recollect 时间戳到缓存表
→ 返回 { success, message }
→ 前端轮询实时状态更新
```

### 4. 频率限制：复用 tmdb_search_cache 表模式

在 Postgres 中新增 `recollect_log` 表（`tmdb_id, storage_id, created_at`），10 分钟内同 ID 不允许重复触发。或直接用内存 Map + 数据库插入去重（简单场景可先只用数据库唯一约束）。

**实际采用方案：** 在 `workflow_runs` 表中查询 10 分钟内是否有同一标题的 recollect 触发的运行（通过 `created_at > NOW() - INTERVAL '10 minutes'`）。

### 5. 前端组件复用现有模式

参考 `title-action-buttons.tsx` 的 `useTransition + startTransition + router.refresh()` 异步模式，保持代码风格一致。

## Risks / Trade-offs

- **[风险] 重复排队**: 如果用户快速点击多次，可能创建重复 WorkflowRun → **缓解**: `isActiveWorkflowStatus` 检查 + 频率限制
- **[风险] 重新采集与正在进行的采集冲突**: 如果标题正在 `queued/running`，不应再创建重复的 re-collect → **缓解**: 先检查 `listActiveWorkflowRuns`，有活跃运行则拒绝
- **[权衡] 频率限制窗口**: 10 分钟可能太长/太短 → 先用 10 分钟，后续可做成配置项
