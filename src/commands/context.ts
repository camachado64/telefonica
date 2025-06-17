import {
  ChannelAccount,
  ConversationParameters,
  ConversationReference,
  TurnContext,
} from "botbuilder";
import { DialogTurnResult } from "botbuilder-dialogs";

import { DialogManager } from "../dialogs/manager";
import { BotConfiguration } from "../config/config";
import { HandlerManager, HandlerMessage, HandlerState } from "./manager";

export interface ConversationReferenceStore {
  [key: string]: Partial<ConversationReference>;
}

export interface HandlerTurnContextHelper {
  switchToConversationAsync(
    context: TurnContext,
    conversationReference: Partial<ConversationReference>,
    action: (context: TurnContext) => Promise<any>
  ): Promise<void>;

  switchToPersonalConversationAsync(
    context: TurnContext,
    action: (context: TurnContext) => Promise<any>
  ): Promise<void>;

  // switchToConversationAsync(
  //   context: TurnContext,
  //   conversationParams: Partial<ConversationParameters>,
  //   action: (context: TurnContext) => Promise<any>
  // ): Promise<void>;
}

export class HandlerTurnContext {
  public static from(
    context: TurnContext,
    message: HandlerMessage,
    dialogManager: DialogManager,
    contextHelper: HandlerTurnContextHelper
  ): HandlerTurnContext {
    return new HandlerTurnContext(
      context,
      message,
      dialogManager,
      contextHelper
    );
  }

  private _state: HandlerState = null;

  constructor(
    private readonly _context: TurnContext,
    private readonly _handlerMessage: HandlerMessage,
    private readonly _dialogManager: DialogManager,
    private readonly _contextHelper: HandlerTurnContextHelper
  ) {
    // super(_context.adapter, _context.activity);
  }

  public get message(): HandlerMessage {
    return this._handlerMessage;
  }

  public get context(): TurnContext {
    return this._context;
  }

  public get state(): HandlerState {
    return this._state;
  }

  public set state(handlerState: HandlerState) {
    this._state = handlerState;
  }

  public async switchToConversationAsync(
    conversationReference: Partial<ConversationReference>,
    action: (context: HandlerTurnContext) => Promise<void>
  ): Promise<void> {
    console.debug(
      `[${HandlerTurnContext.name}][TRACE] ${this.switchToConversationAsync.name}@start`
    );

    // Switch to the specified conversation and execute the action
    await this._contextHelper.switchToConversationAsync(
      this._context,
      conversationReference,
      async (context: TurnContext): Promise<void> => {
        console.debug(
          `[${HandlerTurnContext.name}][DEBUG] ${this.switchToConversationAsync.name} this._contextHelper.switchToConversationAsync action: (context: TurnContext) => Promise<void>@start`
        );

        if (action) {
          // Create a new 'HandlerTurnContext' with the switched context and execute the action
          const handlerTurnContext = HandlerTurnContext.from(
            context,
            this._handlerMessage,
            this._dialogManager,
            this._contextHelper
          );
          // Preserve state if needed
          handlerTurnContext._state = this.state;

          // Execute the action with the new context
          await action(handlerTurnContext);
        }

        console.debug(
          `[${HandlerTurnContext.name}][DEBUG] ${this.switchToConversationAsync.name} this._contextHelper.switchToConversationAsync action: (context: TurnContext) => Promise<void>@end`
        );
      }
    );
  }

  public async switchToPersonalConversationAsync(
    action: (context: HandlerTurnContext) => Promise<void>
  ): Promise<void> {
    console.debug(
      `[${HandlerTurnContext.name}][TRACE] ${this.switchToPersonalConversationAsync.name}@start`
    );

    if (this._context.activity.conversation.conversationType === "personal") {
      // Already in personal context, execute action
      await action(this);

      console.debug(
        `[${HandlerTurnContext.name}][TRACE] ${this.switchToPersonalConversationAsync.name}@end[IN_PERSONAL_CONTEXT]`
      );

      return;
    }

    // Switch to personal context and execute action
    await this._contextHelper.switchToPersonalConversationAsync(
      this._context,
      async (context: TurnContext): Promise<void> => {
        // Create a new 'HandlerTurnContext' with the switched context and execute the action
        if (action) {
          // TODO: Might be easier to just replace the '_context' with the new context
          const handlerTurnContext = HandlerTurnContext.from(
            context,
            this._handlerMessage,
            this._dialogManager,
            this._contextHelper
          );
          // Preserve state if needed
          handlerTurnContext._state = this.state;

          // Execute the action with the new context
          return await action(handlerTurnContext);
        }
      }
    );

    console.debug(
      `[${HandlerTurnContext.name}][TRACE] ${this.switchToPersonalConversationAsync.name}@end`
    );
  }

  public async runDialog(
    context: TurnContext,
    dialogName: string,
    data?: any
  ): Promise<DialogTurnResult> {
    return await this._dialogManager.runDialog(context, dialogName, data);
  }

