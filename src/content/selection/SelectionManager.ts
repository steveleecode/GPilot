import { debugLog } from "../../shared/constants";
import type {
  SelectedCalendarEvent,
  SelectionListener,
  SelectionState
} from "../../shared/types";

export class SelectionManager {
  private readonly selected = new Map<string, SelectedCalendarEvent>();
  private readonly listeners = new Set<SelectionListener>();

  getState(): SelectionState {
    return { selected: new Map(this.selected) };
  }

  getSelectedEvents(): SelectedCalendarEvent[] {
    return Array.from(this.selected.values());
  }

  getSelectionCount(): number {
    return this.selected.size;
  }

  isSelected(id: string): boolean {
    return this.selected.has(id);
  }

  selectEvent(event: SelectedCalendarEvent): void {
    this.selected.set(event.id, event);
    debugLog("Event selected", event.id);
    this.emit();
  }

  deselectEvent(id: string): void {
    if (!this.selected.delete(id)) {
      return;
    }

    debugLog("Event deselected", id);
    this.emit();
  }

  toggleEvent(event: SelectedCalendarEvent): void {
    if (this.selected.has(event.id)) {
      this.deselectEvent(event.id);
    } else {
      this.selectEvent(event);
    }
  }

  clearSelection(): void {
    if (this.selected.size === 0) {
      return;
    }

    this.selected.clear();
    debugLog("Selection cleared");
    this.emit();
  }

  reconcileVisibleEvents(events: SelectedCalendarEvent[]): void {
    if (this.selected.size === 0) {
      return;
    }

    const visibleById = new Map(events.map((event) => [event.id, event]));
    let changed = false;

    for (const [id, selectedEvent] of this.selected) {
      const visibleEvent = visibleById.get(id);
      if (!visibleEvent) {
        this.selected.delete(id);
        changed = true;
      } else if (visibleEvent.element !== selectedEvent.element) {
        this.selected.set(id, visibleEvent);
        changed = true;
      }
    }

    if (changed) {
      debugLog("Removed or refreshed stale selections");
      this.emit();
    }
  }

  subscribe(listener: SelectionListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
