# Review guidelines — sf-frontend

Repository-specific guidance for code review (human or Qodo).

## Architecture
- The API is called only from the server: reads in server components, writes in server actions (`src/app/contacts/actions.ts`). `API_BASE_URL` never reaches the browser.
- `src/lib/contacts/api.ts` is the only module that knows endpoint shapes; `types.ts` mirrors `/openapi.json` in `snake_case`.
- Forms are driven by `CONTACT_FIELD_GROUPS` + the Zod schema in `src/lib/contacts/schema.ts`, whose limits mirror the API. The edit form submits via `PUT` (full replacement), so every persisted field must be carried through the form or it is wiped on save.

## UI
- Tailwind against the semantic tokens in `src/app/globals.css` (`bg-card`, `text-muted-foreground`, `border-hairline`, …); no hard-coded hex. Both themes must stay in sync.
- Accessibility: every control has a label, images have meaningful `alt` (or `alt=""` when decorative), interactive elements have accessible names, errors use `role="alert"` and `aria-describedby`.
- No hydration mismatches: anything rendered on both server and client must be deterministic.

## Tests
- Unit/component tests in `src/__tests__/` use MSW handlers, never mock `fetch`; query by role/label, not test ids. Behaviour changes ship with a Jest test, and user-visible flows with a Playwright spec in `e2e/`.

## Out of scope
- Formatting-only changes to untouched code; `jest.config.ts`/`jest.setup.ts` plumbing.
