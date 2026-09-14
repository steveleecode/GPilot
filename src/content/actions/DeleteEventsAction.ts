import type { CalendarAdapter } from "../adapters/CalendarAdapter";
import type { SelectedCalendarEvent } from "../../shared/types";
import type { BulkAction } from "./BulkAction";

export class DeleteEventsAction implements BulkAction {
  readonly type = "delete" as const;
  readonly label = "Delete";

  constructor(private readonly adapter: CalendarAdapter) {}

  async execute(events: SelectedCalendarEvent[]): Promise<void> {
    for (const event of events) {
      const result = await this.adapter.deleteEvent(event);
      if (result.status === "unsupported") {
        throw new Error(result.reason);
      }
    }
  }
}
