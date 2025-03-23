import {
  TurnContext,
  TeamsInfo,
  ChannelInfo,
  CardFactory,
  MessageFactory,
  ConversationAccount,
  ChannelAccount,
} from "botbuilder";
import { CommandMessage, TriggerPatterns } from "@microsoft/teamsfx";
import * as ACData from "adaptivecards-templating";

import {
  AdaptiveCardActionAuthRefreshDataInput,
  AdaptiveCardActionAuthRefreshDataOutput,
} from "../utils/actions";

import authRefreshCard from "../adaptiveCards/templates/authRefreshCard.json";
import { DialogTurnResult } from "botbuilder-dialogs";
import { HandlerContextManager } from "./handlerManager";

export type AuthHandlerData = AdaptiveCardActionAuthRefreshDataOutput & {
  token: string;
};

/**
 * A handler is a class that can be triggered by a message. Handlers can be of different types, such as
 * command handlers or action handlers. The handler should implement the `run` method to handle an incoming
 * message.
 */
export interface Handler {
  /**
   * The pattern that the handler should be triggered by. This can be a string or a regular expression.
   * If a string is provided, the handler will be triggered by an exact match of the string.
   * If a regular expression is provided, the handler will be triggered by a match of the regular expression.
   * If the pattern is not provided, the handler will not be triggered by any message.
   *
   * @example
   * // This handler will be triggered by the string "example"
   * export class ExampleCommandHandler implements Handler {
   *    pattern = "example"
   *    ...
   *
   * @example
   * // This handler will not be triggered by any message
   * export class ExampleCommandHandler implements Handler {
   *    pattern = undefined
   *    ...
   *
   * @example
   * // This handler will be triggered by the string "hello" or "hi"
   * export class ExampleCommandHandler implements Handler {
   *    pattern = /^(hello|hi)$/
   *    ...
   */
  pattern: TriggerPatterns;

  /**
   * The run method should be implemented to handle the incoming message which matches or is
   * triggered by the `pattern`.
   *
   * @param context The context of the incoming message.
   * @param message The message that triggered the handler.
   * @returns A promise that resolves when the handler has finished processing the message.
   */
  run(
    context: HandlerTurnContext,
    message: CommandMessage,
    data?: any
  ): Promise<any>;
}

export abstract class ActionHandler implements Handler {
  public abstract pattern: TriggerPatterns;

  /**
   * @inheritdoc
   */
  public abstract run(
    context: HandlerTurnContext,
    message: CommandMessage,
    data?: any
  ): Promise<any>;
}

export abstract class CommandHandler implements Handler {
  public abstract pattern: TriggerPatterns;
  public abstract needsAuth?: boolean;

  public async run(
    ctx: HandlerTurnContext,
    message: CommandMessage,
    data?: any
  ): Promise<any> {
    // Check if the handler needs an authentication flow before running
    if (this.needsAuth && ctx.context.activity.conversation.isGroup) {
      // Send an auto-refreshing adpative card after switching to a personal context
      // to ensure that the originating team, channel, conversation and sending user
      // are preserved as the card data for future interactions with the user in the
      // personal context
      const conversation: ConversationAccount =
        ctx.context.activity.conversation;
      const channels: ChannelInfo[] = (
        await TeamsInfo.getTeamChannels(ctx.context)
      ).filter(
        (channel: ChannelInfo) =>
          channel.id ===
          (conversation?.id?.indexOf(";") >= 0
            ? conversation.id.split(";")[0]
            : conversation.id)
      );
      const channel: ChannelInfo =
        channels?.length > 0 ? channels[0] : { id: "", name: "" };
      const from: ChannelAccount = ctx.context.activity.from;

      // Data to be passed to the adaptive card
      const cardData: AdaptiveCardActionAuthRefreshDataInput = {
        command: message.text,
        team: await TeamsInfo.getTeamDetails(ctx.context),
        channel: channel,
        conversation: conversation,
        from: from,
        userIds: [from.id],
      };

      // Switch to personal context and send the adaptive card
      return await ctx.switchToPersonalContext(
        async (ctx: HandlerTurnContext): Promise<void> => {
          // Expands the adaptive card template with the card data by replacing the placeholders
          // with the actual data
          const cardJson = new ACData.Template(authRefreshCard).expand({
            $root: cardData,
          });

          // Sends the adaptive card
          await ctx.context.sendActivity(
            MessageFactory.attachment(CardFactory.adaptiveCard(cardJson))
          );
        }
      );
    }

    // If the handler does not need an authentication flow, run the handler in whichever context
    await this.doRun(ctx, message, data);
  }

  /**
   * The run method should be implemented to handle the incoming message which matches or is
   * triggered by the `pattern`. This method is called by the `run` method or alternatively by the `AuthCommandDispatchDialog` when `needsAuth` is set to `true`
   * and should be implemented by the handler.
   *
   * @param context The context of the incoming message.
   * @param message The message that triggered the handler.
   * @param data Additional data that can be passed to the handler when `needsAuth` is true.
   * @returns A promise that resolves when the handler has finished processing the message.
   */
  public abstract doRun(
    context: HandlerTurnContext,
    message: CommandMessage,
    data?: AuthHandlerData
  ): Promise<any>;
}

export class HandlerTurnContext {
  public static from(
    manager: HandlerContextManager,
    context: TurnContext,
    message: CommandMessage
  ): HandlerTurnContext {
    return new HandlerTurnContext(manager, context, message);
  }

  constructor(
    private readonly _manager: HandlerContextManager,
    private readonly _context: TurnContext,
    private readonly _message: CommandMessage
  ) {
    // super(_context.adapter, _context.activity);
  }

  public get message(): CommandMessage {
    return this._message;
  }

  public get context(): TurnContext {
    return this._context;
  }

  public async switchToPersonalContext(
    action: (context: HandlerTurnContext) => Promise<void>
  ): Promise<void> {
    if (this._context.activity.conversation.conversationType === "personal") {
      // Already in personal context, execute action
      await action(
        HandlerTurnContext.from(this._manager, this._context, this._message)
      );
      return;
    }

    await this._manager.switchToPersonalContext(
      this._context,
      async (context: TurnContext): Promise<void> => {
        if (action) {
          await action(
            HandlerTurnContext.from(this._manager, context, this._message)
          );
        }
      }
    );
  }

  public async runDialog(
    dialogName: string,
    data?: any
  ): Promise<DialogTurnResult> {
    return await this._manager.runDialog(this._context, dialogName, {
      data,
    });
  }
}
