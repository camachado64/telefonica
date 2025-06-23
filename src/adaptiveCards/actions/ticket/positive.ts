import { CardFactory, MessageFactory } from "botbuilder";
import { ErrorCode, ErrorWithCode, TriggerPatterns } from "@microsoft/teamsfx";

import * as ACData from "adaptivecards-templating";

import { BotConfiguration } from "../../../config/config";
import {
  HandlerMessage,
  HandlerMessageContext,
  HandlerState,
} from "../../../commands/manager";
import { ActionHandler } from "../../../commands/handler";
import { HandlerTurnContext } from "../../../commands/context";
import {
  ApplicationIdentityType,
  MicrosoftGraphClient,
  TeamChannelMessage,
} from "../../../utils/graphClient";
import {
  APIClient,
  CustomField,
  Queue,
  Ticket,
} from "../../../utils/apiClient";
import {
  AdaptiveCardActionActivityValue,
  AdaptiveCardActionPositiveTicketPageData,
  AdaptiveCardTicketCardPageData,
} from "../../../utils/actions";
import { LogsRepository } from "../../../repositories/logs";

import page1 from "../../templates/ticket/page1.json";
import customFieldSelect from "../../templates/ticket/customFieldSelect.json";
import customFieldInput from "../../templates/ticket/customFieldInput.json";

export class TicketAdaptiveCardPositiveActionHandler implements ActionHandler {
  public pattern: TriggerPatterns = "positiveTicket";

  constructor(
    private readonly _config: BotConfiguration,
    private readonly _apiClient: APIClient,
    private readonly _graphClient: MicrosoftGraphClient,
    private readonly _logs: LogsRepository
  ) {}

  public async run(
    handlerContext: HandlerTurnContext,
    handlerMessage: HandlerMessage,
    handlerMessageContext?: HandlerMessageContext
  ): Promise<any> {
    console.debug(
      `[${TicketAdaptiveCardPositiveActionHandler.name}][DEBUG] ${this.run.name}@start`
    );

    // Get the data from the action and update the card GUI properties to reflect the state of the ticket creation
    const activityValue: AdaptiveCardActionActivityValue =
      handlerContext.context.activity.value;
    const actionData: AdaptiveCardActionPositiveTicketPageData =
      activityValue?.action?.data;

    // Validate that we can retrieve the state
    const state: HandlerState = handlerContext.state;
    if (!state) {
      throw new ErrorWithCode(
        "Ticket adaptive card state has not yet been initialized",
        ErrorCode.FailedOperation
      );
    }

    if (state.gui.page === 0) {
      // If the state is on page 0, we need to update the 'state.ticket' object with the data from the action
      for (const [key, field] of Object.entries<any>(state.ticket)) {
        if (key in actionData) {
          field.value = actionData[key];
        }
      }

      const customFields: any[] = await this._constructCustomFields(
        state,
        actionData
      );
      page1.body[4].items = customFields;
      state.page1 = page1;

      customFields[0].items[1].items[0].choices =
        state.ticket.customFields[customFields[0].items[0].id].choices;
      customFields[0].items[1].selectAction.isEnabled = true;

      console.debug(
        `[${TicketAdaptiveCardPositiveActionHandler.name}][DEBUG] ${
          this.run.name
        } state.ticket.customFields:\n${JSON.stringify(
          state.ticket.customFields,
          null,
          2
        )}`
      );

      // Update the state GUI properties to reflect the state of the ticket creation
      state.gui.page = 1;
      state.gui.buttons.create.enabled = false;
      state.gui.buttons.create.title = "Crear Incidencia";
      state.gui.buttons.create.tooltip = "Crea una nueva incidencia";

      // Prepare the card data for the adaptive card
      const cardData: AdaptiveCardTicketCardPageData = {
        sequenceId: state.sequenceId,
        gui: state.gui,
      };

      // Expands the adaptive card template with the data provided
      const cardJson = new ACData.Template(page1).expand({
        $root: cardData,
      });

      // Update the existing adaptive card activity, id'ed by ' handlerContext.context.activity.replyToId'
      // with the new adaptive card JSON
      const message = MessageFactory.attachment(
        CardFactory.adaptiveCard(cardJson)
      );
      message.id = handlerContext.context.activity.replyToId;
      await handlerContext.context.updateActivity(message);

      console.debug(
        `[${TicketAdaptiveCardPositiveActionHandler.name}][DEBUG] ${this.run.name}@end[NEXT_PAGE]`
      );

      return;
    } else {
      for (const [key, value] of Object.entries<any>(
        state.ticket.customFields
      )) {
        if (key in actionData) {
          value.value = actionData[key];
        }
      }

      // Creates the ticket in the RT API
      await this._createTicket(handlerContext, state);

      // Update the GUI to reflect the state of the ticket creation
      state.gui.buttons.create.enabled = false;
      state.gui.buttons.cancel.title = "Borrar Hilo";
      state.gui.buttons.cancel.tooltip = "Borra el hilo de conversacion";

      // Prepare the card data for the adaptive card
      const cardData: AdaptiveCardTicketCardPageData = {
        sequenceId: state.sequenceId,
        gui: state.gui,
      };

      // Expands the adaptive card template with the data provided
      const cardJson = new ACData.Template(page1).expand({
        $root: cardData,
      });

      // Creates a message attachment activity with the adaptive card using the expanded card template
      // and updated the existing adaptive card activity, id'ed by ' handlerContext.context.activity.replyToId'
      // with the new adaptive card JSON.
      const message = MessageFactory.attachment(
        CardFactory.adaptiveCard(cardJson)
      );
      message.id = handlerContext.context.activity.replyToId;

      // Sends the update to the existing adaptive card to the user
      await handlerContext.context.updateActivity(message);
    }
  }

