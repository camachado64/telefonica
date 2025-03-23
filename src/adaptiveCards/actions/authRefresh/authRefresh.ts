import { TriggerPatterns, CommandMessage } from "@microsoft/teamsfx";

import { ActionHandler, HandlerTurnContext } from "../../../commands/handler";
import {
  AdaptiveCardActionActivityValue,
  AdaptiveCardActionAuthRefreshDataOutput,
} from "../../../utils/actions";

export class AuthRefreshActionHandler extends ActionHandler {
  public pattern: TriggerPatterns = "authRefresh";

  /**
   * @inheritDoc
   */
  public async run(
    ctx: HandlerTurnContext,
    _: CommandMessage,
    __?: any
  ): Promise<any> {
    console.debug(
      `[${AuthRefreshActionHandler.name}][DEBUG] [${this.run.name}]`
    );

    // Delete any previously sent message by the bot
    await ctx.context.deleteActivity(ctx.context.activity.replyToId);

    if (ctx.context.activity.conversation.isGroup) {
      // This action should only ever be triggered in a personal context, do nothing if it isn't
      return;
    }

    // Extract the data from the action
    const value: AdaptiveCardActionActivityValue = ctx.context.activity.value;
    const cardData: AdaptiveCardActionAuthRefreshDataOutput = value.action.data;

    // Run the dialog with the command and data from the action
    const dialogResult = await ctx.runDialog("authRefresh", {
      ...cardData,
    });

    console.debug(
      `[${AuthRefreshActionHandler.name}][DEBUG] [${
        this.run.name
      }] dialogResult:\n${JSON.stringify(dialogResult, null, 2)}`
    );
  }
}
