import type { CalendarAdapter } from "../adapters/CalendarAdapter";
import type { SelectionManager } from "./SelectionManager";
import { SelectionCircle } from "../ui/SelectionCircle";
import { debugLog } from "../../shared/constants";
import type { SelectedCalendarEvent, SelectionState } from "../../shared/types";

interface DecoratedEvent {
  id: string;
  circle: SelectionCircle;
}

export class EventDecorator {
  private readonly decorated = new Map<HTMLElement, DecoratedEvent>();

  constructor(
    private readonly adapter: CalendarAdapter,
    private readonly selectionManager: SelectionManager
  ) {
    this.selectionManager.subscribe((state) => this.syncSelection(state));
  }

  decorate(element: HTMLElement): SelectedCalendarEvent | null {
    const event = this.toSelectedEvent(element);
    if (!event) {
      return null;
    }

    if (this.decorated.has(element)) {
      return event;
    }

    element.classList.add("gcbulk-event-host");

    const circle = new SelectionCircle(() => this.selectionManager.toggleEvent(event));
    element.append(circle.element);
    this.decorated.set(element, { id: event.id, circle });
    this.updateElementSelection(element, circle, this.selectionManager.isSelected(event.id));

    debugLog("Event decorated", event.id);
    return event;
  }

  toSelectedEvent(element: HTMLElement): SelectedCalendarEvent | null {
    const id = this.adapter.getEventId(element);
    if (!id) {
      return null;
    }

    return {
      id,
      element,
      ...this.adapter.getEventMetadata(element)
    };
  }

  pruneDisconnected(): void {
    for (const [element, decoratedEvent] of this.decorated) {
      if (!element.isConnected) {
        decoratedEvent.circle.destroy();
        this.decorated.delete(element);
      }
    }
  }

  private syncSelection(state: SelectionState): void {
    for (const [element, decoratedEvent] of this.decorated) {
      if (!element.isConnected) {
        decoratedEvent.circle.destroy();
        this.decorated.delete(element);
        continue;
      }

      this.updateElementSelection(
        element,
        decoratedEvent.circle,
        state.selected.has(decoratedEvent.id)
      );
    }
  }

  private updateElementSelection(
    element: HTMLElement,
    circle: SelectionCircle,
    selected: boolean
  ): void {
    circle.setSelected(selected);
    element.classList.toggle("gcbulk-selected", selected);
  }
}
