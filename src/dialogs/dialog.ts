import { TurnContext } from "botbuilder";
import { DialogTurnResult } from "botbuilder-dialogs";

export interface RunnableDialog {
  name: string;

  run(context: TurnContext, data?: any): Promise<DialogTurnResult>;

  continue(context: TurnContext): Promise<DialogTurnResult>;

  stop(context: TurnContext): Promise<DialogTurnResult>;
}
