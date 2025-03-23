import { CommandMessage, TriggerPatterns } from "@microsoft/teamsfx";

import { ActionHandler, HandlerTurnContext } from "../../../commands/handler";
import { AdaptiveCardActionCreateTicketData } from "../../../utils/actions";
import {
  DELETED_MESSAGE,
  MicrosoftGraphClient,
  TeamChannelMessage,
} from "../../../utils/graphClient";

export class TicketAdaptiveCardCancelActionHandler implements ActionHandler {
  public pattern: TriggerPatterns = "cancelTicket";

  constructor(private readonly _graphClient: MicrosoftGraphClient) {}

  public async run(
    handlerContext: HandlerTurnContext,
    _: CommandMessage,
    __?: any
  ): Promise<any> {
    console.debug(
      `[${TicketAdaptiveCardCancelActionHandler.name}][DEBUG] [${this.run.name}]`
    );

    // Get the data from the action and update the card GUI properties to reflect the state of the ticket creation
    const actionData: AdaptiveCardActionCreateTicketData =
      handlerContext.context.activity.value?.action?.data;

    if (!actionData.gui.buttons.create.enabled) {
      // If the ticket is already created, delete the thread and the ticket card

      // Get all the replies in the thread and delete them
      const replies = await this._graphClient.teamChannelMessageReplies(
        actionData.team.aadGroupId,
        actionData.channel.id,
        actionData.conversation.id
      );
      replies.forEach(async (reply: TeamChannelMessage) => {
        await this._graphClient.deleteTeamChannelMessage(
          actionData.team.aadGroupId,
          actionData.channel.id,
          reply.id
        );
      });

      // Delete the initial message in the thread (The message that started the thread and contains a subject header)
      await this._graphClient.deleteTeamChannelMessage(
        actionData.team?.aadGroupId,
        actionData.channel?.id,
        actionData.conversation?.id
      );
    }

    // Delete the ticket card
    await handlerContext.context.deleteActivity(
      handlerContext.context.activity.replyToId
    );
  }
}
