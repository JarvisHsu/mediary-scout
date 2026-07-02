## 1. Search Suggestions — Polish

- [ ] 1.1 Add keyboard navigation (ArrowDown/ArrowUp/Enter) to search suggestions dropdown
- [ ] 1.2 Add `key` prop reset on suggestions to clear highlight state when suggestions change

## 2. Recollect Backend — API & Logic

- [ ] 2.1 Create `POST /api/workflows/recollect` endpoint with validation and frequency limiting
- [ ] 2.2 Add `reCollectTitles` function in `apps/web/lib/workflow-runtime.ts` — create new WorkflowRun for tracked titles
- [ ] 2.3 Add Server Action `recollectAction` in `apps/web/actions.ts`

## 3. Recollect Frontend — Components

- [ ] 3.1 Create `apps/web/components/recollect-button.tsx` — client component with rate-limit awareness
- [ ] 3.2 Add recollect button to search result `CandidateCard` for tracked shows
- [ ] 3.3 Add recollect button to show detail page header for tracked shows

## 4. CSS & Styling

- [ ] 4.1 Add recollect button styles to `apps/web/app/globals.css`
- [ ] 4.2 Verify all new components work correctly in dark mode
