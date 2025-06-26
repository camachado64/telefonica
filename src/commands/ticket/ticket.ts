import { CardFactory, MessageFactory } from "botbuilder";
import { TriggerPatterns } from "@microsoft/teamsfx";

import * as ACData from "adaptivecards-templating";

import {
  HandlerMessage,
  HandlerMessageContext,
  HandlerState,
} from "../manager";
import { CommandHandler } from "../handler";
import { HandlerTurnContext } from "../context";
import { APIClient, Queues, TypedHyperlinkEntity } from "../../utils/apiClient";
import { AdaptiveCardTicketCardPageData } from "../../utils/actions";

import page0 from "../../adaptiveCards/templates/ticket/page0.json";

export class TicketCommandHandler extends CommandHandler {
  public pattern: TriggerPatterns = "/ticket";

  constructor(private readonly _apiClient: APIClient) {
    super();
  }

  /**
   * @inheritdoc
   */
  public async run(
    handlerContext: HandlerTurnContext,
    commandMessage: HandlerMessage,
    commandMessageContext: HandlerMessageContext
  ): Promise<void> {
    console.debug(
      `[${TicketCommandHandler.name}][TRACE] ${this.run.name}@start`
    );

    await handlerContext.switchToPersonalConversationAsync(
      async (handlerContext: HandlerTurnContext): Promise<void> => {
        console.debug(
          `[${TicketCommandHandler.name}][TRACE] ${this.run.name} handlerContext.switchToPersonalConversationAsync <anonymous>(wrapper: HandlerTurnContext) => Promise<void>@start`
        );

        await this._doRun(
          handlerContext,
          commandMessage,
          commandMessageContext
        ); //, token);

        console.debug(
          `[${TicketCommandHandler.name}][TRACE] ${this.run.name} handlerContext.switchToPersonalConversationAsync <anonymous>(wrapper: HandlerTurnContext) => Promise<void>@end`
        );

        return;
      }
    );

    console.debug(`[${TicketCommandHandler.name}][TRACE] ${this.run.name}@end`);
  }

  private async _doRun(
    handlerContext: HandlerTurnContext,
    handlerMessage: HandlerMessage,
    handlerMessageContext: HandlerMessageContext
    // token?: Partial<TokenResponse>
  ): Promise<void> {
    console.debug(
      `[${TicketCommandHandler.name}][TRACE] ${this._doRun.name}@start`
    );

    const data: HandlerMessageContext = handlerMessageContext;
    const state: HandlerState = handlerContext.state;

    console.debug(
      `[${TicketCommandHandler.name}][DEBUG] ${this._doRun.name} handlerState.sequenceId: ${state.sequenceId}`
    );

    // console.debug(
    //   `[${TicketCommandHandler.name}][DEBUG] ${
    //     this._doRun.name
    //   } handlerState:\n${JSON.stringify(state, null, 2)}`
    // );

    // Fetches the queue choices for the ticket
    const queueChoices: { title: string; value: string }[] =
      await this._fetchQueueChoices();

    // Fetches the status choices for the ticket
    const statusChoices: { title: string; value: string }[] =
      await this._fetchStatusChoices();

    // Creates a new ticket state in the handler state
    state.ticket = {
      startedAt: new Date(),
      ticketStateChoiceSet: {
        value: "",
        choices: statusChoices,
      },
      ticketCategoryChoiceSet: {
        value: "",
        choices: queueChoices,
        // required: false
      },
      ticketDescriptionInput: {
        value: "",
      },
    };

    // Creates the 'startedAt' containing the time this card was sent in the 'es-ES' locale format
    const startedAt: string = state.ticket.startedAt.toLocaleString("es-ES", {
      timeZone: "UTC",
      month: "long",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // Initializes the 'state.gui' object with the initial values for the adaptive card GUI state
    state.gui = {
      page: 0,
      header: {
        startedAt: startedAt,
        from: {
          name: data?.replyFrom?.name ?? " ",
          email: data?.replyFrom?.email ?? " ",
        },
      },
      context: {
        team: data?.team?.name ?? " ",
        channel: data?.channel?.displayName ?? " ",
        conversation: data?.thread?.subject ?? " ",
      },
      buttons: {
        visible: true,
        create: {
          title: "Siguiente",
          tooltip: "Siguir con la creación de lo ticket",
          enabled: true,
        },
        cancel: {
          title: "Cancelar",
          tooltip: "Cancela la creación de la incidencia",
          enabled: true,
        },
      },
    };

    const cardData: AdaptiveCardTicketCardPageData = {
      sequenceId: state.sequenceId,
      ticket: state.ticket,
      gui: state.gui,
    };

    // Expands the adaptive card template with the data provided
    const cardJson = new ACData.Template(page0).expand({
      $root: cardData,
    });

    // Sends the adaptive card
    await handlerContext.context.sendActivity(
      MessageFactory.attachment(CardFactory.adaptiveCard(cardJson))
    );

    console.debug(
      `[${TicketCommandHandler.name}][TRACE] ${this._doRun.name}@end`
    );
  }

  private async _fetchStatusChoices(): Promise<
    { title: string; value: string }[]
  > {
    // Status choices array containing the title and value of each status to be displayed in the adaptive card
    return [
      { title: "Abierto", value: "open" },
      { title: "Nuevo", value: "new" },
      // { title: "Estancado", value: "stalled" },  // Not allowed in main queue
      { title: "Resuelto", value: "resolved" },
      // { title: "Rechazado", value: "rejected" }, // Not allowed in main queue
      // { title: "Borrado", value: "deleted" },    // Not allowed in main queue
    ];
  }

  private async _fetchQueueChoices(): Promise<
    { title: string; value: string }[]
  > {
    // Queue choices array containing the title and value of each queue to be displayed in the adaptive card
    const queueChoices: { title: string; value: string }[] = [];

    // Fetch the first page of queue references
    let queues = await this._apiClient.queues().catch((error: any) => {
      // Catches any errors that occur during the fetching of the queues

      console.error(
        `[${TicketCommandHandler.name}][ERROR] ${
          this._fetchQueueChoices.name
        } error:\n${JSON.stringify(error, null, 2)}`
      );

      // Return an empty array of queues if an error occurs
      return { items: [] as TypedHyperlinkEntity[] } as Queues;
    });

    // Convert the queue references to queue choices and add them to the queue choices array
    for (const queueRef of queues.items) {
      const queue = await this._apiClient.queue(queueRef);
      queueChoices.push({ title: queue.Name, value: queue.id });
    }

    // Fetch the next page of queues if it exists and repeat the process
    while (queues?.next_page) {
      // Fetch the next page of queue references
      queues = await this._apiClient.next(queues).catch((error: any) => {
        // Catches any errors that occur during the fetching of the queues

        console.error(
          `[${TicketCommandHandler.name}][ERROR] ${
            this._fetchQueueChoices.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        // Return an empty array of queues if an error occurs
        return { items: [] as TypedHyperlinkEntity[] } as Queues;
      });

      if (queues?.items?.length <= 0) {
        break;
      }

      // Convert the queue references to queue choices and add them to the queue choices array
      for (const queueRef of queues.items) {
        const queue = await this._apiClient.queue(queueRef);
        queueChoices.push({ title: queue.Name, value: queue.id });
      }
    }

    console.debug(
      `[${TicketCommandHandler.name}][DEBUG] ${
        this._fetchQueueChoices.name
      } queueChoices:\n${JSON.stringify(queueChoices, null, 2)}`
    );

    // Return the queue choices array
    return queueChoices.length > 0
      ? queueChoices
      : [{ title: "Test", value: "0" }]; // TODO: Remove
  }
}
