import { GoogleCalendarAdapter } from "./adapters/GoogleCalendarAdapter";
import { CalendarObserver } from "./calendarObserver";
import { DeleteEventsAction } from "./actions/DeleteEventsAction";
import { SelectionManager } from "./selection/SelectionManager";
import { EventDecorator } from "./selection/eventDecorator";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { SelectionToolbar } from "./ui/SelectionToolbar";
import { debugLog } from "../shared/constants";

const INITIALIZED_ATTRIBUTE = "data-gcbulk-initialized";

function initialize(): void {
  if (document.documentElement.hasAttribute(INITIALIZED_ATTRIBUTE)) {
    return;
  }
  document.documentElement.setAttribute(INITIALIZED_ATTRIBUTE, "true");

  const adapter = new GoogleCalendarAdapter();
  const selectionManager = new SelectionManager();
  const decorator = new EventDecorator(selectionManager);
  const observer = new CalendarObserver(adapter, decorator, selectionManager);
  const toolbar = new SelectionToolbar(
    selectionManager,
    new DeleteEventsAction(adapter),
    new ConfirmDialog()
  );

  toolbar.mount();
  if (!observer.start()) {
    // The content script may run between SPA shell and Calendar view mounting.
    // Observe only until a recognized Calendar root appears, then hand over to the
    // scoped CalendarObserver. This is not a polling loop.
    const bootstrapObserver = new MutationObserver(() => {
      if (observer.start()) {
        bootstrapObserver.disconnect();
      }
    });
    bootstrapObserver.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && selectionManager.getSelectionCount() > 0) {
      selectionManager.clearSelection();
    }
  });

  debugLog("Extension initialized");
}

initialize();
