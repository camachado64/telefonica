import {
  ChannelAccount,
  ConversationParameters,
  ConversationReference,
  TurnContext,
} from "botbuilder";
import { DialogTurnResult } from "botbuilder-dialogs";
import { CommandMessage } from "@microsoft/teamsfx";

import {
  ActionHandler,
  CommandHandler,
  Handler,
  HandlerTurnContext,
} from "./handler";
import { AdaptiveCardAction } from "../utils/actions";
import { RunnableDialog } from "../dialogs/dialog";
import { BotConfiguration } from "../config/config";

export interface ConversationReferenceStore {
  [key: string]: Partial<ConversationReference>;
}

export interface HandlerManager {
  resolve(pattern: string, type: HandlerType.Command): CommandHandler | null;
  resolve(pattern: string, type: HandlerType.Action): ActionHandler | null;
  resolve(pattern: string, type: HandlerType): Handler | null;

  dispatch(
    command: Handler,
    context: TurnContext,
    message: string,
    data?: {
      hint: ContextHint;
    } & any
  ): Promise<any>;

  resolveAndDispatch(
    context: TurnContext,
    message: string,
    data?: {
      hint: ContextHint;
    } & any
  ): Promise<any>;
}

export interface HandlerManagerOptions {
  commands: CommandHandler[];
  actions: ActionHandler[];
}

export enum HandlerType {
  Command,
  Action,
}

export enum ContextHint {
  Bot,
  Dialog,
}

export class DefaultHandlerManager implements HandlerManager {
  constructor(
    private readonly _ctxManager: HandlerContextManager,
    private readonly _options: Partial<HandlerManagerOptions>
  ) {}

  public resolve(
    pattern: string,
    type: HandlerType.Command
  ): CommandHandler | null;

  public resolve(
    pattern: string,
    type: HandlerType.Action
  ): ActionHandler | null;

  public resolve(pattern: string, type: HandlerType): Handler | null {
    switch (type) {
      case HandlerType.Command:
        return this._options?.commands?.find((handler: CommandHandler) => {
          if (!handler?.pattern) {
            return false;
          }

          if (handler.pattern instanceof RegExp) {
            return handler.pattern.test(pattern);
          } else {
            return handler.pattern === pattern;
          }
        });
      case HandlerType.Action:
        return this._options?.actions?.find((handler: ActionHandler) => {
          if (!handler?.pattern) {
            return false;
          }

          if (handler.pattern instanceof RegExp) {
            return handler.pattern.test(pattern);
          } else {
            return handler.pattern === pattern;
          }
        });
      default:
        return null;
    }
  }

  public async dispatch(
    handler: Handler,
    context: TurnContext,
    message: string,
    data?: {
      hint: ContextHint;
    } & any
  ): Promise<any>;

  public async dispatch(
    handler: Handler,
    context: TurnContext,
    message: string,
    data?: {
      hint: ContextHint;
    } & any
  ): Promise<any> {
    if (!handler) {
      // If the handler is not found, do nothing
      return;
    }

    // Constructs the command message object
    let commandMessage: CommandMessage | null = null;
    if ("pattern" in handler && !!handler.pattern) {
      // If the command handler pattern is a regular expression, match the command message with the pattern
      // and get the matched groups
      if (handler.pattern instanceof RegExp) {
        const matches: RegExpMatchArray | null = message.match(handler.pattern);
        if (matches) {
          // If the command message matches the pattern, create a command message object
          // with the matched groups
          commandMessage = {
            text: message,
            matches, // Matched groups as the pattern is a regular expression
          };
        }
      } else if (handler.pattern === message) {
        // If the command handler pattern is a string, match the command message with the pattern
        // and no matched groups will exist
        commandMessage = {
          text: message,
          matches: undefined, // No matched groups as the pattern is a string
        };
      }
    }

    // Create the handler context object and run the handler
    const handlerContext = HandlerTurnContext.from(
      this._ctxManager,
      context,
      commandMessage
    );

    const { hint, ...rest } = data ?? { hint: ContextHint.Bot };

    switch (hint) {
      case ContextHint.Dialog:
        await (handler as CommandHandler).doRun(
          handlerContext,
          commandMessage,
          rest
        );
        break;
      default:
        await handler.run(handlerContext, commandMessage);
        break;
    }
  }

