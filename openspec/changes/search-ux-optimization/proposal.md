## Why

搜索是用户最频繁的操作入口，当前搜索交互较基础（纯输入框 + 搜索结果列表），缺乏引导和便捷操作。同时用户经常遇到首次搜索不理想（配置未完成、字幕源缺失）需要手动重试采集的情况，但系统没有提供手动触发入口。这两个问题直接影响用户的日常使用效率和满意度。

## What Changes

- **搜索交互优化**：加入实时搜索建议下拉、热门推荐引导、智能助手面板（按类型推荐/相似影片/演员作品搜索）、重新搜索按钮（清除缓存重搜）
- **手动重试采集**：在节目详情页和搜索结果中增加"重新采集"按钮，支持用户手动触发完整采集流水线（TMDB 匹配 → 字幕查找 → 网盘转存），带频率限制防止滥用
- **UI 打磨**：统一搜索相关组件样式，确保明暗主题一致、加载状态完整

## Capabilities

### New Capabilities
- `search-suggestions`: 输入时实时展示 TMDB 搜索建议，支持键盘/鼠标交互
- `trending-recommendations`: 搜索空白页展示本周热门电影/剧集，引导用户发现内容
- `skill-panel`: 智能助手面板，提供按类型推荐、相似影片、演员作品搜索等高级发现能力
- `manual-rerun`: 用户手动触发单个节目的重新采集（完整搜索流水线），带频率限制

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **新增文件**：`components/search-suggestions.tsx`, `components/trending-recommendations.tsx`, `components/skill-panel.tsx`, `components/re-search-button.tsx`, `components/recollect-button.tsx`, `lib/skills.ts`, `lib/trending.ts`, `api/search-suggestions/`, `api/skills/`, `api/clear-search-cache/`, `api/recollect/`
- **修改文件**：`app/page.tsx`, `components/search-form.tsx`, `app/globals.css`, `app/show/[tmdbId]/page.tsx`
- **依赖**：TMDB API（已有配置），Postgres（已有），无新外部依赖
