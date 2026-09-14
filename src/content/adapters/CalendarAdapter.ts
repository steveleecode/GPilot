import type {
  CalendarDeleteResult,
  SelectedCalendarEvent
} from "../../shared/types";

export interface CalendarAdapter {
  getObservationRoot(): HTMLElement | null;
  findEvents(): SelectedCalendarEvent[];
  deleteEvent(event: SelectedCalendarEvent): Promise<CalendarDeleteResult>;
}
