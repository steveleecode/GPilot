# Calendar Bulk Select

A lightweight Manifest V3 Chrome extension that adds bulk-selection controls to
Google Calendar. It uses TypeScript, native DOM APIs, and isolated CSS—there is no
framework, backend, account, or access to undocumented Google APIs.

## Development

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run typecheck
npm run build
```

The build creates a loadable extension in `dist/` containing the bundled content
script, stylesheet, and manifest.

## Load unpacked in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and choose this project's `dist/` directory.
5. Open or reload [Google Calendar](https://calendar.google.com/).

After source changes, rebuild and click the extension's reload button on
`chrome://extensions`, then reload Calendar.

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
delete-button, and completion selectors have been verified across supported views.
No private network request is made.
