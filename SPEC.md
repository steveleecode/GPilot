# Google Calendar Bulk Event Selector

## 1. Product Summary

Build a lightweight Chrome extension that adds native-looking bulk event selection to Google Calendar.

The extension should visually blend into Google Calendar so closely that it feels like a built-in Calendar feature.

The core interaction is:

1. User opens Google Calendar.
2. Calendar appears normal.
3. When the user hovers over an event, a small circular selection control appears in the event's corner.
4. Clicking the circle selects the event.
5. The circle becomes Google blue with a white checkmark.
6. Once at least one event is selected, a small floating bulk-action toolbar appears near the top-center of the Calendar interface.
7. The toolbar shows the number of selected events and a `Delete` action.
8. The user can select multiple events.
9. Clicking `Delete` deletes the selected events.
10. When no events are selected, the toolbar disappears.

The extension should be extremely lightweight and unobtrusive.

---

# 2. Design Principle

The extension should look native to Google Calendar.

Do NOT create a visually distinct third-party design system.

Match:

* Google Calendar spacing
* Google Sans / Roboto-style typography
* Google's neutral grays
* Google's blue accent
* Calendar's border radius
* Calendar's shadows
* Calendar's hover behavior
* Calendar's button sizing
* Material-style tooltips
* Calendar's existing visual density

The extension UI should feel like something Google itself added.

---

# 3. MVP Scope

The first version only needs:

* Detect visible Google Calendar events
* Add a selection control to each event
* Show the control only on hover
* Select and deselect individual events
* Visually indicate selected events
* Maintain selection while navigating around the currently rendered Calendar view
* Show a floating selection toolbar when one or more events are selected
* Display selection count
* Delete selected events
* Allow `Esc` or `Cancel` to clear selection
* Automatically clean up stale selections when Calendar changes views

Do not add unnecessary features.

---

# 4. Non-Goals for MVP

Do NOT implement yet:

* Moving multiple events
* Copying events
* Changing event colors
* Dragging selected events
* AI functionality
* Calendar analytics
* Multi-user collaboration
* Bulk editing event titles
* Settings pages
* Complex onboarding
* Account creation
* External backend
* Database
* Cloud sync

The architecture may support future bulk actions, but they should not appear in the MVP.

---

# 5. Target Website

Initial support:

`https://calendar.google.com/*`

Chrome Manifest V3.

The extension should only inject functionality into Google Calendar.

---

# 6. Event Selection UI

## Default State

Calendar events should look completely unchanged.

There should NOT be visible checkboxes or circles everywhere.

## Hover State

When hovering over a Calendar event:

* Show a small circular selection button
* Position it in the event's upper-right corner
* It should sit inside or immediately over the event
* Approximately 16–18px diameter
* White or lightly translucent background
* Thin gray border
* Subtle shadow if necessary for contrast
* Pointer cursor
* Smooth ~100–150ms opacity transition

It should look like a native Material selection control.

The control should not interfere with:

* Opening the event
* Dragging events
* Resizing events
* Existing Calendar event controls

## Selected State

After clicking the circle:

* Circle remains visible even when not hovering
* Fill becomes Google blue
* Use approximately `#1A73E8`
* White checkmark appears inside
* Event receives a very subtle selected treatment

Possible selected treatment:

* Slight blue outline
* Slight translucent blue overlay

Keep this subtle.

Do not dramatically recolor the entire event.

---

# 7. Interaction Behavior

Clicking the selection circle MUST NOT open the Calendar event.

Use appropriate event handling:

* `preventDefault()`
* `stopPropagation()`

where necessary.

Clicking anywhere else on an event should preserve normal Google Calendar behavior.

The extension must not break:

* single click
* double click
* drag
* resize
* context interactions

---

# 8. Selection Toolbar

When `selectedEvents.size > 0`, display a floating bulk-selection toolbar.

Preferred placement:

Top-center of the visible Calendar content area.

It should visually resemble a Google Material floating surface.

Example layout:

`3 selected     Delete     ×`

Possible later expansion:

`3 selected | Move | Duplicate | Delete | More`

But MVP should only expose Delete.

## Toolbar Style

Approximately:

* white background
* subtle gray border
* rounded corners around 20–24px
* Material-style shadow
* height around 40–44px
* horizontally centered
* high enough z-index to stay above Calendar
* not attached awkwardly to browser chrome
* should float within the webpage itself

Example:

┌──────────────────────────────┐
│  3 selected       Delete  ×  │
└──────────────────────────────┘

The toolbar should animate in subtly.

For example:

* fade
* 4–8px vertical slide

