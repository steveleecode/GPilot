import type { CalendarAdapter } from "../adapters/CalendarAdapter";
import type { SelectedCalendarEvent } from "../../shared/types";
import type { BulkAction } from "./BulkAction";

interface DeleteFailure {
  title: string;
  reason: string;
}

export class DeleteEventsAction implements BulkAction {
  readonly type = "delete" as const;
  readonly label = "Delete";

  constructor(private readonly adapter: CalendarAdapter) {}

  async execute(events: SelectedCalendarEvent[]): Promise<void> {
    const failures: DeleteFailure[] = [];
    for (const event of events) {
      const result = await this.adapter.deleteEvent(event);
      if (result.status !== "deleted") {
        failures.push({
          title: event.title ?? "Calendar event",
          reason: result.reason
        });
      }
    }

    if (failures.length > 0) {
      const deletedCount = events.length - failures.length;
      const prefix = deletedCount > 0 ? `${deletedCount} deleted. ` : "";
      throw new Error(`${prefix}${this.formatFailures(failures).join(" ")}`);
    }
  }

  private formatFailures(failures: DeleteFailure[]): string[] {
    const failuresByReason = new Map<string, DeleteFailure[]>();
    for (const failure of failures) {
      const matchingFailures = failuresByReason.get(failure.reason) ?? [];
      matchingFailures.push(failure);
      failuresByReason.set(failure.reason, matchingFailures);
    }

    return Array.from(failuresByReason.values(), (matchingFailures) => {
      const { title, reason } = matchingFailures[0]!;
      return matchingFailures.length === 1
        ? `${title}: ${reason}`
        : `Calendar events (multiple events): ${reason}`;
    });
  }
}
