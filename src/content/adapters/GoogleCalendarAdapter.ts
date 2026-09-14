import type { CalendarAdapter } from "./CalendarAdapter";
import type {
  CalendarApiEventReference,
  CalendarDeleteResult,
  CalendarEventMetadata,
  SelectedCalendarEvent
} from "../../shared/types";
import { debugLog } from "../../shared/constants";
import { GoogleCalendarApiClient } from "../api/GoogleCalendarApiClient";

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

  private static readonly TASK_ARIA_LABEL_PATTERN = /^task\s*:/i;
  private static readonly TASK_EVENT_ID_PREFIX = "tasks_";

  constructor(private readonly apiClient = new GoogleCalendarApiClient()) {}

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

      if (evidence.rawId.startsWith(GoogleCalendarAdapter.TASK_EVENT_ID_PREFIX)) {
        debugLog("Calendar event candidate rejected", {
          reason: "Google Tasks use task IDs, not Google Calendar API event IDs",
          rawId: evidence.rawId
        });
        continue;
      }

      const eventElement = this.resolveInteractiveEventElement(attributeElement);
      if (!eventElement || normalizedByElement.has(eventElement)) {
        continue;
      }

      if (this.isTaskElement(eventElement, attributeElement)) {
        debugLog("Calendar event candidate rejected", {
          reason: "Google Tasks items use their own completion control and are not Calendar API events",
          rawId: evidence.rawId
        });
        continue;
      }

      if (!this.isVisibleEventElement(eventElement, root)) {
        debugLog("Calendar event candidate rejected", {
          reason: "The event-specific element is hidden, detached, or outside the Calendar surface",
          rawId: evidence.rawId
        });
        continue;
      }

      const apiReference = this.getApiReference(evidence);
      if (!apiReference) {
        debugLog("Calendar event candidate rejected", {
          reason: "The item does not expose a validated Google Calendar API reference",
          rawId: evidence.rawId
        });
        continue;
      }

      const id = this.normalizeEventId(evidence, apiReference);
      normalizedByElement.set(eventElement, {
        event: {
          id,
          element: eventElement,
          ...this.getEventMetadata(eventElement, attributeElement, apiReference)
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
        apiReferenceResolved: event.apiReference !== undefined,
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

  private isTaskElement(
    eventElement: HTMLElement,
    attributeElement: HTMLElement
  ): boolean {
    const semanticElements = new Set<HTMLElement>([eventElement, attributeElement]);
    for (const root of [eventElement, attributeElement]) {
      const interactiveAncestor = root.closest<HTMLElement>(
        GoogleCalendarAdapter.INTERACTIVE_DESCENDANT_SELECTOR
      );
      if (interactiveAncestor) {
        semanticElements.add(interactiveAncestor);
      }

      for (const descendant of root.querySelectorAll<HTMLElement>(
        '[aria-label],[aria-labelledby],[role="button"],button'
      )) {
        semanticElements.add(descendant);
      }
    }

    const semanticText = new Set<string>();
    for (const element of semanticElements) {
      for (const value of [
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.textContent,
        element.innerText
      ]) {
        if (value?.trim()) {
          semanticText.add(value.trim());
        }
      }

      const labelledBy = element.getAttribute("aria-labelledby")?.trim();
      if (!labelledBy) {
        continue;
      }
      for (const id of labelledBy.split(/\s+/)) {
        const label = document.getElementById(id)?.textContent?.trim();
        if (label) {
          semanticText.add(label);
        }
      }
    }

    return Array.from(semanticText).some((text) =>
      GoogleCalendarAdapter.TASK_ARIA_LABEL_PATTERN.test(text)
    );
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

  private normalizeEventId(
    evidence: EventEvidence,
    apiReference: CalendarApiEventReference | undefined
  ): string {
    if (apiReference) {
      return `google-calendar-api:${apiReference.calendarId}:${apiReference.eventId}`;
    }

    // Whitespace normalization keeps the same Calendar-provided identity stable
    // through harmless rerenders while preserving occurrence-specific content.
    const stableValue = evidence.rawId.replace(/\s+/g, " ");
    return `google-calendar:${evidence.attribute}:${stableValue}`;
  }

  private getEventMetadata(
    eventElement: HTMLElement,
    attributeElement: HTMLElement,
    apiReference: CalendarApiEventReference | undefined
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
      ...(endTime ? { endTime } : {}),
      ...(apiReference ? { apiReference } : {})
    };
  }

  private getApiReference(
    evidence: EventEvidence
  ): CalendarApiEventReference | undefined {
    if (evidence.attribute !== "data-eventid") {
      return undefined;
    }

    try {
      const padded = evidence.rawId
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(evidence.rawId.length / 4) * 4, "=");
      const decoded = atob(padded);
      const separator = decoded.indexOf(" ");
      if (separator <= 0 || separator === decoded.length - 1) {
        return undefined;
      }

      const eventId = decoded.slice(0, separator).trim();
      const calendarId = this.expandCalendarId(decoded.slice(separator + 1).trim());
      if (!eventId || !calendarId) {
        return undefined;
      }

      return { calendarId, eventId };
    } catch {
      debugLog("Calendar API reference could not be decoded", {
        rawId: evidence.rawId
      });
      return undefined;
    }
  }

  private expandCalendarId(calendarId: string): string | undefined {
    // TODO(calendar-selector): These compact domains were observed in
    // Calendar's data-eventid payload. Keep this mapping conservative and
    // refuse unknown compact domains rather than risking deletion on the wrong
    // calendar. The actual deletion request uses only the documented API.
    const compactDomains: Readonly<Record<string, string>> = {
      m: "gmail.com",
      g: "group.calendar.google.com",
      v: "group.v.calendar.google.com"
    };
    const compactMatch = /^(.*)@([a-z])$/.exec(calendarId);
    if (!compactMatch) {
      return calendarId;
    }

    const [, localPart, compactDomain] = compactMatch;
    const expandedDomain = compactDomains[compactDomain ?? ""];
    return localPart && expandedDomain
      ? `${localPart}@${expandedDomain}`
      : undefined;
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

  async deleteEvent(event: SelectedCalendarEvent): Promise<CalendarDeleteResult> {
    if (!event.apiReference) {
      return {
        status: "unsupported",
        reason: "This item does not expose a safe Google Calendar API identifier."
      };
    }

    return this.apiClient.deleteEvent(event.apiReference);
  }
}
