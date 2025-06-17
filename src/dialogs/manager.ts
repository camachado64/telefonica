import { TurnContext } from "botbuilder";
import { DialogTurnResult } from "botbuilder-dialogs";

import { RunnableDialog } from "./dialog";

export enum OAuthStatus {
  Waiting,
  Complete,
  Failed,
}

export interface DialogManager {
  registerDialog(dialog: RunnableDialog): void;

  runDialog(
    context: TurnContext,
    dialogName: string,
    data?: any
  ): Promise<DialogTurnResult>;

  continueDialog(
    context: TurnContext,
    dialogName: string
  ): Promise<DialogTurnResult>;

  stopDialog(
    context: TurnContext,
    dialogName: string
  ): Promise<DialogTurnResult>;
}

export class DefaultDialogManager implements DialogManager {
  private readonly _dialogs: RunnableDialog[] = [];

  constructor() {}

  public registerDialog(dialog: RunnableDialog): void {
    // Checks if the dialog is already registered
    if (this._dialogs.find((d: RunnableDialog) => d.name === dialog.name)) {
      // If the dialog is already registered, throw an error
      throw new Error(`Dialog '${dialog.name}' is already registered`);
    }

    // If the dialog is not registered, register it by adding it to the dialogs array
    this._dialogs.push(dialog);
  }

  public async runDialog(
    context: TurnContext,
    dialogName: string,
    data?: {
      sequenceId?: string;
    } & any
  ): Promise<DialogTurnResult> {
    // Checks and finds the dialog with the given name exists
    const dialog = this._dialogs.find(
      (dialog: RunnableDialog) => dialog.name === dialogName
    );

    console.debug(
      `[${DefaultDialogManager.name}][DEBUG] ${this.runDialog.name} dialog: ${
        dialog ? dialog.name : "not found"
      }`
    );

    if (!dialog) {
      // If the dialog is not found, throw an error
      throw new Error(`Dialog ${dialogName} not found`);
    }

    // If the dialog is found, run the dialog with the current context and data
    return await dialog?.run(context, data);
  }

  public async continueDialog(
    context: TurnContext,
    dialogName: string
    // sequenceId?: string
  ): Promise<DialogTurnResult> {
    // Checks and finds the dialog with the given name exists
    const dialog = this._dialogs.find(
      (dialog: RunnableDialog) => dialog.name === dialogName
    );

    console.debug(
      `[${DefaultDialogManager.name}][DEBUG] ${
        this.continueDialog.name
      } dialog: ${dialog ? dialog.name : "not found"}`
    );

    if (!dialog) {
      // If the dialog is not found, throw an error
      throw new Error(`Dialog ${dialogName} not found`);
    }

    // Continue the dialog with the current context
    return await dialog.continue(context);
  }

  public async stopDialog(
    context: TurnContext,
    dialogName: string
  ): Promise<DialogTurnResult> {
    // Checks and finds the dialog with the given name exists
    const dialog = this._dialogs.find(
      (dialog: RunnableDialog) => dialog.name === dialogName
    );

    console.debug(
      `[${DefaultDialogManager.name}][DEBUG] ${this.stopDialog.name} dialog: ${
        dialog ? dialog.name : "not found"
      }`
    );

    if (!dialog) {
      // If the dialog is not found, throw an error
      throw new Error(`Dialog ${dialogName} not found`);
    }

    // Stop the dialog with the current context
    return await dialog.stop(context);
  }
}
