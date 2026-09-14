import type { CalendarAdapter } from "./adapters/CalendarAdapter";
import type { EventDecorator } from "./selection/eventDecorator";
import type { SelectionManager } from "./selection/SelectionManager";
import { debugLog, OBSERVER_DEBOUNCE_MS } from "../shared/constants";

export class CalendarObserver {
  private observer: MutationObserver | null = null;
  private rootGuardObserver: MutationObserver | null = null;
  private observedRoot: HTMLElement | null = null;
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

    if (this.observedRoot === root && this.observer) {
      return true;
    }

    this.bindToRoot(root);
    this.ensureRootGuard();
    this.scan();
    return true;
  }

  private bindToRoot(root: HTMLElement): void {
    this.observer?.disconnect();
    this.observedRoot = root;
    this.observer = new MutationObserver(() => {
      debugLog("Calendar mutation detected");
      this.scheduleScan();
    });
    this.observer.observe(root, { childList: true, subtree: true });
  }

  stop(): void {
    this.observer?.disconnect();
    this.rootGuardObserver?.disconnect();
    this.observer = null;
    this.rootGuardObserver = null;
    this.observedRoot = null;
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
    const currentRoot = this.adapter.getObservationRoot();
    if (currentRoot && currentRoot !== this.observedRoot) {
      debugLog("Calendar observation root replaced; rebinding observer");
      this.bindToRoot(currentRoot);
    }
    const normalizedEvents = this.adapter.findEvents();
    this.decorator.pruneStale(currentRoot, normalizedEvents);
    for (const event of normalizedEvents) {
      this.decorator.decorate(event);
    }

    this.selectionManager.reconcileVisibleEvents(normalizedEvents);
    debugLog("Calendar scan complete", normalizedEvents.length);
  }

  private ensureRootGuard(): void {
    if (this.rootGuardObserver || !document.body) {
      return;
    }

    // This guard does no event discovery. It only recovers if Calendar replaces
    // its SPA content root; regular event work stays scoped to observedRoot.
    this.rootGuardObserver = new MutationObserver(() => {
      if (!this.observedRoot?.isConnected) {
        this.scheduleScan();
      }
    });
    this.rootGuardObserver.observe(document.body, { childList: true, subtree: true });
  }
}
