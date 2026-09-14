const CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const OAUTH_PLACEHOLDER = "REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID";

const statusElement = requireElement<HTMLElement>(".gcbulk-popup-status");
const connectButton = requireElement<HTMLButtonElement>(".gcbulk-popup-connect");

const configuredClientId = chrome.runtime.getManifest().oauth2?.client_id ?? "";
if (!configuredClientId || configuredClientId.includes(OAUTH_PLACEHOLDER)) {
  setStatus(
    "OAuth is not configured in this build. See DEVELOPERS.md for setup.",
    "error"
  );
  connectButton.disabled = true;
} else {
  connectButton.disabled = false;
  connectButton.addEventListener("click", () => void connect());
  void checkConnection();
}

async function checkConnection(): Promise<void> {
  try {
    const result = await requestToken(false);
    if (result.token) {
      setConnected();
      return;
    }
  } catch {
    // A non-interactive check normally fails before the user has connected.
  }

  setStatus("Not connected", "idle");
}

async function connect(): Promise<void> {
  connectButton.disabled = true;
  setStatus("Waiting for Google authorization…", "idle");
  try {
    const result = await requestToken(true);
    if (!result.token) {
      throw new Error("Google did not return an access token.");
    }
    setConnected();
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Google Calendar sign-in failed.",
      "error"
    );
    connectButton.disabled = false;
  }
}

function requestToken(interactive: boolean): Promise<chrome.identity.GetAuthTokenResult> {
  return chrome.identity.getAuthToken({
    interactive,
    enableGranularPermissions: true,
    scopes: [CALENDAR_EVENTS_SCOPE]
  });
}

function setConnected(): void {
  setStatus("Google Calendar connected", "connected");
  connectButton.textContent = "Connected";
  connectButton.disabled = true;
}

function setStatus(message: string, state: "idle" | "connected" | "error"): void {
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`The GPilot sign-in UI is missing ${selector}.`);
  }
  return element;
}

export {};