  private async _createTicket(
    handlerContext: HandlerTurnContext,
    handlerState: HandlerState
  ): Promise<void> {
    const messageCtx: HandlerMessageContext =
      handlerState.commandMessageContext;

    // Get the initial message in the thread (The message that started the thread and contains a subject header)
    let thread: TeamChannelMessage = messageCtx.thread!;
    // await this._graphClient.teamChannelMessage(
    //   actionData.team.aadGroupId,
    //   actionData.channel.id,
    //   actionData.conversation.id
    // );

    // Get all the replies in the thread
    let replies: TeamChannelMessage[] =
      await this._graphClient.teamChannelMessageReplies(
        messageCtx.team!.aadGroupId!,
        messageCtx.channel!.id,
        messageCtx.thread!.id
      );

    // Add the initial message to the replies and ticket description from the card to the beginning of the replies
    // to be added as comments to the ticket
    replies = [
      // {
      //   body: {
      //     content: handlerState.ticket.ticketDescriptionInput.value,
      //     contentType: "text/plain",
      //   },
      //   from: thread.from,
      // } as TeamChannelMessage,
      thread,
      ...replies,
    ];

    console.debug(
      `[${TicketAdaptiveCardPositiveActionHandler.name}][DEBUG] ${this._createTicket.name} threadMessages.length: ${replies?.length}`
    );

    // Get the chosen queue from 'ticketCategoryChoiceSet' and get the queue from the API
    const queue: Queue = await this._apiClient.queue(
      handlerState.ticket.ticketCategoryChoiceSet.value
    );

    console.debug(
      `[${TicketAdaptiveCardPositiveActionHandler.name}][DEBUG] ${
        this._createTicket.name
      } handlerState.ticket:\n${JSON.stringify(handlerState.ticket, null, 2)}`
    );

    // Create the ticket in the Ticketing API
    const ticket: Ticket = await this._apiClient.createTicket(
      queue,
      thread.subject,
      handlerState.ticket.ticketStateChoiceSet.value,
      handlerState.ticket.ticketDescriptionInput.value,
      messageCtx.threadFrom.email,
      messageCtx.replyFrom.email,
      handlerState.ticket.customFields
    );

    // const ticket: Ticket = await this._apiClient.ticket({
    //   id: "416134",
    //   _url: "https://test-epg-vmticket-01.hi.inet/REST/2.0/ticket/416134",
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
      `[${TicketAdaptiveCardPositiveActionHandler.name}][DEBUG] ${
        this._createTicket.name
      } ticket:\n${JSON.stringify(ticket, null, 2)}`
    );

    // Create a log entry for the ticket creation wuth the actionData and the thread messages that were
    // used to create the ticket
    // await this._logs.createLog(
    //   JSON.stringify({
    //     ...handlerState.ticket,
    //     threadMessages: replies,
    //   })
    // );

