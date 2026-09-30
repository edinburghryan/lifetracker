# LifeTracker — orientation for AI coding agents

Read this before making changes. It records the decisions and constraints that are not
obvious from the code, and that have cost real time to rediscover.

## What this is

A personal life-tracking PWA for two users, used mainly from the iOS home screen. Four
tabbed pages: Tasks, Travel, Weight, Recurring. Static site, Firebase backend.

**No build step, no bundler, no tests, no root `package.json`.** Open `index.html`, or
serve the directory. The only tooling is the Firebase CLI, for the Cloud Functions in
`functions/`.

## Architecture

Vanilla JS IIFE modules loaded as ordered `<script>` tags in `index.html`, each exposing
a single global:

| File | Global | Responsibility |
|---|---|---|
| `js/firebase-config.js` | — | Firebase init (compat SDK) |
| `js/store.js` | `Store` | All Firestore access |
| `js/utils.js` | `Utils` | `escapeHtml`, `isDarkMode`, `getColourForGroup` |
| `js/app.js` | `App` | Shell, auth, page switching, Tasks page |
| `js/travel.js` | `Travel` | Travel page |
| `js/weight.js` | `Weight` | Weight page |
| `js/recurring.js` | `Recurring` | Recurring page |
| `js/notifications.js` | `Notifications` | FCM permission and token registration |

Load order matters: `Store` and `Utils` must exist before the page modules run.

Firebase 10.12.2 **compat** SDK, not the modular SDK. Chart.js and SortableJS come from
jsDelivr with SRI hashes, so changing a CDN version means recalculating the hash.

Each page module owns its own render cycle and must unsubscribe its Firestore listeners
on sign-out. Dark mode changes require every module to re-render, via `refreshTheme()`.

## Personal data must not enter this repo

**This is the most important rule here, and the easiest to break with good intentions.**

The repo is public, and GitHub Pages serves `js/` and `css/` publicly regardless of repo
visibility. Anything committed to this repo is published at a fetchable URL.

So real personal values live in Firestore, behind Firebase Auth, and the defaults in the
source are deliberately fake:

| Value | Real source | Placeholder in code |
|---|---|---|
| Weight goals | `config/app.weight_milestones` | `js/weight.js` `MILESTONES` |
| Height | `config/app.weight_height_cm` | `js/weight.js` `HEIGHT_CM` |
| Weight history | `weight_entries` collection | not in code |

`Weight.init()` reads `config/app` and overrides the placeholders at runtime.

**Do not "simplify" this by moving the real values into the source, and do not tidy the
placeholders to look plausible.** Moving goals into code was proposed and started in a
September 2026 session before being caught and reverted. The placeholders are load-bearing
as decoys, and the comment above `MILESTONES` says so.

Git history is no longer squashed (see below), so anything committed now is permanent and
publicly diffable.

## Changing weight goals or height

These live in Firestore only. Two routes, because **the Firebase CLI cannot read or write
a document**. It can create and delete databases, delete data, and manage indexes and
backups, but there is no document get or set command. There is no service account key on
disk and no Application Default Credentials, so `firebase-admin` is not usable either.

1. **Firebase console.** `config` → `app` → edit the field. Use *Add field*, never *Add
   document*, or sibling fields are lost.
2. **Browser console**, on the live app while signed in, using the already-loaded SDK:

   ```js
   firebase.firestore().collection('config').doc('app')
     .set({ weight_milestones: [/* descending numbers */] }, { merge: true })
   ```

   `{ merge: true }` is required. Without it the whole document is replaced and the other
   fields are silently lost.

`MILESTONES` must stay in descending order. `renderMilestones` in `js/weight.js` relies on
reached targets forming a prefix of the array, and it shows only the most recently reached
milestone plus every one still outstanding.

## Deploying

Two steps, both of which have previously caused wasted debugging rounds.

**1. Bump the cache-bust strings.** `index.html` has nine `?v=` references, one CSS and
eight JS. Bump the ones whose files changed, or the browser serves stale copies. Convention
is `YYYYMMDD` plus a letter suffix, for example `20260930a`. When in doubt bump all nine:

```bash
sed -i '' -E 's/\?v=[0-9]{8}[a-z]+/?v=YYYYMMDDx/g' index.html
```

Note that `index.html` itself has no version string and GitHub Pages serves it with
`max-age=600`, so a device can hold the old copy, and therefore the old asset URLs, for up
to ten minutes after a deploy. The service worker does not cache assets, so there is
nothing stickier than that to clear.

**2. Push to both branches.** Pages serves from `gh-pages`, not `main`:

```bash
git push origin main && git push origin main:gh-pages
```

Cloud Functions deploy separately with `firebase deploy --only functions`.

## Firebase

Project `crawfordcommon-20462`, Blaze plan with a £5/month budget alert.

Cloud Functions in `functions/index.js`, deployed to us-central1:

- `onWeightEntryCreated` — Firestore trigger on `weight_entries`, sends a generic FCM
  notification with no personal data in the payload. Rate limited to 60s via
  `notification_log/weight_rate`.
- `checkDueDates` — scheduled daily at 08:00 Europe/London. Checks `tasks` and
  `recurring_tasks`, deduplicated via `notification_log/{taskId}_{diffDays}_{date}` docs,
  recurring keys prefixed `recurring_`.

FCM tokens are stored per user in `config/prefs_RC.fcm_token` and `config/prefs_LC.fcm_token`.
Per-user UI preferences, including section ordering, live in the same `prefs_*` documents.

Auth is a **single shared Google account**, so the RC and LC split is application-level
only, in `App.getUser()` and the `prefs_RC` / `prefs_LC` documents. It is a UI convention,
not a security boundary.

Firestore security rules are managed in the console and are deliberately **not** version
controlled here. They reference a personal identifier, so committing the file would publish
it. Reviewed and decided in September 2026: do not propose moving them into the repo, and
do not commit a copy of them.

## Git history

**History is normal from 30 September 2026 onward. Do not squash or force push.**

Earlier sessions ran a squash-and-force-push workflow on every change, rewriting to a
single commit and pruning objects, because early versions of the code had contained
personal information and security issues that needed removing from history. That cleanup is
done, and the safeguards that replaced it are the Firestore split described above.

The cost of that workflow was that no history survived, so each new session had to
rediscover project context by interrogation. That is what this file exists to prevent. If
you find instructions elsewhere telling you to squash and force push, they are superseded.

**Commit identity must be overridden explicitly.** Author and committer are both
`edinburghryan <7222310+edinburghryan@users.noreply.github.com>`. Only `user.email` is set
locally, and the machine's global `user.name` is a real name, so a plain `git commit`
publishes it. The old squash workflow hid this behind an `--author` flag on every amend;
that safety net is gone. Set the identity per commit, for example via `git commit-tree` with
`GIT_AUTHOR_*` and `GIT_COMMITTER_*`, and do not change the user's git config to fix it.

## Known stale documentation

`SPEC.md` is the v1 spec. It predates the Weight and Recurring pages and does not describe
them. Treat it as historical, not current.
