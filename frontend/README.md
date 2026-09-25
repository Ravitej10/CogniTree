# CogniTree

Adaptive learning diagnostics for students. CogniTree maps what a student
knows down to the sub-topic and the thinking skill — not just a test score —
then builds the exact practice test that closes the gap.

## Pages

| Route | File | Purpose |
| --- | --- | --- |
| `/` | `src/pages/HomePage.jsx` | Marketing landing page |
| `/login` | `src/pages/LoginPage.jsx` | Returning-student login |
| `/signup` | `src/pages/SignupPage.jsx` | New account creation |
| `/dashboard` | `src/pages/DashboardPage.jsx` | Post-login mastery map (mocked data) |
| `/tree` | `src/pages/TreePage.jsx` | Full interactive knowledge tree |
| `*` | `src/pages/NotFoundPage.jsx` | 404 |

`src/components/TreeMotif.jsx` is the shared decorative branching-tree
illustration used across the marketing, auth, and dashboard pages.

`src/components/TopicTree.jsx` is the real, data-driven tree: subjects branch
into topics, topics into sub-topics, each colored by mastery. Nodes expand or
collapse on click, there's a search box that auto-expands the path to any
match, and selecting a node opens a detail panel with its mastery score and a
"Practice this topic" action. The sample data (`TREE_DATA`) lives at the top
of the file — swap it for a real API response once diagnostics data exists.

## Getting started

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`.

```bash
npm run build      # production build to /dist
npm run preview    # preview the production build locally
```

## Notes on the current state

- Auth is **mocked**: signup/login store a fake token and user object in
  `localStorage` and redirect to `/dashboard`. There is no backend yet.
- `DashboardPage.jsx` renders static sample topics so the route isn't empty —
  swap this for a real API call once diagnostics data exists.
- Styling uses Tailwind utility classes plus a small set of hex values
  (`#14231C` ink, `#2F6B4F` moss, `#E2A73E` amber, `#F7F8F4` cream,
  `#8B9A8C` sage) — consider moving these into `tailwind.config.js` `theme.colors`
  (already partially done) and switching the inline `style={{ }}` usages over
  to Tailwind classes for consistency.
- Fonts (Fraunces, Inter, IBM Plex Mono) are loaded via a per-page `@import`
  in a `<style>` tag. For production, move this into `index.html` or
  `src/index.css` so it's fetched once rather than per page.

## Next steps for production readiness

1. Wire real authentication (replace the `localStorage` mock in
   `SignupPage.jsx` / `LoginPage.jsx`).
2. Replace `DashboardPage.jsx`'s static `TOPICS` array with a real API call.
3. Add route protection so `/dashboard` redirects to `/login` when there's no
   `access_token`.
4. Centralize the Google Fonts `@import` and color tokens.

## Troubleshooting: page not displaying

- **Don't open `index.html` (root or `dist/`) directly in a browser.** It must
  be served — run `npm run dev`, or `npm run build` then `npm run preview`,
  and open the `http://localhost:...` URL it prints.
- **Blank white screen with something in the browser console?** An
  `ErrorBoundary` now wraps the app (`src/ErrorBoundary.jsx`), so a crash
  shows a readable message on-screen instead of a blank page — open the
  browser console (F12) for the full stack trace.
- **Home page works but `/dashboard`, `/tree`, etc. 404 after deploying?**
  Most static hosts need to be told to serve `index.html` for every route
  (this is a single-page app using client-side routing). This project ships
  `public/_redirects` (Netlify) and `vercel.json` (Vercel) for that. Other
  hosts need their own equivalent rewrite rule.
- **Still stuck?** Open the browser's dev tools → Console tab, copy the exact
  red error text, and share it — that pinpoints the real cause faster than
  guessing.
