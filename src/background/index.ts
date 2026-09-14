import type {
  CalendarApiDeleteMessage,
  CalendarApiDeleteResponse,
  CalendarApiEventReference
} from "../shared/types";

const CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const OAUTH_PLACEHOLDER = "REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isDeleteMessage(message)) {
    return false;
  }

  void deleteCalendarEvent(message.reference).then(sendResponse);
  return true;
});

function isDeleteMessage(message: unknown): message is CalendarApiDeleteMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as Partial<CalendarApiDeleteMessage>;
  return (
    candidate.type === "gcbulk:delete-calendar-event" &&
    typeof candidate.reference?.calendarId === "string" &&
    candidate.reference.calendarId.length > 0 &&
    typeof candidate.reference.eventId === "string" &&
    candidate.reference.eventId.length > 0
  );
}

async function deleteCalendarEvent(
  reference: CalendarApiEventReference
): Promise<CalendarApiDeleteResponse> {
  const configuredClientId = chrome.runtime.getManifest().oauth2?.client_id ?? "";
  if (!configuredClientId || configuredClientId.includes(OAUTH_PLACEHOLDER)) {
    return {
      status: "failed",
      reason:
        "Google OAuth is not configured. Build with GPILOT_GOOGLE_OAUTH_CLIENT_ID set to your Chrome extension OAuth client ID."
    };
  }

  try {
    const token = await getAccessToken(true);
    let response = await sendDeleteRequest(reference, token);
    if (response.status === 401) {
      await chrome.identity.removeCachedAuthToken({ token });
      const refreshedToken = await getAccessToken(true);
      response = await sendDeleteRequest(reference, refreshedToken);
    }

    if (response.ok || response.status === 404 || response.status === 410) {
      return { status: "deleted" };
    }

    return {
      status: "failed",
      reason: await getApiErrorMessage(response)
    };
  } catch (error) {
    return {
      status: "failed",
      reason:
        error instanceof Error
          ? error.message
          : "Google Calendar authorization or deletion failed."
    };
  }
}

async function getAccessToken(interactive: boolean): Promise<string> {
  const result = await chrome.identity.getAuthToken({
    interactive,
    enableGranularPermissions: true,
    scopes: [CALENDAR_EVENTS_SCOPE]
  });
  if (!result.token) {
    throw new Error("Google Calendar authorization did not return an access token.");
  }

  return result.token;
}

function sendDeleteRequest(
  reference: CalendarApiEventReference,
  token: string
): Promise<Response> {
  const calendarId = encodeURIComponent(reference.calendarId);
  const eventId = encodeURIComponent(reference.eventId);
  return fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }
  );
}

async function getApiErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    if (body.error?.message) {
      return `Google Calendar API: ${body.error.message}`;
    }
  } catch {
    // Fall through to the status-based message when Google returns no JSON body.
  }

  return `Google Calendar API request failed (${response.status}).`;
}