    for (const message of replies) {
      console.debug(
        `[${TicketAdaptiveCardPositiveActionHandler.name}][DEBUG] ${this._createTicket.name} message.id: ${message.id}, message.@odata.context: ${message["@odata.context"]}`
      );

      if (
        !message ||
        typeof message !== "object" ||
        !("body" in message) ||
        typeof message.body !== "object" ||
        !message.body ||
        !("content" in message.body) ||
        typeof message.body.content !== "string" ||
        !message.body.content ||
        !message.body.content.trim() || // Should make sure trim exists right ts? no more trim() is not a function in 'message.body.content' error please
        !message.from?.user
      ) {
        console.debug(
          `[${TicketAdaptiveCardPositiveActionHandler.name}][DEBUG] ${this._createTicket.name} message is not valid, skipping...`
        );
        continue;
      }

      if (
        "mentions" in message &&
        message.mentions &&
        Array.isArray(message.mentions) &&
        message.mentions.length === 1
      ) {
        const mention = message.mentions[0];
        const appMention = mention.mentioned?.application;

        if (
          appMention?.applicationIdentityType === ApplicationIdentityType.BOT &&
          appMention?.id === this._config.botId
        ) {
          const messageText = message.body.content.toLowerCase();
          // TODO: Message should only be skipped if it both mentions the bot and it evokes a known command or this command only?

          console.debug(
            `[${TicketAdaptiveCardPositiveActionHandler.name}][DEBUG] ${this._createTicket.name} message mentions bot, skipping...`
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
    await handlerContext.context.sendActivity(
      `Se hay creado el ticket con el número: ${ticket.id}. Lo puedes acceder en [este enlace](${this._config.apiEndpoint}/Ticket/Display.html?id=${ticket.id}).`
    );
  }

  private async _constructCustomFields(
    state: HandlerState,
    actionData: AdaptiveCardActionPositiveTicketPageData
  ): Promise<any[]> {
    const customFields = await this._apiClient.queueCustomFields(
      actionData.ticketCategoryChoiceSet!
    );
    customFields.sort((a, b) => {
      if (a.id < b.id) {
        return -1;
      }
      if (a.id > b.id) {
        return 1;
      }
      return 0;
    });

    // console.debug(
    //   `[${TicketAdaptiveCardPositiveActionHandler.name}][DEBUG] ${
    //     this._constructCustomFields.name
    //   } customFields:\n${JSON.stringify(customFields, null, 2)}`
    // );

    for (const customField of customFields) {
      if (customField.BasedOn) {
        for (const basedOnField of customFields) {
          basedOnField.Dependents = basedOnField.Dependents || [];

          if (basedOnField.id === customField.BasedOn.id) {
            basedOnField.Dependents.push(customField);
          }
        }
      }
    }

    const freeCustomFields: {
      [key: string]: {
        dependents: string[];
      };
    } = {};
    // const walkDependentFields = (
    //   parentField: CustomField,
    //   customField: CustomField
    // ): void => {
    //   for (const field of customField.Dependents) {
    //   }
    // };
    for (const field of customFields) {
      if (!field.BasedOn) {
        freeCustomFields[field.id] = {
          dependents: field.Dependents?.map((cf: CustomField) => cf.id) ?? [],
        };
      }
    }

    const customFieldMap: {
      [key: string]: {
        id: string;
        text: string;
        placeholder: string;
        value: string;
        visible: boolean;
        basedOn: string | null;
        type: string;
        required: boolean;
        choices?: { value: string; title: string }[];
      };
    } = {};
    for (const customField of customFields) {
      customFieldMap[customField.id] = {
        id: customField.id,
        text: customField.Name,
        placeholder: customField.Description,
        value: "",
        visible: customField.id in freeCustomFields,
        basedOn: customField.BasedOn?.id ?? null,
        type: customField.Type,
        required: customField.Type === "Select",
        choices:
          customField.id in freeCustomFields
            ? customField.Values?.map((choice: string, index: number) => ({
                value: choice,
                title: choice,
              }))
            : [],
      };
    }
    state.ticket.customFields = customFieldMap;

    const customFieldJson: any[] = customFields.map((field: CustomField) => {
      if (field.Type === "Select") {
        return JSON.parse(
          JSON.stringify(customFieldSelect)
            .replace(/\${text}/g, customFieldMap[field.id].text)
            .replace(/\${placeholder}/g, customFieldMap[field.id].placeholder)
            .replace(/\${id}/g, customFieldMap[field.id].id)
            .replace(/\${required}/g, String(field.id in freeCustomFields))
            .replace(/\${sequenceId}/g, state.sequenceId)
            .replace(/\${visible}/g, String(customFieldMap[field.id].visible))
            .replace(/<id>/g, field.id)
        );
      } else if (field.Type === "Freeform") {
        return JSON.parse(
          JSON.stringify(customFieldInput)
            .replace(/\${text}/g, customFieldMap[field.id].text)
            .replace(/\${placeholder}/g, customFieldMap[field.id].placeholder)
            .replace(/\${id}/g, customFieldMap[field.id].id)
            .replace(/\${sequenceId}/g, state.sequenceId)
            .replace(/<id>/g, field.id)
        );
      }
    });

    return customFieldJson;
  }
}
