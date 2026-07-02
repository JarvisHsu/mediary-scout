## Bug: 设置页网盘连接状态始终显示"未连接"

### 环境
- 项目：mediary-scout
- 文件：`apps/web/app/settings/page.tsx`

### 复现步骤
1. 连接非 115 网盘（如光鸭盘 / 夸克盘）
2. 进入设置页 → 网盘连接段
3. 观察状态徽章：始终显示"未连接"，即使已有网盘连接成功

### 根因
`Pan115Section` 组件中，状态徽章的判断条件只检查了 115 网盘：

```tsx
// ❌ 只判断 115 连接状态
{status.connected ? (
  <Badge variant="success">已扫码连接</Badge>
) : (
  <Badge variant="secondary">未连接</Badge>
)}
```

`getPan115ConnectionStatus()` 仅返回 115 网盘的连接状态，用户连接光鸭盘或夸克盘时 `status.connected` 始终为 `false`，导致徽章固定显示"未连接"。

### 修复方案
将判断条件从 115 专用状态改为检查所有已连接网盘：

```tsx
// ✅ 判断所有网盘
{drives.length > 0 ? (
  <Badge variant="success">已连接</Badge>
) : (
  <Badge variant="secondary">未连接</Badge>
)}
```

### 改动范围
- `apps/web/app/settings/page.tsx` 第 334-346 行

### 状态
已修复并部署。