Do not use a large modal.

---

# 9. Cancel / Clear Selection

Clicking the `×`:

* clears all selected events
* removes selected styling
* hides toolbar

Pressing `Escape` should do the same.

---

# 10. Delete Behavior

Clicking `Delete` should initiate deletion of all selected events.

Important:

Do not directly manipulate Google Calendar's backend using undocumented network requests.

For the initial implementation, prefer interacting with Google Calendar through the UI in a way that preserves Google's own delete behavior.

The deletion system should be encapsulated behind:

```ts
interface BulkAction {
  execute(events: SelectedCalendarEvent[]): Promise<void>;
}
```

Example:

```ts
class DeleteEventsAction implements BulkAction {
  async execute(events: SelectedCalendarEvent[]) {
    // implementation
  }
}
```

This allows a future implementation using the official Google Calendar API without rewriting the selection UI.

If reliable automatic deletion cannot safely be achieved through the DOM, provide an intermediate confirmation workflow rather than building against unstable private APIs.

---

# 11. Confirmation

Before deleting multiple events, show a lightweight confirmation UI.

Example:

`Delete 4 events?`

Buttons:

`Cancel`
`Delete`

Keep it visually consistent with Google Calendar.

For exactly one event, confirmation may still be shown for consistency.

Never silently bulk-delete calendar events.

---

# 12. Event Representation

Internally create a normalized event representation.

```ts
interface SelectedCalendarEvent {
  id: string;
  element: HTMLElement;
  title?: string;
  startTime?: string;
  endTime?: string;
}
```

Do not make the rest of the extension depend directly on Google's DOM structure.

Create an adapter layer.

Example:

```ts
interface CalendarAdapter {
  findEvents(): HTMLElement[];
  getEventId(element: HTMLElement): string;
  getEventMetadata(element: HTMLElement): CalendarEventMetadata;
}
```

Google Calendar implementation:

```ts
class GoogleCalendarAdapter implements CalendarAdapter {
  // Calendar-specific DOM interpretation
}
```

This is important because Google can change its markup.

---

# 13. DOM Observation

Google Calendar is a SPA.

Do NOT assume events only render once.

Use a `MutationObserver` to detect:

* initial event rendering
* week changes
* day changes
* month changes
* scrolling
* Calendar navigation
* events being dynamically inserted
* events being removed
* switching between Calendar views

Avoid observing the entire document with unnecessarily expensive logic.

Debounce event discovery.

Example:

```ts
MutationObserver
    ↓
debounce
    ↓
scan calendar event containers
    ↓
decorate previously unseen events
```

Never decorate an event twice.

Use either:

```html
data-gcbulk-enhanced="true"
```

or a `WeakSet<HTMLElement>`.

Prefer a `WeakSet` where practical.

---

# 14. Selection State

Use a centralized state store.

Example:

```ts
interface SelectionState {
  selected: Map<string, SelectedCalendarEvent>;
}
```

Functions:

```ts
selectEvent(event)
deselectEvent(id)
toggleEvent(event)
clearSelection()
getSelectionCount()
```

UI should subscribe to state changes rather than independently managing state.

---

# 15. Component Structure

Suggested source structure:

```text
src/
  content/
    index.ts
    calendarObserver.ts

    adapters/
      CalendarAdapter.ts
      GoogleCalendarAdapter.ts

    selection/
      SelectionManager.ts
      eventDecorator.ts

    actions/
      BulkAction.ts
      DeleteEventsAction.ts

    ui/
      SelectionCircle.ts
      SelectionToolbar.ts
      ConfirmDialog.ts

    styles/
      calendar.css

  shared/
    constants.ts
    types.ts

manifest.json
```

Avoid React unless it meaningfully simplifies the toolbar.

For this tiny extension, prefer:

* TypeScript
* native DOM APIs
* CSS

No framework is required.

---

# 16. Styling Isolation

Avoid polluting Calendar's CSS.

Every extension class should use a unique prefix.

For example:

```text
gcbulk-
```

Examples:

```css
.gcbulk-selector
.gcbulk-selected
.gcbulk-toolbar
.gcbulk-toolbar-button
.gcbulk-confirm
```

Do not overwrite Google's global classes.

---

# 17. Visual Tokens

Centralize approximate Google-style design tokens.

