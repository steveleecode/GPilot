import type { CalendarAdapter } from "./CalendarAdapter";
import type {
  CalendarDeleteResult,
  CalendarEventMetadata,
  SelectedCalendarEvent
} from "../../shared/types";
import { debugLog } from "../../shared/constants";

/**
 * All knowledge of Google Calendar's private, changeable DOM belongs here.
 * Candidate selectors are deliberately conservative: an element is returned only
 * when it has an event-specific data attribute as well as an interactive role.
 */
export class GoogleCalendarAdapter implements CalendarAdapter {
  // TODO(calendar-selector): Verify this against each supported Calendar view.
  private static readonly CALENDAR_ROOT_SELECTOR = '[role="main"]';

  // TODO(calendar-selector): Confirm the current event attributes in day, week,
  // month, schedule, and year views before treating support as complete.
  private static readonly EVENT_CANDIDATE_SELECTORS = [
    '[role="button"][data-eventid]',
    '[role="button"][data-eventchip]'
  ] as const;

  getObservationRoot(): HTMLElement | null {
    return document.querySelector<HTMLElement>(
      GoogleCalendarAdapter.CALENDAR_ROOT_SELECTOR
    );
  }

  findEvents(): HTMLElement[] {
    const root = this.getObservationRoot();
    if (!root) {
      return [];
    }

    const candidates = root.querySelectorAll<HTMLElement>(
      GoogleCalendarAdapter.EVENT_CANDIDATE_SELECTORS.join(",")
    );

    return Array.from(candidates).filter((element) => this.getEventId(element) !== null);
  }

  getEventId(element: HTMLElement): string | null {
    const id = element.dataset.eventid ?? element.dataset.eventchip;
    return id?.trim() || null;
  }

  getEventMetadata(element: HTMLElement): CalendarEventMetadata {
    // TODO(calendar-selector): Verify Calendar's accessible label format before
    // parsing structured start/end times. Until then, retain the label as a title.
    const label = element.getAttribute("aria-label")?.trim();
    const visibleTitle = element.querySelector<HTMLElement>("[data-text]")?.textContent?.trim();
    const title = visibleTitle || label;

    return title ? { title } : {};
  }

  async deleteEvent(
    _event: SelectedCalendarEvent
  ): Promise<CalendarDeleteResult> {
    debugLog("Delete requested, but no verified Calendar delete path is configured");

    // TODO(calendar-selector): Implement only after the event-opening target,
    // delete button, confirmation behavior, and completion signal are verified.
    // Do not replace this with calls to undocumented Google network endpoints.
    return {
      status: "unsupported",
      reason:
        "Automatic deletion is paused because this Google Calendar layout has not been verified. No events were changed."
    };
  }
}
