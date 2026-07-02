## ADDED Requirements

### Requirement: Skill panel on search page
The system SHALL provide an AI-powered skill panel on the search page for advanced content discovery.

#### Scenario: Panel visibility
- **WHEN** user visits the search page with no active query
- **THEN** a collapsible "智能助手" panel is displayed below the trending section

#### Scenario: Panel hidden during active search
- **WHEN** user has an active search query
- **THEN** the skill panel is not displayed

#### Scenario: Expand and collapse
- **WHEN** user clicks the panel header
- **THEN** the panel expands or collapses with an animated transition

#### Scenario: Available skills
- **WHEN** the panel is expanded
- **THEN** four skill cards are shown: 电影推荐, 相似影片, 演员作品, 综合搜索

### Requirement: Execute a skill
The system SHALL allow users to select and execute a discovery skill.

#### Scenario: Select and execute movie recommendation
- **WHEN** user selects "电影推荐" skill, fills in genre and year parameters, and clicks execute
- **THEN** the system calls TMDB discover API and displays matching movie posters and names in a grid

#### Scenario: Select and execute similar movie
- **WHEN** user selects "相似影片" skill, enters a movie name, and clicks execute
- **THEN** the system first searches TMDB for the movie, then fetches similar movies and displays results

#### Scenario: Select and execute actor search
- **WHEN** user selects "演员作品" skill, enters an actor/director name, and clicks execute
- **THEN** the system searches for the person and displays their known works

#### Scenario: Select and execute multi-search
- **WHEN** user selects "综合搜索" skill, enters a keyword, and clicks execute
- **THEN** the system calls TMDB multi-search and displays both movie and TV results

#### Scenario: Clicking a skill result
- **WHEN** user clicks a result item from any skill
- **THEN** the page navigates to search for that title

#### Scenario: Loading state during execution
- **WHEN** a skill is being executed
- **THEN** the execute button shows a loading spinner and is disabled

#### Scenario: Empty skill results
- **WHEN** a skill execution returns no results
- **THEN** "未找到结果" message is displayed in the results area
