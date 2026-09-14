import type {
  CalendarDeleteResult,
  CalendarEventMetadata,
  SelectedCalendarEvent
} from "../../shared/types";

export interface CalendarAdapter {
  getObservationRoot(): HTMLElement | null;
  findEvents(): HTMLElement[];
  getEventId(element: HTMLElement): string | null;
  getEventMetadata(element: HTMLElement): CalendarEventMetadata;
  deleteEvent(event: SelectedCalendarEvent): Promise<CalendarDeleteResult>;
}
