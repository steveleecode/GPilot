import type { BulkActionType, SelectedCalendarEvent } from "../../shared/types";

export interface BulkAction {
  readonly type: BulkActionType;
  readonly label: string;
  execute(events: SelectedCalendarEvent[]): Promise<void>;
}
