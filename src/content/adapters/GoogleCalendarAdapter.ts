import type { CalendarAdapter } from "./CalendarAdapter";
import type {
  CalendarDeleteResult,
  CalendarEventMetadata,
  SelectedCalendarEvent
} from "../../shared/types";
import { debugLog } from "../../shared/constants";

type CalendarLayout = "day-week" | "month" | "unknown";

interface EventEvidence {
  attribute: "data-eventid" | "data-eventchip";
  rawId: string;
  reason: string;
}

interface NormalizedCandidate {
  event: SelectedCalendarEvent;
  evidence: EventEvidence;
  layout: CalendarLayout;
}

/**
 * All knowledge of Google Calendar's private, changeable DOM belongs here.
 * Discovery is intentionally conservative. An element must carry an event-specific
 * data attribute, be interactive, be visible, and live inside Calendar's main
 * surface. Generated/obfuscated class names are never used for identification.
 */
export class GoogleCalendarAdapter implements CalendarAdapter {
  private static readonly CALENDAR_ROOT_SELECTOR = '[role="main"]';

  /**
   * data-eventid is the primary evidence observed on interactive event chips in
   * common day/week and month layouts. data-eventchip is retained as a narrowly
   * scoped secondary strategy for Calendar variants that expose it.
   *
   * TODO(calendar-selector): Revalidate these attributes periodically against
   * authenticated day, week, and month views. They are private Calendar markup,
   * even though they are much less brittle than generated CSS class names.
   */
  private static readonly EVENT_CANDIDATE_SELECTORS = [
    "[data-eventid]",
    "[data-eventchip]"
  ] as const;

  private static readonly INTERACTIVE_DESCENDANT_SELECTOR =
    '[role="button"],button,[tabindex]:not([tabindex="-1"])';

  getObservationRoot(): HTMLElement | null {
    return document.querySelector<HTMLElement>(
      GoogleCalendarAdapter.CALENDAR_ROOT_SELECTOR
    );
  }

  findEvents(): SelectedCalendarEvent[] {
    const root = this.getObservationRoot();
    if (!root) {
      debugLog("Calendar event scan skipped", {
        reason: "No [role=main] Calendar surface is currently mounted"
      });
      return [];
    }

    const attributeCandidates = root.querySelectorAll<HTMLElement>(
      GoogleCalendarAdapter.EVENT_CANDIDATE_SELECTORS.join(",")
    );
    const normalizedByElement = new Map<HTMLElement, NormalizedCandidate>();

    for (const attributeElement of attributeCandidates) {
      const evidence = this.getEventEvidence(attributeElement);
      if (!evidence) {
        continue;
      }

      const eventElement = this.resolveInteractiveEventElement(attributeElement);
      if (!eventElement || normalizedByElement.has(eventElement)) {
        continue;
      }

      if (!this.isVisibleEventElement(eventElement, root)) {
        debugLog("Calendar event candidate rejected", {
          reason: "The event-specific element is hidden, detached, or outside the Calendar surface",
          rawId: evidence.rawId
        });
        continue;
      }

      const id = this.normalizeEventId(evidence);
      normalizedByElement.set(eventElement, {
        event: {
          id,
          element: eventElement,
          ...this.getEventMetadata(eventElement, attributeElement)
        },
        evidence,
        layout: this.inferLayout(eventElement)
      });
    }

    const representationCountById = new Map<string, number>();
    for (const { event } of normalizedByElement.values()) {
      representationCountById.set(
        event.id,
        (representationCountById.get(event.id) ?? 0) + 1
      );
    }

    for (const { event, evidence, layout } of normalizedByElement.values()) {
      debugLog("Calendar event identified", {
        reason: evidence.reason,
        normalizedId: event.id,
        layout,
        visualRepresentations: representationCountById.get(event.id) ?? 1
      });
    }

    return Array.from(normalizedByElement.values(), ({ event }) => event);
  }

