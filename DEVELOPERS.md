# Calendar Bulk Select development

This guide is for contributors and maintainers. End users should install the
extension from the Chrome Web Store link in the [main README](README.md).

## Requirements

- Node.js 20 or newer
- npm
- Google Chrome for local extension testing

## Build from source

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
and the bulk-action pipeline are implemented. Automatic deletion intentionally
stops with a visible message and changes nothing until Calendar's event-opening,
delete-button, and completion selectors have been verified across supported
views. No private network request is made.