  public async resolveAndDispatch(
    context: TurnContext,
    message: string,
    data?: {
      hint: ContextHint;
    } & any
  ): Promise<any> {
    let handler: Handler | null = null;
    if (context.activity.name == AdaptiveCardAction.Name) {
      handler = this.resolve(message, HandlerType.Action);
    } else {
      handler = this.resolve(message, HandlerType.Command);
    }
    return await this.dispatch(handler, context, message, data);
  }
}

export class HandlerContextManager {
  private readonly _dialogs: RunnableDialog[] = [];

  constructor(
    private readonly _config: BotConfiguration,
    private readonly _conversationStore: ConversationReferenceStore
  ) {}

  public registerDialog(dialog: RunnableDialog): void {
    this._dialogs.push(dialog);
  }

  public async switchToPersonalContext(
    context: TurnContext,
    action: (context: TurnContext) => Promise<any>
  ): Promise<void> {
    console.debug(
      `[${HandlerContextManager.name}][DEBUG] ${this.switchToPersonalContext.name} context.activity.conversation.conversationType: ${context.activity.conversation.conversationType}`
    );

    // Check if the context is already personal
    if (context.activity.conversation.conversationType === "personal") {
      // Already in personal context, execute action
      await action(context);
      return;
    }

    // Get the conversation reference for the user
    const conversationRef = this._getConversationReference(
      context.activity.from
    );
    if (conversationRef) {
      // If the conversation reference is available, switch context to the private chat
      // using the conversation reference
      await context.adapter.continueConversationAsync(
        this._config.botId,
        conversationRef,
        async (context: TurnContext) => {
          console.debug(
            `[${HandlerContextManager.name}][DEBUG] ${
              this.switchToPersonalContext.name
            } continueConversationAsync activity:\n${JSON.stringify(
              context.activity,
              null,
              2
            )}`
          );

          if (action) {
            await action(context);
          }
        }
      );
    } else {
      // If the conversation reference is not available, create a new conversation
      // and switch context to the private chat with the activity initiator
      const convoParams: ConversationParameters = {
        members: [context.activity.from],
        isGroup: false,
        bot: context.activity.recipient,
        tenantId: context.activity.conversation.tenantId,
        activity: null,
        channelData: {
          tenant: { id: context.activity.conversation.tenantId },
        },
      };

      await context.adapter.createConversationAsync(
        this._config.botId,
        context.activity.channelId,
        context.activity.serviceUrl,
        null,
        convoParams,
        async (context: TurnContext): Promise<void> => {
          // Gets the newly created sconversation reference for the user and stores it
          const conversationRef = TurnContext.getConversationReference(
            context.activity
          );
          this._addConversationReference(conversationRef);

          console.debug(
            `[${HandlerContextManager.name}][DEBUG] ${
              this.switchToPersonalContext.name
            } createConversationAsync activity: \n${JSON.stringify(
              context.activity,
              null,
              2
            )}`
          );

          await context.adapter.continueConversationAsync(
            this._config.botId,
            conversationRef,
            async (context: TurnContext) => {
              console.debug(
                `[${HandlerContextManager.name}][DEBUG] ${
                  this.switchToPersonalContext.name
                } continueConversationAsync activity:\n${JSON.stringify(
                  context.activity,
                  null,
                  2
                )}`
              );

              if (action) {
                await action(context);
              }
            }
          );
        }
      );
    }
  }

  public async runDialog(
    context: TurnContext,
    dialogName: string,
    data?: any
  ): Promise<DialogTurnResult> {
    const dialog = this._dialogs.find(
      (dialog: RunnableDialog) => dialog.name === dialogName
    );
    return await dialog?.run(context, data);
  }

  private _addConversationReference(
    conversationRef: Partial<ConversationReference>
  ): void {
    if (conversationRef.user?.aadObjectId) {
      // Store the conversation reference in memory using the user id as key
      // if the user id is available in the conversation
      this._conversationStore[conversationRef.user.aadObjectId] =
        conversationRef;
    }
  }

  private _getConversationReference(
    user: ChannelAccount
  ): Partial<ConversationReference> | null {
    if (user.aadObjectId) {
      return this._conversationStore[user.aadObjectId];
    }
    return null;
  }
}
