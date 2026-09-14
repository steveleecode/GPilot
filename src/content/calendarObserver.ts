import type { CalendarAdapter } from "./adapters/CalendarAdapter";
import type { EventDecorator } from "./selection/eventDecorator";
import type { SelectionManager } from "./selection/SelectionManager";
import { debugLog, OBSERVER_DEBOUNCE_MS } from "../shared/constants";

export class CalendarObserver {
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;

  constructor(
    private readonly adapter: CalendarAdapter,
    private readonly decorator: EventDecorator,
    private readonly selectionManager: SelectionManager
  ) {}

  start(): boolean {
    const root = this.adapter.getObservationRoot();
    if (!root) {
      debugLog("Calendar root was not recognized");
      return false;
    }

    this.scan();
    this.observer = new MutationObserver(() => {
      debugLog("Calendar mutation detected");
      this.scheduleScan();
    });
    this.observer.observe(root, { childList: true, subtree: true });
    return true;
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private scheduleScan(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      this.scan();
    }, OBSERVER_DEBOUNCE_MS);
  }

  private scan(): void {
    this.decorator.pruneDisconnected();
    const normalizedEvents = this.adapter
      .findEvents()
      .map((element) => this.decorator.decorate(element))
      .filter((event) => event !== null);

    this.selectionManager.reconcileVisibleEvents(normalizedEvents);
    debugLog("Calendar scan complete", normalizedEvents.length);
  }
}
