export class ConfirmDialog {
  confirmDelete(count: number): Promise<boolean> {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "gcbulk-dialog-backdrop";

      const dialog = document.createElement("section");
      dialog.className = "gcbulk-confirm";
      dialog.setAttribute("role", "alertdialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-labelledby", "gcbulk-confirm-title");

      const title = document.createElement("h2");
      title.id = "gcbulk-confirm-title";
      title.className = "gcbulk-confirm-title";
      title.textContent = `Delete ${count} ${count === 1 ? "event" : "events"}?`;

      const message = document.createElement("p");
      message.className = "gcbulk-confirm-message";
      message.textContent =
        "The selected events will be deleted from Google Calendar. This cannot be undone.";

      const actions = document.createElement("div");
      actions.className = "gcbulk-confirm-actions";

      const cancel = this.createButton("Cancel", "gcbulk-confirm-button");
      const confirm = this.createButton(
        "Delete",
        "gcbulk-confirm-button gcbulk-confirm-button-danger"
      );
      actions.append(cancel, confirm);
      dialog.append(title, message, actions);
      backdrop.append(dialog);
      document.body.append(backdrop);

      const finish = (confirmed: boolean): void => {
        document.removeEventListener("keydown", onKeyDown, true);
        backdrop.remove();
        resolve(confirmed);
      };
      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          finish(false);
        }
      };

      document.addEventListener("keydown", onKeyDown, true);
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) {
          finish(false);
        }
      });
      cancel.addEventListener("click", () => finish(false));
      confirm.addEventListener("click", () => finish(true));
      cancel.focus();
    });
  }

  private createButton(label: string, className: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    return button;
  }
}
