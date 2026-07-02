## ADDED Requirements

### Requirement: Realtime search suggestions
The system SHALL provide real-time search suggestions when the user types at least 2 characters in the search box.

#### Scenario: Suggestions appear on typing
- **WHEN** user types 2 or more characters in the search box
- **THEN** a dropdown appears below the search box showing up to 6 TMDB search results with poster thumbnails

#### Scenario: Suggestions update as user continues typing
- **WHEN** user modifies the input after suggestions are already visible
- **THEN** the previous request is cancelled and new suggestions are fetched via TMDB `/3/search/multi`

#### Scenario: Clicking a suggestion navigates
- **WHEN** user clicks a suggestion item
- **THEN** the page navigates to a search for that title and the dropdown closes

#### Scenario: Keyboard navigation
- **WHEN** suggestions are visible and user presses ArrowDown
- **THEN** the first item is highlighted, and subsequent ArrowDown/ArrowUp move the highlight
- **WHEN** user presses Enter with an item highlighted
- **THEN** the page navigates to search for that title
- **WHEN** user presses Escape
- **THEN** the dropdown closes

#### Scenario: Dropdown closes on outside click
- **WHEN** suggestions are visible and user clicks outside the dropdown
- **THEN** the dropdown closes

#### Scenario: Loading state
- **WHEN** a suggestion request is in flight
- **THEN** a loading indicator is shown in the dropdown

#### Scenario: Empty results
- **WHEN** TMDB returns no results for the query
- **THEN** "未找到匹配结果" message is shown

#### Scenario: Error state
- **WHEN** the suggestion API fails
- **THEN** the dropdown closes silently without blocking search