  private getEventEvidence(element: HTMLElement): EventEvidence | null {
    const eventId = element.getAttribute("data-eventid")?.trim();
    if (eventId) {
      return {
        attribute: "data-eventid",
        rawId: eventId,
        reason: "interactive visible element backed by Calendar's data-eventid attribute"
      };
    }

    const eventChipId = element.getAttribute("data-eventchip")?.trim();
    if (eventChipId) {
      return {
        attribute: "data-eventchip",
        rawId: eventChipId,
        reason: "interactive visible element backed by Calendar's data-eventchip attribute"
      };
    }

    return null;
  }

  private resolveInteractiveEventElement(attributeElement: HTMLElement): HTMLElement | null {
    if (this.hasInteractiveSemantics(attributeElement)) {
      return attributeElement;
    }

    const interactiveDescendant = attributeElement.querySelector<HTMLElement>(
      GoogleCalendarAdapter.INTERACTIVE_DESCENDANT_SELECTOR
    );
    if (interactiveDescendant) {
      return interactiveDescendant;
    }

    // Calendar occasionally places the event identity on a child of its actual
    // interactive chip. Only walk to a close interactive ancestor; never promote
    // a generic grid cell or arbitrary Calendar button to an event.
    const interactiveAncestor = attributeElement.closest<HTMLElement>(
      GoogleCalendarAdapter.INTERACTIVE_DESCENDANT_SELECTOR
    );
    return interactiveAncestor?.closest('[role="gridcell"]') === interactiveAncestor
      ? null
      : interactiveAncestor;
  }

  private hasInteractiveSemantics(element: HTMLElement): boolean {
    if (element instanceof HTMLButtonElement || element.getAttribute("role") === "button") {
      return true;
    }

    const tabIndex = element.getAttribute("tabindex");
    return tabIndex !== null && tabIndex !== "-1";
  }

  private isVisibleEventElement(element: HTMLElement, root: HTMLElement): boolean {
    if (!element.isConnected || !root.contains(element)) {
      return false;
    }

    if (element.closest('[aria-hidden="true"],[hidden]')) {
      return false;
    }

    return element.getClientRects().length > 0;
  }

  private normalizeEventId(evidence: EventEvidence): string {
    // Whitespace normalization keeps the same Calendar-provided identity stable
    // through harmless rerenders while preserving occurrence-specific content.
    const stableValue = evidence.rawId.replace(/\s+/g, " ");
    return `google-calendar:${evidence.attribute}:${stableValue}`;
  }

  private getEventMetadata(
    eventElement: HTMLElement,
    attributeElement: HTMLElement
  ): CalendarEventMetadata {
    const title = this.firstNonEmptyAttribute(
      eventElement,
      attributeElement,
      "aria-label",
      "title"
    );
    const startTime = this.firstNonEmptyAttribute(
      eventElement,
      attributeElement,
      "data-start-time",
      "data-start"
    );
    const endTime = this.firstNonEmptyAttribute(
      eventElement,
      attributeElement,
      "data-end-time",
      "data-end"
    );

    return {
      ...(title ? { title } : {}),
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {})
    };
  }

  private firstNonEmptyAttribute(
    primary: HTMLElement,
    secondary: HTMLElement,
    ...names: string[]
  ): string | undefined {
    for (const name of names) {
      const value = primary.getAttribute(name)?.trim() || secondary.getAttribute(name)?.trim();
      if (value) {
        return value;
      }
    }

    return undefined;
  }

  private inferLayout(element: HTMLElement): CalendarLayout {
    // Month event chips are normally descendants of an ARIA gridcell. Timed
    // day/week chips generally live in the time grid outside a gridcell. This is
    // diagnostic only and never decides whether an element is an event.
    if (element.closest('[role="gridcell"]')) {
      return "month";
    }

    if (element.closest('[role="grid"], [role="row"]')) {
      return "day-week";
    }

    return "unknown";
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
