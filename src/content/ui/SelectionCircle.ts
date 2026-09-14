export class SelectionCircle {
  readonly element: HTMLButtonElement;

  constructor(onToggle: () => void) {
    this.element = document.createElement("button");
    this.element.type = "button";
    this.element.className = "gcbulk-selector";
    this.element.setAttribute("aria-label", "Select event");
    this.element.setAttribute("aria-pressed", "false");

    const checkmark = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    checkmark.classList.add("gcbulk-selector-check");
    checkmark.setAttribute("viewBox", "0 0 18 18");
    checkmark.setAttribute("aria-hidden", "true");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M5 9.2 7.5 12 13 6");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    checkmark.append(path);
    this.element.append(checkmark);

    this.element.addEventListener("pointerdown", this.blockCalendarInteraction);
    this.element.addEventListener("dblclick", this.blockCalendarInteraction);
    this.element.addEventListener("click", (event) => {
      this.blockCalendarInteraction(event);
      onToggle();
    });
  }

  setSelected(selected: boolean): void {
    this.element.setAttribute("aria-pressed", String(selected));
    this.element.setAttribute("aria-label", selected ? "Deselect event" : "Select event");
  }

  destroy(): void {
    this.element.remove();
  }

  private readonly blockCalendarInteraction = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
  };
}
