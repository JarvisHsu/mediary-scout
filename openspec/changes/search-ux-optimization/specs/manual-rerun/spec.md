## ADDED Requirements

### Requirement: Manual recollect trigger
The system SHALL allow users to manually trigger a re-collection workflow for a tracked title.

#### Scenario: Recollect button on show detail page
- **WHEN** user visits a show detail page for a tracked title that is NOT currently acquiring
- **THEN** a "重新采集" button is visible in the title header actions area

#### Scenario: Recollect button on search results
- **WHEN** user sees a search result card for a tracked title that is NOT currently acquiring
- **THEN** a "重新采集" icon button is visible on the candidate card

#### Scenario: Click recollect triggers workflow
- **WHEN** user clicks "重新采集"
- **THEN** a confirmation dialog appears explaining that this will re-run the full acquisition pipeline
- **WHEN** user confirms
- **THEN** a new WorkflowRun is created with status "queued" and the UI shows "获取中" state

#### Scenario: Recollect blocked during active acquisition
- **WHEN** the title has an active WorkflowRun (status: queued or running)
- **THEN** the recollect button is disabled with tooltip "已有采集任务进行中"

#### Scenario: Frequency limiting
- **WHEN** user has triggered a recollect for the same title within the last 10 minutes
- **THEN** the recollect button is disabled with tooltip "N 分钟前已触发，请稍后再试"
- **WHEN** 10 minutes have passed since the last recollect
- **THEN** the recollect button becomes active again

#### Scenario: Recollect creates fresh workflow
- **WHEN** recollect is triggered for a title with previous succeeded/partial/no_coverage runs
- **THEN** a new WorkflowRun is created (not the old one retried), preserving history

#### Scenario: Recollect for untracked search results
- **WHEN** user sees a search result for an untracked title
- **THEN** the recollect button is hidden (use normal "获取" instead)

### Requirement: Recollect API endpoint
The system SHALL provide a secure API endpoint for recollect operations.

#### Scenario: Successful recollect request
- **WHEN** a POST request is made to `/api/workflows/recollect` with valid `tmdbId` and `storageId`
- **THEN** the system creates a new WorkflowRun and returns `{ success: true, message: "已加入采集队列" }`

#### Scenario: Rate limited request
- **WHEN** a recollect request is made within 10 minutes of a previous recollect for the same title
- **THEN** the system returns `{ success: false, message: "请等待 X 分钟后再试" }`

#### Scenario: Blocked by active workflow
- **WHEN** the title has an active WorkflowRun
- **THEN** the system returns `{ success: false, message: "已有采集任务进行中" }`

#### Scenario: Untracked title
- **WHEN** the title has never been tracked
- **THEN** the system returns `{ success: false, message: "该节目尚未追踪，请先发起获取" }`
