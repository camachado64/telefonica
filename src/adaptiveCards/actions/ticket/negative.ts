import { TriggerPatterns } from "@microsoft/teamsfx";

import {
  HandlerMessage,
  HandlerMessageContext,
  HandlerState,
} from "../../../commands/manager";
import { ActionHandler } from "../../../commands/handler";
import { HandlerTurnContext } from "../../../commands/context";
import {
  AdaptiveCardActionActivityValue,
  AdaptiveCardTicketCardDataPageGUI,
} from "../../../utils/actions";
import {
  MicrosoftGraphClient,
  TeamChannelMessage,
} from "../../../utils/graphClient";

export class TicketAdaptiveCardCancelActionHandler implements ActionHandler {
  public pattern: TriggerPatterns = "negativeTicket";

  constructor(private readonly _graphClient: MicrosoftGraphClient) {}

  public async run(
    handlerContext: HandlerTurnContext,
    handlerMessage: HandlerMessage,
    handlerMessageContext: HandlerMessageContext
  ): Promise<any> {
    console.debug(
      `[${TicketAdaptiveCardCancelActionHandler.name}][TRACE] ${this.run.name}@start`
    );

    // Get the data from the action and update the card GUI properties to reflect the state of the ticket creation
    const activityValue: AdaptiveCardActionActivityValue =
      handlerContext.context.activity.value;
    // const actionData: any = activityValue?.action?.data;

    // Retrieve the handler state from its context
    const handlerState: HandlerState = handlerContext.state;

    if (
      handlerState.gui?.buttons.cancel.title === "Borrar Hilo" &&
      !handlerState.gui?.buttons.create.enabled
    ) {
      // If the ticket is already created, delete the thread and the ticket card
      // Get all the replies in the thread and delete them
      const replies: TeamChannelMessage[] =
        await this._graphClient.teamChannelMessageReplies(
          handlerState.commandMessageContext.team.aadGroupId,
          handlerState.commandMessageContext.channel.id,
          handlerState.commandMessageContext.thread.id
        );

      // For each reply in the thread, attempt to delete it
      replies.forEach(async (reply: TeamChannelMessage): Promise<void> => {
        await this._graphClient.deleteTeamChannelMessage(
          handlerState.commandMessageContext.team.aadGroupId,
          handlerState.commandMessageContext.channel.id,
          reply.id
        );
      });

      // Delete the initial message in the thread (The message that started the thread and contains a subject header)
      await this._graphClient.deleteTeamChannelMessage(
        handlerState.commandMessageContext.team?.aadGroupId,
        handlerState.commandMessageContext.channel?.id,
        handlerState.commandMessageContext.thread?.id
      );
    }

    // Deletes the assumed adaptive card activity that triggered this action
    await handlerContext.context.deleteActivity(
      handlerContext.context.activity.replyToId
    );

    console.debug(
      `[${TicketAdaptiveCardCancelActionHandler.name}][TRACE] ${this.run.name}@end`
    );
  }
}
