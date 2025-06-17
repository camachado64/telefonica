import { DialogTurnResult } from "botbuilder-dialogs";
import { TriggerPatterns } from "@microsoft/teamsfx";

import {
  HandlerMessage,
  HandlerMessageContext,
} from "../../../commands/manager";
import { ActionHandler } from "../../../commands/handler";
import { HandlerTurnContext } from "../../../commands/context";
import { OAuthDialog } from "../../../dialogs/oauthDialog";
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
    handlerContext: HandlerTurnContext,
    handlerMessage: HandlerMessage,
    handlerMessageContext: HandlerMessageContext
  ): Promise<any> {
    console.debug(
      `[${AuthRefreshActionHandler.name}][TRACE] ${this.run.name}@start`
    );

    if (handlerContext.context.activity.conversation.isGroup) {
      // This action should only ever be triggered in a personal context, do nothing if it isn't
      return;
    }

    // Delete any previously sent message by the bot
    await handlerContext.context.deleteActivity(
      handlerContext.context.activity.replyToId
    );

    // Extract the data from the action
    const value: AdaptiveCardActionActivityValue =
      handlerContext.context.activity.value;
    const cardData: AdaptiveCardActionAuthRefreshDataOutput = value.action.data;

    console.debug(
      `[${AuthRefreshActionHandler.name}][DEBUG] ${
        this.run.name
      } cardData:\n${JSON.stringify(cardData, null, 2)}`
    );

    // Run the dialog with the command and data from the action
    const dialogResult: DialogTurnResult = await handlerContext.runDialog(
      handlerContext.context,
      OAuthDialog.name,
      {
        ...cardData,
      }
    );

    console.debug(
      `[${AuthRefreshActionHandler.name}][DEBUG] ${
        this.run.name
      } dialogResult:\n${JSON.stringify(dialogResult, null, 2)}`
    );

    console.debug(
      `[${AuthRefreshActionHandler.name}][TRACE] ${this.run.name}@end`
    );
  }
}
