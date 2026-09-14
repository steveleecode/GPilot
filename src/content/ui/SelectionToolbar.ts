import type { BulkAction } from "../actions/BulkAction";
import type { SelectionManager } from "../selection/SelectionManager";
import { debugLog } from "../../shared/constants";
import { ConfirmDialog } from "./ConfirmDialog";

export class SelectionToolbar {
  private readonly element = document.createElement("div");
  private readonly count = document.createElement("span");
  private readonly status = document.createElement("span");
  private readonly deleteButton = document.createElement("button");
  private readonly closeButton = document.createElement("button");
  private unsubscribe: (() => void) | null = null;
  private busy = false;

  constructor(
    private readonly selectionManager: SelectionManager,
    private readonly deleteAction: BulkAction,
    private readonly confirmDialog: ConfirmDialog
  ) {
    this.element.className = "gcbulk-toolbar";
    this.element.setAttribute("role", "toolbar");
    this.element.setAttribute("aria-label", "Bulk event actions");

    this.count.className = "gcbulk-toolbar-count";
    this.status.className = "gcbulk-toolbar-status";
    this.status.setAttribute("role", "status");
    this.status.setAttribute("aria-live", "polite");
    this.status.setAttribute("aria-atomic", "true");

    this.deleteButton.type = "button";
    this.deleteButton.className = "gcbulk-toolbar-button gcbulk-toolbar-delete";
    this.deleteButton.textContent = this.deleteAction.label;
    this.deleteButton.addEventListener("click", () => void this.deleteSelected());

    this.closeButton.type = "button";
    this.closeButton.className = "gcbulk-toolbar-button gcbulk-toolbar-close";
    this.closeButton.setAttribute("aria-label", "Clear selection");
    this.closeButton.textContent = "×";
    this.closeButton.addEventListener("click", () => this.selectionManager.clearSelection());

    this.element.append(this.count, this.status, this.deleteButton, this.closeButton);
  }

  mount(): void {
    document.body.append(this.element);
    this.unsubscribe = this.selectionManager.subscribe((state) => {
      const selectionCount = state.selected.size;
      this.count.textContent = `${selectionCount} selected`;
      this.element.classList.toggle("gcbulk-toolbar-visible", selectionCount > 0);
      this.element.setAttribute("aria-hidden", String(selectionCount === 0));
      if (selectionCount === 0) {
        this.setStatus("");
      }
    });
    debugLog("Toolbar mounted");
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.element.remove();
    debugLog("Toolbar unmounted");
  }

  private async deleteSelected(): Promise<void> {
    if (this.busy) {
      return;
    }

    const events = this.selectionManager.getSelectedEvents();
    if (events.length === 0 || !(await this.confirmDialog.confirmDelete(events.length))) {
      return;
    }

    this.busy = true;
    this.deleteButton.disabled = true;
    this.setStatus("Deleting…");
    try {
      await this.deleteAction.execute(events);
      this.selectionManager.clearSelection();
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "Deletion failed.");
    } finally {
      this.busy = false;
      this.deleteButton.disabled = false;
    }
  }

  private setStatus(message: string): void {
    this.status.textContent = message;
    this.status.title = message;
    this.element.classList.toggle("gcbulk-toolbar-has-status", message.length > 0);
  }
}
