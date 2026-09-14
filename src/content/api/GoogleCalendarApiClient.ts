import type {
  CalendarApiDeleteMessage,
  CalendarApiDeleteResponse,
  CalendarApiEventReference,
  CalendarDeleteResult
} from "../../shared/types";

export class GoogleCalendarApiClient {
  async deleteEvent(
    reference: CalendarApiEventReference
  ): Promise<CalendarDeleteResult> {
    const message: CalendarApiDeleteMessage = {
      type: "gcbulk:delete-calendar-event",
      reference
    };

    try {
      const runtime = typeof chrome === "undefined" ? undefined : chrome.runtime;
      if (!runtime || typeof runtime.sendMessage !== "function") {
        return {
          status: "failed",
          reason:
            "GPilot's extension connection is unavailable. Reload Google Calendar and try again."
        };
      }

      const response = await runtime.sendMessage<CalendarApiDeleteResponse>(message);
      if (!response || (response.status !== "deleted" && response.status !== "failed")) {
        return {
          status: "failed",
          reason:
            "GPilot did not receive a valid deletion response. Reload Google Calendar and try again."
        };
      }

      return response.status === "deleted"
        ? { status: "deleted" }
        : { status: "failed", reason: response.reason };
    } catch (error) {
      return {
        status: "failed",
        reason:
          error instanceof Error
            ? error.message
            : "The Google Calendar API request failed."
      };
    }
  }
}