  public async continueDialog(
    context: TurnContext,
    dialogName: string
  ): Promise<DialogTurnResult> {
    return await this._dialogManager.continueDialog(context, dialogName);
  }

  public async stopDialog(
    context: TurnContext,
    dialogName: string
  ): Promise<DialogTurnResult> {
    return await this._dialogManager.stopDialog(context, dialogName);
  }
}

export class DefaultHandlerTurnContextHelper
  implements HandlerTurnContextHelper
{
  constructor(
    private readonly _config: BotConfiguration,
    private readonly _conversationStore: ConversationReferenceStore
  ) {}

  // public async switchToConversation(
  //   context: TurnContext,
  //   conversationReference: Partial<ConversationParameters>,
  //   action: (context: TurnContext) => Promise<any>
  // ): Promise<void>;

  // public async switchToConversationAsync(
  //   context: TurnContext,
  //   conversationReference: Partial<ConversationReference>,
  //   action: (context: TurnContext) => Promise<any>
  // ): Promise<void>;

  public async switchToConversationAsync(
    context: TurnContext,
    conversationReference: Partial<ConversationReference>, //| ConversationParameters
    action: (context: TurnContext) => Promise<any>
  ): Promise<void> {
    console.debug(
      `[${DefaultHandlerTurnContextHelper.name}][TRACE] ${this.switchToConversationAsync.name}@start`
    );

    await context.adapter.continueConversationAsync(
      this._config.botId,
      conversationReference,
      async (context: TurnContext): Promise<void> => {
        console.debug(
          `[${DefaultHandlerTurnContextHelper.name}][TRACE] ${this.switchToConversationAsync.name} context.adapter.continueConversationAsync action: (context: TurnContext) => Promise<any>@start`
        );

        if (action) {
          await action(context);
        }

        console.debug(
          `[${DefaultHandlerTurnContextHelper.name}][TRACE] ${this.switchToConversationAsync.name} context.adapter.continueConversationAsync action: (context: TurnContext) => Promise<any>@end`
        );
      }
    );

    console.debug(
      `[${DefaultHandlerTurnContextHelper.name}][TRACE] ${this.switchToConversationAsync.name}@end`
    );
  }

  public async switchToPersonalConversationAsync(
    context: TurnContext,
    action: (context: TurnContext) => Promise<any>
  ): Promise<void> {
    console.debug(
      `[${DefaultHandlerTurnContextHelper.name}][TRACE] ${this.switchToPersonalConversationAsync.name}@start`
    );
    console.debug(
      `[${DefaultHandlerTurnContextHelper.name}][DEBUG] ${this.switchToPersonalConversationAsync.name} context.activity.conversation.conversationType: ${context.activity.conversation.conversationType}`
    );

    // Check if the context is already personal
    if (context.activity.conversation.conversationType === "personal") {
      // Already in personal context, execute action
      await action(context);

      console.debug(
        `[${DefaultHandlerTurnContextHelper.name}][TRACE] ${this.switchToPersonalConversationAsync.name}@end[IN_PERSONAL_CONTEXT]`
      );
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
            `[${DefaultHandlerTurnContextHelper.name}][DEBUG] ${
              this.switchToPersonalConversationAsync.name
            } continueConversationAsync activity:\n${JSON.stringify(
              context.activity,
              null,
              2
            )}`
          );

          if (action) {
            // If an action is provided, execute it in this context
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

      // Create a new conversation with the user and bot in a private chat
      await context.adapter.createConversationAsync(
        this._config.botId,
        context.activity.channelId,
        context.activity.serviceUrl,
        null,
        convoParams,
        async (context: TurnContext): Promise<void> => {
          // Gets the newly created conversation reference for the user and store it
          const conversationRef = TurnContext.getConversationReference(
            context.activity
          );
          this._addConversationReference(conversationRef);

          console.debug(
            `[${DefaultHandlerTurnContextHelper.name}][DEBUG] ${
              this.switchToPersonalConversationAsync.name
            } context.adapter.createConversationAsync activity: \n${JSON.stringify(
              context.activity,
              null,
              2
            )}`
          );

          // Continue the conversation in the private chat
          await context.adapter.continueConversationAsync(
            this._config.botId,
            conversationRef,
            async (context: TurnContext) => {
              console.debug(
                `[${DefaultHandlerTurnContextHelper.name}][DEBUG] ${
                  this.switchToPersonalConversationAsync.name
                } context.adapter.continueConversationAsync activity:\n${JSON.stringify(
                  context.activity,
                  null,
                  2
                )}`
              );

              if (action) {
                // If an action is provided, execute it in this context
                await action(context);
              }
            }
          );
        }
      );
    }

    console.debug(
      `[${DefaultHandlerTurnContextHelper.name}][TRACE] ${this.switchToPersonalConversationAsync.name}@end`
    );
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
      // If the user id is available, return the conversation reference from storage
      return this._conversationStore[user.aadObjectId];
    }
    return null;
  }
}
