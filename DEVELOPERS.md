# Calendar Bulk Select development

This guide is for contributors and maintainers. End users should install the
extension from the Chrome Web Store link in the [main README](README.md).

## Requirements

- Node.js 20 or newer
- npm
- Google Chrome for local extension testing

## Build from source

Deletion uses the official Google Calendar API and Chrome's OAuth integration.
Before building a deletion-enabled development copy:

1. Create or select a project in Google Cloud and enable the Google Calendar API.
2. Configure its OAuth consent screen. While the app is in testing, add your
   Google account as a test user.
3. In Google Cloud Credentials, create an OAuth client of type **Chrome app**.
   Use the extension ID shown for GPilot on `chrome://extensions`.
4. Build with that client ID:

```bash
GPILOT_GOOGLE_OAUTH_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com" npm run build
```

The OAuth client ID is public application configuration, not a client secret.
Never add a client secret to this extension.

After loading the build, click GPilot's toolbar icon and choose **Connect Google
Calendar**. Chrome opens Google's authorization screen for the Calendar Events
scope. The same authorization flow is also available when Delete is used before
connecting.

For a selection-only build, the ordinary build command still works, but Delete
will report that OAuth is not configured.

```bash
npm ci
npm run typecheck
npm run build
```

The build creates `dist/` with the bundled content script, stylesheet, and
manifest. `dist/` is generated output and must not be committed.

## Load a development build in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and choose this project's `dist/` directory.
5. Open or reload [Google Calendar](https://calendar.google.com/).

After source changes, rebuild, reload the extension from `chrome://extensions`,
and then reload Google Calendar.

## Create a GitHub distribution

The `Build distribution` GitHub Actions workflow installs dependencies, checks
types, builds the extension, and packages the contents of `dist/` as a ZIP with
the extension manifest at the archive root.

- Run the workflow manually to create a downloadable workflow artifact.
- Push a tag beginning with `v` (for example, `v0.2.0`) to create a GitHub Release
  and attach the same ZIP to it.

Before tagging a release, keep the versions in `package.json`,
`package-lock.json`, and `manifest.json` in sync. The workflow uses only generated
output; neither `dist/` nor packaged files belong in the repository. Keep Chrome
signing keys, including `dist.pem`, private and never commit them.

## Architecture

- `src/content/index.ts` wires the content-script lifecycle together.
- `src/content/adapters/` contains all Google Calendar DOM knowledge.
- `src/content/calendarObserver.ts` performs debounced discovery in the Calendar
  content root.
- `src/content/selection/` owns selection state and event decoration.
- `src/content/ui/` contains accessible native-DOM controls.
- `src/content/actions/` keeps bulk actions independent from selection UI.
- `src/shared/` contains normalized types and constants.

## Current selector-dependent boundary

Google Calendar's event markup is private and can change. This scaffold uses only
conservative event candidates with event-specific data attributes and an
interactive role. Every uncertain selector is centralized and marked with a
`TODO(calendar-selector)` in `GoogleCalendarAdapter.ts`.

Selection state, event decoration, the toolbar, keyboard clearing, confirmation,
and the bulk-action pipeline are implemented. Deletion runs in the MV3 background
service worker through `chrome.identity` and the official Calendar Events delete
endpoint. The adapter conservatively decodes Calendar's rendered event identity;
unknown identifier shapes are refused instead of guessed. No private network
request is made.
