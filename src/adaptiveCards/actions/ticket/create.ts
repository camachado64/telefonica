import {
  CardFactory,
  ConversationAccount,
  MessageFactory,
  TeamDetails,
} from "botbuilder";
import { TriggerPatterns, CommandMessage } from "@microsoft/teamsfx";

import * as ACData from "adaptivecards-templating";

import { ActionHandler, HandlerTurnContext } from "../../../commands/handler";
import {
  ApplicationIdentityType,
  DELETED_MESSAGE,
  MicrosoftGraphClient,
  TeamChannelMessage,
} from "../../../utils/graphClient";
import { APIClient, Queue, Ticket } from "../../../utils/apiClient";
import { BotConfiguration } from "../../../config/config";
import { LogsRepository } from "../../../repositories/logs";
import { AdaptiveCardActionCreateTicketData } from "../../../utils/actions";

import ticketCard from "../../../adaptiveCards/templates/ticketCard.json";

export class TicketAdaptiveCardCreateActionHandler implements ActionHandler {
  public pattern: TriggerPatterns = "createTicket";

  constructor(
    private readonly _config: BotConfiguration,
    private readonly _apiClient: APIClient,
    private readonly _graphClient: MicrosoftGraphClient,
    private readonly _logs: LogsRepository
  ) {}

  public async run(
    handlerContext: HandlerTurnContext,
    commandMessage: CommandMessage,
    data?: any
  ): Promise<any> {
    console.debug(
      `[${TicketAdaptiveCardCreateActionHandler.name}][DEBUG] [${this.run.name}]`
    );

    // Get the data from the action and update the card GUI properties to reflect the state of the ticket creation
    const actionData: AdaptiveCardActionCreateTicketData =
      handlerContext.context.activity.value?.action?.data;
    const cardJson = new ACData.Template(ticketCard).expand({
      $root: {
        ...actionData,
        ticket: {
          state: {
            id: actionData.ticketStateChoiceSet,
            choices: actionData.ticket.state.choices.filter(
              (v) => v.value == actionData.ticketStateChoiceSet
            ),
          },
          queue: {
            id: actionData.ticketCategoryChoiceSet,
            choices: actionData.ticket.queue.choices.filter(
              (v) => v.value == actionData.ticketCategoryChoiceSet
            ),
          },
          description: actionData.ticketDescriptionInput,
        },
        gui: {
          buttons: {
            visible: true,
            create: {
              ...actionData.gui.buttons.create,
              enabled: false,
            },
            cancel: {
              ...actionData.gui.buttons.cancel,
              label: "Borrar Hilo",
              tooltip: "Borra el hilo de conversacion asociado a la incidencia",
            },
          },
        },
      },
    });

    // Update the card with the ticket information that was just submitted
    const message = MessageFactory.attachment(
      CardFactory.adaptiveCard(cardJson)
    );
    message.id = handlerContext.context.activity.replyToId;
    await handlerContext.context.updateActivity(message);

    // Get the initial message in the thread (The message that started the thread and contains a subject header)
    let initialMessage: TeamChannelMessage =
      await this._graphClient.teamChannelMessage(
        actionData.team.aadGroupId,
        actionData.channel.id,
        actionData.conversation.id
      );

    // Get all the replies in the thread
    let replies: TeamChannelMessage[] =
      await this._graphClient.teamChannelMessageReplies(
        actionData.team.aadGroupId,
        actionData.channel.id,
        actionData.conversation.id
      );

    // Add the initial message to the replies and ticket description from the card to the beginning of the replies
    // to be added as comments to the ticket
    replies = [
      {
        body: {
          content: actionData.ticketDescriptionInput,
          contentType: "text/plain",
        },
        from: initialMessage.from,
      } as TeamChannelMessage,
      initialMessage,
      ...replies,
    ];

    console.debug(
      `[${TicketAdaptiveCardCreateActionHandler.name}][DEBUG] ${this.run.name} threadMessages.length: ${replies?.length}`
    );

    // Get the chosen queue from 'ticketCategoryChoiceSet' and get the queue from the API
    const queue: Queue = await this._apiClient.queue(
      actionData.ticketCategoryChoiceSet
    );

    // Create the ticket in the Ticketing API
    const ticket = await this._apiClient.createTicket(
      queue,
      initialMessage.subject
    );

    // const ticket: Ticket = await this._apiClient.ticket({
    //   id: "416115",
    //   _url: "https://test-epg-vmticket-01.hi.inet/REST/2.0/ticket/416115",
    //   type: "ticket",
    // });
    // const ticket: Partial<Ticket> = {
    //   id: "416115",
    //   _hyperlinks: [
    //     {
    //       ref: "comment",
    //       _url: "https://test-epg-vmticket-01.hi.inet/REST/2.0/ticket/416115/comment",
    //       type: "comment",
    //     },
    //   ],
    // };

    console.debug(
      `[${TicketAdaptiveCardCreateActionHandler.name}][DEBUG] ${
        this.run.name
      } ticket:\n${JSON.stringify(ticket, null, 2)}`
    );

    // Create a log entry for the ticket creation wuth the actionData and the thread messages that were
    // used to create the ticket
    await this._logs.createLog(
      JSON.stringify({
        ...actionData,
        token: undefined,
        threadMessages: replies,
      })
    );

    for (const message of replies) {
      if (!message.body?.content?.trim() || !message.from?.user) {
        continue;
      }

      console.debug(
        `[${TicketAdaptiveCardCreateActionHandler.name}][DEBUG] ${
          this.run.name
        } message:\n${JSON.stringify(message, null, 2)}`
      );

      if (message.mentions?.length === 1) {
        if (
          message.mentions[0].mentioned?.application
            ?.applicationIdentityType === ApplicationIdentityType.BOT &&
          message.mentions[0].mentioned?.application?.id === this._config.botId
        ) {
          console.debug(
            `[${TicketAdaptiveCardCreateActionHandler.name}][DEBUG] ${this.run.name} message mentions bot, skipping...`
          );
          continue;
        }
      }

      await this._apiClient.addTicketComment(
        this._graphClient,
        ticket,
        message
      );
    }

    // Send a message to the user that the ticket was created and provide a link to the ticket
    return await handlerContext.context.sendActivity(
      `Se hay creado el ticket con el número: ${ticket.id}. Lo puedes acceder en [este enlace](${this._config.apiEndpoint}/Ticket/Display.html?id=${ticket.id}).`
    );
  }
}
