export interface CalendarEventMetadata {
  title?: string;
  startTime?: string;
  endTime?: string;
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
  | { status: "unsupported"; reason: string };
