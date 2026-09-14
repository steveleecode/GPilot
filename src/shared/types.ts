export interface CalendarEventMetadata {
  title?: string;
  startTime?: string;
  endTime?: string;
  apiReference?: CalendarApiEventReference;
}

export interface CalendarApiEventReference {
  calendarId: string;
  eventId: string;
}

export interface SelectedCalendarEvent extends CalendarEventMetadata {
  id: string;
  element: HTMLElement;
}

export interface SelectionState {
  selected: ReadonlyMap<string, SelectedCalendarEvent>;
}

export type SelectionListener = (state: SelectionState) => void;

export type BulkActionType = "delete" | "duplicate" | "move" | "color" | "export";

export type CalendarDeleteResult =
  | { status: "deleted" }
  | { status: "unsupported"; reason: string }
  | { status: "failed"; reason: string };

export interface CalendarApiDeleteMessage {
  type: "gcbulk:delete-calendar-event";
  reference: CalendarApiEventReference;
}

export type CalendarApiDeleteResponse =
  | { status: "deleted" }
  | { status: "failed"; reason: string };
