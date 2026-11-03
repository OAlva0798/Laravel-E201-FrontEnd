# Editing guide

| I want to change...            | Edit this file                          |
|--------------------------------|-----------------------------------------|
| App name / theme               | src/config/site.config.js (SITE)        |
| API address                    | .env  (VITE_API_BASE_URL)               |
| Which role sees which page     | src/config/site.config.js (ROLE_TABS) — roleAccess.js reads it |
| Colors (gold / dark blue / white) | src/theme.css — change `--brand-navy` and `--brand-gold` |
| Dashboard status cards / windows | src/administrator/dashboardUtils.js (STATUS_CARDS, UPCOMING_WINDOWS) |
| Calling the API                | import { apiGet, apiPost } from src/lib/http.js |
| Reading the login token        | import { getToken } from src/lib/auth.js |
| Showing admin-written HTML     | <SafeHtml html={...} /> — never dangerouslySetInnerHTML |

## Security rules baked in
1. Token: sessionStorage by default; localStorage only if "Remember me".
2. All DB-authored HTML goes through an allow-list sanitizer (no scripts, handlers, styles, javascript: links).
3. No hardcoded server URLs; backup calls send the auth token.
4. CSP + referrer policy in index.html. .env is git-ignored.
5. UI role checks only hide buttons. The backend MUST enforce roles on every endpoint.

## Shared data (src/data/OrgDataContext.jsx)
One cached store for company / center / department / position / position level.
- Add another shared list: add one line to `ORG`.
- In a component: `const { center } = useOrgData("center")` → `center.list / .options / .map / .loading`.
- Outside React: `loadOrgList("center")` (employeeShared.js) – same cache.
- Cache lasts 1 min, refreshes automatically after any save/delete in CrudManager, and is wiped on sign-out.
- Not yet migrated: Profile.jsx, DepartmentPositionContent.jsx (they still fetch their own copies).

## "This content is blocked" message
Caused by the Content-Security-Policy. It is built in `vite.config.js` (production build only; dev is never blocked).
Add the missing source to the matching line: `frame-src` (iframes/previews), `img-src`, `media-src`, `connect-src` (API calls).
For stronger protection also send the same policy as an HTTP header from your web server.

## Colors (src/theme.css) — open theme-preview.html to see and try them
**Part 1 – Palette:** your 10 colors, each with `base / -hover / -light / -dark`
(blue, emerald, purple, rose, amber, cyan, indigo, orange, teal, slate). Edit a hex and everything using it follows.
Tailwind classes exist for every token: `bg-blue`, `bg-blue-hover`, `bg-emerald-light`, `text-rose-dark` ...

**Part 2 – Roles:** which palette color each job uses. To change a job, point its line at another color
(e.g. `--color-btn-primary: var(--color-indigo);`).

| Role | Token (default color) | Class |
|---|---|---|
| Headings | `--color-heading` (slate-dark) | `text-heading` |
| Paragraph | `--color-body` (slate) | `text-body` |
| Helper text / captions | `--color-muted` | `text-muted` |
| Form labels | `--color-label` (slate-hover) | `text-label` |
| Sign in / Submit / Save | `--color-btn-primary` (blue) | `btn btn-primary` |
| Cancel / Back | `--color-btn-secondary-*` (slate) | `btn btn-secondary` |
| Delete / Remove | `--color-btn-danger` (rose) | `btn btn-danger` |
| Add new / Create | `--color-btn-accent` (emerald) | `btn btn-accent` |
| Text / select / textarea | `--color-input-*` (focus = blue, error = rose) | `field` |
| Table header / row hover | `--color-th-*`, `--color-row-hover` | `table-head`, `table-row` |
| Badges | `--color-status-success/warning/danger/info-*` (emerald/amber/rose/blue) | `badge badge-success` ... |
| Sidebar | `--color-nav-*` (blue) | |
| Cards / borders | `--color-surface`, `--color-line` | `card`, `border-line` |

**Part 3 – Plumbing:** older classes (`bg-emerald-600`, `text-slate-500`, `border-rose-300`) follow the palette:
600 = base, 700 = hover, 100 = light, 800 = dark, other shades are blended from those.
violet -> purple, red -> rose, slate/gray -> the text/surface/border roles.
Dashboard status colors: `tone` in `STATUS_CARDS` (src/administrator/dashboardUtils.js).
JS that needs a color (SweetAlert): `themeColor("--color-rose")` from src/lib/theme.js.

## Dashboard (src/administrator/Dashboard.jsx)
Counts per employment status (click a card to list those employees), upcoming birthdays and work anniversaries
(7/30/60/90 days). Resigned and inactive staff are not listed in birthdays/anniversaries. Counts use the same rule
as the Employees page tabs. Visible only to roles that have the "employees" page (ROLE_TABS).
