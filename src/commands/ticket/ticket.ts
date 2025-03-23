import { CardFactory, MessageFactory } from "botbuilder";
import { CommandMessage, TriggerPatterns } from "@microsoft/teamsfx";

import * as ACData from "adaptivecards-templating";

import {
  AuthHandlerData,
  CommandHandler,
  HandlerTurnContext,
} from "../handler";
import {
  TeamChannelMessage,
  TeamChannel,
  DELETED_MESSAGE,
  MicrosoftGraphClient,
} from "../../utils/graphClient";
import { APIClient, Queues, TypedHyperlinkEntity } from "../../utils/apiClient";

import ticketCard from "../../adaptiveCards/templates/ticketCard.json";

export class TicketCommandHandler extends CommandHandler {
  public pattern: TriggerPatterns = "/ticket";
  public needsAuth: boolean = true;

  constructor(
    private readonly _apiClient: APIClient,
    private readonly _graphClient: MicrosoftGraphClient
  ) {
    super();
  }

  public async doRun(
    handlerContext: HandlerTurnContext,
    commandMessage: CommandMessage,
    data?: AuthHandlerData
  ): Promise<any> {
    const userProfile = await this._graphClient.me();

    let channel: TeamChannel | undefined;
    let message: TeamChannelMessage | undefined;
    let messageId: string | undefined;
    if (data?.team?.aadGroupId && data?.channel?.id) {
      channel = await this._graphClient.teamChannel(
        data.team.aadGroupId,
        data.channel.id
      );

      if (data.conversation?.id?.indexOf(";") >= 0) {
        messageId = data.conversation.id.split(";")[1];
        messageId = messageId.replace("messageid=", "");

        message =
          (await this._graphClient.teamChannelMessage(
            data.team.aadGroupId,
            data.channel.id,
            messageId
          )) ?? DELETED_MESSAGE;
      }
    }

    const cardJson = new ACData.Template(ticketCard).expand({
      $root: {
        command: commandMessage.text,
        team: { ...(data?.team ?? { id: " ", name: " " }), choices: [] },
        channel: {
          id: data?.channel?.id ?? " ",
          name: channel?.displayName ?? " ",
          choices: [],
        },
        conversation: {
          id: messageId ?? " ",
          message: message?.subject ?? " ",
          choices: [],
        },
        from: {
          id: data?.from.id,
          name: data?.from.name ?? " ",
          aadObjectId: data?.from.aadObjectId,
          email: userProfile.mail ?? " ",
          choices: [],
        },
        ticket: {
          state: {
            id: "",
            choices: await this._fetchStatusChoices(),
          },
          queue: {
            id: "",
            choices: await this._fetchQueueChoices(),
          },
          description: "",
        },
        createdUtc: new Date().toLocaleString("es-ES", {
          timeZone: "UTC",
          month: "long",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        token: data.token,
        gui: {
          buttons: {
            visible: true,
            create: {
              label: "Crear Incidencia",
              enabled: true,
            },
            cancel: {
              label: "Cancelar",
              tooltip: "Cancela la creación de la incidencia",
              enabled: true,
            },
          },
        },
      },
    });

    // Sends the adaptive card
    await handlerContext.context.sendActivity(
      MessageFactory.attachment(CardFactory.adaptiveCard(cardJson))
    );
  }

  private async _fetchStatusChoices(): Promise<
    { title: string; value: string }[]
  > {
    // Status choices array containing the title and value of each status to be displayed in the adaptive card
    return [
      { title: "Abierto", value: "open" },
      { title: "Cerrado", value: "closed" },
      { title: "Resuelto", value: "resolved" },
      { title: "Rechazado", value: "rejected" },
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

      console.debug(
        `[${TicketCommandHandler.name}][DEBUG] ${
          this.run.name
        } queues:\n${JSON.stringify(queues, null, 2)}`
      );

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
