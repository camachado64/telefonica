import { TurnContext } from "botbuilder";
import { DialogTurnResult } from "botbuilder-dialogs";

export type WaterfallStepContextOptions = {
  data?: {
    command: string;
  } & any;
};

export interface RunnableDialog {
  name: string;

  run(
    context: TurnContext,
    data?: WaterfallStepContextOptions
  ): Promise<DialogTurnResult>;

  continue(context: TurnContext): Promise<DialogTurnResult>;

  stop(context: TurnContext): Promise<DialogTurnResult>;
}