```css
:root {
  --gcbulk-google-blue: #1a73e8;
  --gcbulk-google-blue-hover: #185abc;
  --gcbulk-text-primary: #202124;
  --gcbulk-text-secondary: #5f6368;
  --gcbulk-border: #dadce0;
  --gcbulk-surface: #ffffff;

  --gcbulk-radius-small: 4px;
  --gcbulk-radius-medium: 8px;
  --gcbulk-radius-pill: 24px;

  --gcbulk-shadow:
    0 1px 2px rgba(60,64,67,.30),
    0 2px 6px rgba(60,64,67,.15);
}
```

These can be refined visually.

---

# 18. Accessibility

Selection control:

```html
<button
  aria-label="Select event"
  aria-pressed="false"
>
```

Selected:

```html
aria-pressed="true"
```

Toolbar should be keyboard reachable.

Delete should be a real `<button>`.

Support:

* Tab
* Enter
* Space
* Escape

Do not rely exclusively on hover because keyboard users must still be able to interact with the selector.

---

# 19. Performance

This extension should feel invisible when not being used.

Requirements:

* no polling loop
* no frequent timers
* no backend requests
* no framework bundle unless necessary
* MutationObserver callbacks should be debounced
* don't repeatedly scan unchanged portions of the DOM
* use event delegation where practical

Target extension bundle should remain very small.

---

# 20. Architecture for Future Bulk Actions

The selection toolbar should be extensible.

Future actions might include:

```ts
type BulkActionType =
  | "delete"
  | "duplicate"
  | "move"
  | "color"
  | "export";
```

Potential future toolbar:

```text
5 selected

Move
Duplicate
Delete
•••
```

Do not implement these now.

Design the code so adding a new action does not require rewriting selection handling.

---

# 21. Manifest

Use Manifest V3.

Minimal permissions.

Prefer:

```json
{
  "manifest_version": 3,
  "name": "Calendar Bulk Select",
  "version": "0.1.0",
  "description": "Adds lightweight bulk selection controls to Google Calendar.",
  "content_scripts": [
    {
      "matches": ["https://calendar.google.com/*"],
      "js": ["content.js"],
      "css": ["calendar.css"]
    }
  ]
}
```

Only request additional permissions when implementation actually requires them.

Avoid broad permissions such as:

```text
<all_urls>
tabs
webRequest
```

unless absolutely necessary.

---

# 22. Important UX Requirement

Before selection:

Google Calendar should appear essentially identical to normal Google Calendar.

Hover:

```text
┌────────────────────────────┐
│ CS 2110                 ○  │
│ 10:10 AM                   │
└────────────────────────────┘
```

Selected:

```text
┌────────────────────────────┐
│ CS 2110                 ✓  │
│ 10:10 AM                   │
└────────────────────────────┘
```

Multiple selected:

```text
               ╭────────────────────────────╮
               │ 3 selected    Delete    ×  │
               ╰────────────────────────────╯
```

This simple interaction is the primary product experience.

---

# 23. Robustness

Google Calendar DOM selectors may change.

Therefore:

1. Keep selectors centralized inside `GoogleCalendarAdapter`.
2. Do not spread Google-specific selectors throughout the project.
3. Prefer semantic/accessibility attributes when sufficiently reliable.
4. Gracefully fail if the current Calendar layout cannot be recognized.
5. Do not modify an element unless it has been positively identified as an event.
6. Log debugging information only when development mode is enabled.

---

# 24. Development Mode

Create:

```ts
const DEBUG = false;
```

or equivalent build configuration.

Development logging can show:

* event detected
* event decorated
* event selected
* event deselected
* Calendar mutation detected
* toolbar mounted/unmounted

Production should remain quiet.

---

# 25. Acceptance Criteria

The MVP is complete when:

1. Opening Google Calendar causes no obvious visual change.
2. Hovering an event reveals one circular selector.
3. Moving the pointer away hides an unselected selector.
4. Clicking the selector selects the event.
5. Clicking it again deselects the event.
6. Selected controls stay visible.
7. Selecting one event reveals the toolbar.
8. Selecting additional events updates the count.
9. Clicking × clears the selection.
10. Pressing Escape clears the selection.
11. Clicking Delete triggers a confirmation.
12. Confirming runs the deletion workflow.
13. Calendar event clicking continues working normally.
14. Calendar event drag behavior continues working normally.
15. Navigating between Calendar dates does not produce duplicate selectors.
16. Switching Calendar views does not crash the extension.
17. UI closely resembles Google Calendar's native interface.
18. No external backend is required.
19. No user account is required.
20. Extension requests only minimal permissions.

---

# 26. Product Philosophy

Do not overbuild this.

The value proposition is:

> Google Calendar, but you can select multiple events.

The best implementation is the one where the user forgets they installed an extension because the selection controls feel like part of Calendar itself.
