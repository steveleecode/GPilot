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
  private pointerFrame: number | null = null;
  private positionFrame: number | null = null;
  private latestPointer: { x: number; y: number; target: EventTarget | null } | null = null;
  private pointerHoveredElement: HTMLElement | null = null;

  constructor(private readonly selectionManager: SelectionManager) {
    this.selectionManager.subscribe((state) => this.syncSelection(state));
    document.addEventListener("pointermove", this.handlePointerMove, true);
    document.addEventListener("scroll", this.schedulePositionSync, true);
    window.addEventListener("resize", this.schedulePositionSync);
  }

  decorate(event: SelectedCalendarEvent): void {
    const existingDecoration = this.decorated.get(event.element);
    if (existingDecoration) {
      const controlWasRemoved = existingDecoration.circle.element.parentElement !== document.body;
      if (controlWasRemoved) {
        document.body.append(existingDecoration.circle.element);
        this.updateElementSelection(
          event.element,
          existingDecoration.circle,
          this.selectionManager.isSelected(event.id)
        );
      }
      existingDecoration.circle.setPosition(event.element.getBoundingClientRect());

      debugLog("Calendar event decoration skipped", {
        normalizedId: event.id,
        alreadyDecorated: true,
        controlRestored: controlWasRemoved
      });
      return;
    }

    event.element.classList.add("gcbulk-event-host");

    const circle = new SelectionCircle(() => this.selectionManager.toggleEvent(event));
    document.body.append(circle.element);
    circle.setPosition(event.element.getBoundingClientRect());
    this.decorated.set(event.element, { id: event.id, circle });
    this.updateElementSelection(
      event.element,
      circle,
      this.selectionManager.isSelected(event.id)
    );

    debugLog("Calendar event decorated", {
      normalizedId: event.id,
      alreadyDecorated: false
    });
  }

  pruneStale(observationRoot: HTMLElement | null): void {
    for (const [element, decoratedEvent] of this.decorated) {
      const isOutsideCalendar =
        observationRoot !== null && !observationRoot.contains(element);
      if (!element.isConnected || isOutsideCalendar) {
        if (this.pointerHoveredElement === element) {
          this.setPointerHoveredElement(null);
        }
        decoratedEvent.circle.destroy();
        this.decorated.delete(element);
        debugLog("Calendar event overlay removed", {
          normalizedId: decoratedEvent.id,
          reason: !element.isConnected
            ? "Calendar event host disconnected"
            : "Calendar event host left the active Calendar surface"
        });
        continue;
      }

      if (decoratedEvent.circle.element.parentElement !== document.body) {
        document.body.append(decoratedEvent.circle.element);
        this.updateElementSelection(
          element,
          decoratedEvent.circle,
          this.selectionManager.isSelected(decoratedEvent.id)
        );
        debugLog("Calendar event control restored", {
          normalizedId: decoratedEvent.id,
          hostConnected: true
        });
      }

      decoratedEvent.circle.setPosition(element.getBoundingClientRect());
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

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.latestPointer = { x: event.clientX, y: event.clientY, target: event.target };
    if (this.pointerFrame !== null) {
      return;
    }

    this.pointerFrame = window.requestAnimationFrame(() => {
      this.pointerFrame = null;
      const pointer = this.latestPointer;
      if (!pointer) {
        return;
      }

      const target = pointer.target instanceof Element ? pointer.target : null;
      if (target?.closest('[role="dialog"], [aria-modal="true"]')) {
        this.setPointerHoveredElement(null);
        return;
      }

      let match: HTMLElement | null = null;
      let matchArea = Number.POSITIVE_INFINITY;
      for (const element of this.decorated.keys()) {
        if (!element.isConnected) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        const containsPointer =
          pointer.x >= rect.left &&
          pointer.x <= rect.right &&
          pointer.y >= rect.top &&
          pointer.y <= rect.bottom;
        const area = rect.width * rect.height;
        if (containsPointer && area > 0 && area < matchArea) {
          match = element;
          matchArea = area;
        }
      }

      this.setPointerHoveredElement(match);
    });
  };

  private setPointerHoveredElement(element: HTMLElement | null): void {
    if (this.pointerHoveredElement === element) {
      return;
    }

    if (this.pointerHoveredElement) {
      this.decorated.get(this.pointerHoveredElement)?.circle.setHovered(false);
    }
    this.pointerHoveredElement = element;
    if (this.pointerHoveredElement) {
      const decoration = this.decorated.get(this.pointerHoveredElement);
      decoration?.circle.setPosition(this.pointerHoveredElement.getBoundingClientRect());
      decoration?.circle.setHovered(true);
    }
  }

  private readonly schedulePositionSync = (): void => {
    if (this.positionFrame !== null) {
      return;
    }

    this.positionFrame = window.requestAnimationFrame(() => {
      this.positionFrame = null;
      for (const [element, decoration] of this.decorated) {
        decoration.circle.setPosition(
          element.isConnected ? element.getBoundingClientRect() : null
        );
      }
    });
  };
}
