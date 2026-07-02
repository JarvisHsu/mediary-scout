## ADDED Requirements

### Requirement: Trending recommendations on empty search
The system SHALL display trending movies and TV shows when the search page has no active query.

#### Scenario: Trending movies tab
- **WHEN** user visits the search page with no query
- **THEN** a "热门推荐" section appears with a "电影" tab selected by default showing trending movie posters, names, and years

#### Scenario: Trending TV shows tab
- **WHEN** user clicks the "剧集" tab
- **THEN** trending TV show posters, names, and years are displayed

#### Scenario: Clicking a trending card
- **WHEN** user clicks a trending card
- **THEN** the page navigates to search for that title

#### Scenario: Loading state
- **WHEN** trending data is being fetched
- **THEN** the page renders without the trending section (no blocking skeleton)

#### Scenario: No data available
- **WHEN** TMDB trending API returns empty results for both movies and TV shows
- **THEN** the trending section is not rendered

#### Scenario: API failure
- **WHEN** TMDB trending API call fails
- **THEN** the trending section is silently hidden without affecting page functionality

#### Scenario: Trending hidden during active search
- **WHEN** user has an active search query
- **THEN** the trending section is not displayed

### Requirement: Responsive trending grid
The trending grid SHALL adapt to different screen sizes.

#### Scenario: Desktop layout
- **WHEN** viewport width is >= 768px
- **THEN** trending cards are displayed in a 6-column grid

#### Scenario: Mobile layout
- **WHEN** viewport width is < 768px
- **THEN** trending cards are displayed in a 3-column grid
