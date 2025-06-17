import { randomUUID } from "crypto";
import {
  CardFactory,
  ChannelInfo,
  ConversationAccount,
  MessageFactory,
  TeamDetails,
  TeamsChannelAccount,
  TeamsInfo,
  TurnContext,
} from "botbuilder";
// import { CommandMessage } from "@microsoft/teamsfx";

import * as ACData from "adaptivecards-templating";

import {
  ActionHandler,
  CommandHandler,
  Handler,
  OAuthCommandHandler,
} from "./handler";
import { HandlerTurnContextHelper, HandlerTurnContext } from "./context";
import { DialogManager, OAuthStatus } from "../dialogs/manager";
import {
  AdaptiveCardAction,
  AdaptiveCardActionAuthRefreshDataInput,
} from "../utils/actions";
import {
  MicrosoftGraphClient,
  TeamChannel,
  TeamChannelMessage,
} from "../utils/graphClient";

import authRefreshCard from "../adaptiveCards/templates/authRefreshCard.json";

export type HandlerState = any;

export interface HandlerManager {
  resolve(pattern: string, type: HandlerType.Command): CommandHandler | null;
  resolve(pattern: string, type: HandlerType.Action): ActionHandler | null;
  resolve(pattern: string, type: HandlerType): Handler | null;

  dispatch(
    command: Handler,
    context: TurnContext,
    message: string,
    data?: any
  ): Promise<any>;

  resolveAndDispatch(
    context: TurnContext,
    message: string,
    data?: any
  ): Promise<any>;

  handlerState(sequenceId: string): any | null;
  handlerState(sequenceId: string, state: any): void;
}

export enum HandlerType {
  Command,
  Action,
}

export interface HandlerMessageContext {
  team: TeamDetails | null;
  channel: TeamChannel | null;
  thread: TeamChannelMessage | null;
  threadFrom: TeamsChannelAccount | null;
  reply: TeamChannelMessage | null;
  replyFrom: TeamsChannelAccount | null;
  // conversation: ConversationAccount;
  // from: TeamsChannelAccount;
}

export interface HandlerMessage {
  // extends CommandMessage {
  text: string;
  matches?: RegExpMatchArray;
}

export interface DefaultHandlerManagerOptions {
  commands: CommandHandler[];
  actions: ActionHandler[];
}

export class DefaultHandlerManager implements HandlerManager {
  private readonly _handlerStatesMap: Map<string, HandlerState> = new Map<
    string,
    HandlerState
  >();

  constructor(
    private readonly _graphClient: MicrosoftGraphClient,
    private readonly _contextHelper: HandlerTurnContextHelper,
    private readonly _dialogManager: DialogManager,
    private readonly _options: Partial<DefaultHandlerManagerOptions>
  ) {}

  protected get dialogManager(): DialogManager {
    return this._dialogManager;
  }

  protected get contextHelper(): HandlerTurnContextHelper {
    return this._contextHelper;
  }

  protected get graphClient(): MicrosoftGraphClient {
    return this._graphClient;
  }

  protected get options(): Partial<DefaultHandlerManagerOptions> {
    return this._options;
  }

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
    data?: any
  ): Promise<any> {
    console.debug(
      `[${DefaultHandlerManager.name}][TRACE] ${this.dispatch.name}@start`
    );

    if (!handler) {
      console.debug(
        `[${DefaultHandlerManager.name}][TRACE] ${this.dispatch.name}@end[NO_HANDLER]`
      );

      // If the handler is not found, do nothing
      return;
    }

    // Builds the command message object from the message and handler or uses the one provided in the data object
    let handlerMessage: HandlerMessage | null = this.buildCommandMessage(
      handler,
      message,
      data
    );

    const sequenceId: string = data?.sequenceId
      ? data.sequenceId
      : randomUUID();

    // Creates a handler context wrapper for the current turn context
    const handlerContext: HandlerTurnContext = this.buildTurnContext(
      context,
      handlerMessage
    );

    // Builds the command message context from the handler context or uses the one provided in the data object
    let handlerMessageContext: HandlerMessageContext | null =
      await this.buildCommandMessageContext(handlerContext, data);

    console.debug(
      `[${DefaultHandlerManager.name}][DEBUG] ${this.dispatch.name} sequenceId: ${sequenceId}`
    );

    // TODO: Validate that the handler state exists when sequenceId is supplied

    // Tries to fetch the handler state using the sequenceId.
    const handlerState: any | null = this.handlerState(sequenceId);
    if (!handlerState) {
      // If the handler state is not found, creates a new state for the handler
      this.handlerState(sequenceId, {
        sequenceId: sequenceId,
        startActivity: context.activity,
        // lastActivity: context.activity,
        conversationReference: TurnContext.getConversationReference(
          context.activity
        ),
        commandMessageContext: handlerMessageContext,
        commandMessage: handlerMessage,
        handler: handler,
      });
    }
    // Sets the 'handlerContext' handler state to the current handler state
    handlerContext.state = this.handlerState(sequenceId);

    console.debug(
      `[${DefaultHandlerManager.name}][DEBUG] ${
        this.dispatch.name
      } data:\n${JSON.stringify(data, null, 2)}`
    );

    // console.debug(
    //   `[${DefaultHandlerManager.name}][DEBUG] ${
    //     this.dispatch.name
    //   } handlerContext.state: ${JSON.stringify(handlerContext.state, null, 2)}`
    // );

    // Dispatch the handling of the incoming message to the resolved handler
    let result: any = await this.doDispatch(
      handler,
      handlerContext,
      handlerMessage,
      handlerMessageContext,
      data
    );

    console.debug(
      `[${DefaultHandlerManager.name}][TRACE] ${this.dispatch.name}@end`
    );

    return result;
  }

  protected async doDispatch(
    handler: Handler,
    handlerContext: HandlerTurnContext,
    commandMessage: HandlerMessage,
    commandMessageContext: HandlerMessageContext,
    _?: any
  ): Promise<void> {
    console.debug(
      `[${DefaultHandlerManager.name}][TRACE] ${this.doDispatch.name}@start`
    );

    // Run the handler in the current context
    const result: any = await handler.run(
      handlerContext,
      commandMessage,
      commandMessageContext
    );

    console.debug(
      `[${DefaultHandlerManager.name}][TRACE] ${this.doDispatch.name}@end`
    );

    return result;
  }

  public async resolveAndDispatch(
    context: TurnContext,
    message: string,
    data?: any
  ): Promise<any> {
    console.debug(
      `[${DefaultHandlerManager.name}][TRACE] ${this.resolveAndDispatch.name}@start`
    );

    let handler: Handler | null = null;
    if (context.activity.name == AdaptiveCardAction.Name) {
      // If the activity name is "adaptiveCard/action", it is an action handler
      handler = this.resolve(message, HandlerType.Action);
    } else {
      // Otherwise, it is a command handler
      handler = this.resolve(message, HandlerType.Command);
    }

    // Dispatches the handling of the incoming message to the resolved handler if it was found
    const result = await this.dispatch(handler, context, message, data);

    console.debug(
      `[${DefaultHandlerManager.name}][TRACE] ${this.resolveAndDispatch.name}@end`
    );

    return result;
  }

  protected buildTurnContext(
    context: TurnContext,
    handlerMessage: HandlerMessage | null
  ): HandlerTurnContext {
    // Builds a handler context from the current turn context and the command message
    return HandlerTurnContext.from(
      context,
      handlerMessage,
      this._dialogManager,
      this._contextHelper
    );
  }

  protected buildCommandMessage(
    handler: Handler,
    message: string,
    data?: any
  ): HandlerMessage | null {
    let commandMessage: HandlerMessage | null = null;

    if (
      data &&
      typeof data === "object" &&
      "commandMessage" in data &&
      data.commandMessage &&
      typeof data.commandMessage === "object"
    ) {
      // If the command message is provided in the data object, use it
      commandMessage = data.commandMessage;
    } else {
      // Constructs the command message object
      if ("pattern" in handler && !!handler.pattern) {
        // If the command handler pattern is a regular expression, match the command message with the pattern
        // and get the matched groups
        if (handler.pattern instanceof RegExp) {
          const matches: RegExpMatchArray | null = message.match(
            handler.pattern
          );
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
    }

    return commandMessage;
  }

  protected async buildCommandMessageContext(
    handlerContext: HandlerTurnContext,
    data?: any
  ): Promise<HandlerMessageContext | null> {
    let commandMessageContext: HandlerMessageContext | null = null;
    if (
      data &&
      "commandMessageContext" in data &&
      data.commandMessageContext &&
      typeof data.commandMessageContext === "object"
    ) {
      // If the command message context is provided in the data object, use it
      commandMessageContext = data.commandMessageContext;
    } else {
      // Resolves the thread conversation information where the command was triggered.
      // This is the first message in the thread in which the command was triggered
      const conversation: ConversationAccount =
        handlerContext.context.activity.conversation;

      // Resolves the team and channel information from where the command was triggered
      let team: TeamDetails | null = null;
      let channel: TeamChannel | null = null;
      if (conversation.isGroup) {
        // If the conversation is a group conversation, retrieve the team and channel information

        // Resolves the team information where the command was triggered
        team = await TeamsInfo.getTeamDetails(handlerContext.context).catch(
          (error: Error): TeamDetails => {
            console.error(
              `[${DefaultHandlerManager.name}][ERROR] ${this.dispatch.name} team error: ${error.message}`
            );
            return null;
          }
        );

        // Resolves the channel information where the command was triggered
        const channels: ChannelInfo[] = (
          await TeamsInfo.getTeamChannels(handlerContext.context).catch(
            (error: Error): ChannelInfo[] => {
              console.error(
                `[${DefaultHandlerManager.name}][ERROR] ${this.dispatch.name} channels error: ${error.message}`
              );
              return [];
            }
          )
        ).filter(
          (channel: ChannelInfo) =>
            channel.id ===
            (conversation?.id?.indexOf(";") >= 0
              ? conversation.id.split(";")[0]
              : conversation.id)
        );
        const channelInfo: ChannelInfo =
          channels?.length > 0 ? channels[0] : null;

        channel = await this._graphClient
          .teamChannel(team?.aadGroupId, channelInfo?.id)
          .catch((error: Error): TeamChannel => {
            console.error(
              `[${DefaultHandlerManager.name}][ERROR] ${this.dispatch.name} channel error: ${error.message}`
            );
            return null;
          });
      }

      // Resolves the information for the caller who triggered the command
      const from: TeamsChannelAccount | null = await TeamsInfo.getMember(
        handlerContext.context,
        handlerContext.context.activity.from.id
      ).catch((error: Error): TeamsChannelAccount => {
        console.error(
          `[${DefaultHandlerManager.name}][ERROR] ${this.dispatch.name} from error: ${error.message}`
        );
        return null;
      });

      // Resolves the thread initial message id from the conversation id. If this id is the same as the id for a current activity with type "message",
      // it is the message that triggered the command, otherwise the command was triggered in a reply to this message and the "id" field in the activity
      // contains said id.
      let messageId: string =
        conversation.id.indexOf(";") >= 0
          ? conversation.id.split(";")[1]
          : conversation.id;
      messageId = messageId.replace("messageid=", "");

      let teamMessage: TeamChannelMessage | null = null;
      let threadFrom: TeamsChannelAccount | null = null;
      if (team && channel) {
        // If the team and channel information is available, resolves the thread message where the command was triggered
        teamMessage = await this._graphClient.teamChannelMessage(
          team?.aadGroupId,
          channel?.id,
          messageId
        );

        // Resolves the thread creator information
        threadFrom = await TeamsInfo.getMember(
          handlerContext.context,
          teamMessage?.from?.user?.id
        ).catch((error: Error): TeamsChannelAccount => {
          console.error(
            `[${DefaultHandlerManager.name}][ERROR] ${this.dispatch.name} threadFrom error: ${error.message}`
          );
          return null;
        });
      }

      // Create the context data containing the team, channel, conversation, caller and thread initiator information
      // from the context where the command was triggered (Some of the information may not be available)
      commandMessageContext = {
        team: team,
        channel: channel,
        thread: teamMessage,
        // conversation: conversation,
        threadFrom: threadFrom,
        // from: from,
        // TODO: resolve the reply message that may be the same as the thread message or a reply to it(when in a channel context). This may be more difficult when in personal context
        reply: null,
        replyFrom: from,
      };
    }

    return commandMessageContext;
  }

  public handlerState(sequenceId: string): any | null;
  public handlerState(sequenceId: string, state: HandlerState): void;
  public handlerState(
    sequenceId: string,
    state?: HandlerState
  ): any | null | void {
    if (!sequenceId) {
      // If the 'sequenceId' is not provided, do nothing
      return null;
    }

    if (!state) {
      // If the 'state' is not provided, return the current dialog state for the given 'sequenceId'
      return this._handlerStatesMap.get(sequenceId) ?? null;
    }

    // Sets the dialog state for the given 'sequenceId'
    this._handlerStatesMap.set(sequenceId, state);
  }

  protected handlerStates(): MapIterator<[string, HandlerState]> {
    return this._handlerStatesMap.entries();
  }
}

export class OAuthAwareHandlerManager extends DefaultHandlerManager {
  constructor(
    graphClient: MicrosoftGraphClient,
    contextHelper: HandlerTurnContextHelper,
    dialogManager: DialogManager,
    options?: Partial<DefaultHandlerManagerOptions>
  ) {
    super(graphClient, contextHelper, dialogManager, options);
  }

  protected async doDispatch(
    handler: Handler,
    handlerContext: HandlerTurnContext,
    commandMessage: HandlerMessage,
    commandMessageContext: HandlerMessageContext,
    data?: any
  ): Promise<any> {
    if (handler instanceof OAuthCommandHandler) {
      // If the handler is an OAuth command handler, it requires interaction with an oauth dialog
      return await this._dispatchOAuthHandler(
        handler,
        handlerContext,
        commandMessage,
        commandMessageContext
        // data
      );
    }

    // Dispatches the handling of the incoming message to the resolved handler if it was found
    return await super.doDispatch(
      handler,
      handlerContext,
      commandMessage,
      commandMessageContext,
      data
    );
  }

  public oauthDialogState(oauthActivityId: string): any | null {
    // Returns the current dialog state for the given 'activityId'
    if (!oauthActivityId) {
      // If the 'activityId' is not provided, do nothing
      return undefined;
    }

    for (const [_, value] of this.handlerStates()) {
      if ("oauthActivityId" in value) {
        if (value.oauthActivityId === oauthActivityId) {
          // If the 'activityId' matches, return the dialog state
          return value;
        }
      }

      return this.handlerState(oauthActivityId) ?? null;
    }
  }

  private async _dispatchOAuthHandler(
    handler: OAuthCommandHandler,
    handlerContext: HandlerTurnContext,
    commandMessage: HandlerMessage,
    commandMessageContext: HandlerMessageContext
    // data?: any
  ): Promise<void> {
    // Creates and stores the dialog state for the OAuthDialog to be used later and handles the OAuth flow sequence
    // supplying the handler with an OAuth token
    console.debug(
      `[${DefaultHandlerManager.name}][TRACE] ${this._dispatchOAuthHandler.name}@start`
    );

    // Retrieves the dialog state for the oauth handler from the handler context
    let oauthHandlerState: HandlerState = handlerContext.state;

    if (oauthHandlerState?.oauthStatus === undefined) {
      // If the 'oauthStatus' is not set, it means that the handler is being invoked for the first time
      // and we initialize the oauth handler state properties
      oauthHandlerState.oauthStatus = OAuthStatus.Waiting;
      oauthHandlerState.oauthActivityId = null;
      oauthHandlerState.oauthResult = null;

      // Switch to personal context and send the auth refresh adaptive card
      await handlerContext.switchToPersonalConversationAsync(
        async (wrapper: HandlerTurnContext): Promise<void> => {
          console.debug(
            `[${DefaultHandlerManager.name}][TRACE] ${this._dispatchOAuthHandler.name} handlerContext.switchToPersonalContext <anonymous>(wrapper: HandlerTurnContext): Promise<void>@start`
          );

          // The personal context activity "from" field indicating the user who initiated the command
          // is set to the command message context "from" field to ensure that the dialog can be run
          // with the correct user information in the personal context (The newly created conversation context
          // does not have a value set for the "from" field)
          // ctx.context.activity.from = commandMessageContext.from;

          // Creates the card data to be passed to the adaptive card template which will be used to expand the adaptive card template with the actual data
          const cardData: AdaptiveCardActionAuthRefreshDataInput = {
            sequenceId: oauthHandlerState.sequenceId,
            userIds: [commandMessageContext.replyFrom.id],
          };

          // Expands the adaptive card template with the card data by replacing the placeholders
          // with the actual data
          const cardJson = new ACData.Template(authRefreshCard).expand({
            $root: cardData,
          });

          // oauthHandlerState.lastActivity = wrapper.context.activity;

          // Sends the adaptive card
          await wrapper.context.sendActivity(
            MessageFactory.attachment(CardFactory.adaptiveCard(cardJson))
          );

          console.debug(
            `[${DefaultHandlerManager.name}][TRACE] ${this._dispatchOAuthHandler.name} handlerContext.switchToPersonalContext <anonymous>(wrapper: HandlerTurnContext): Promise<void>@end`
          );
        }
      );

      console.debug(
        `[${DefaultHandlerManager.name}][TRACE] ${this._dispatchOAuthHandler.name}@end[OAUTH HANDLER NEW]`
      );
    } else {
      if (!oauthHandlerState) {
        // If the dialog state is not found, do nothing
        console.debug(
          `[${DefaultHandlerManager.name}][TRACE] ${this._dispatchOAuthHandler.name}@end[OAUTH_STATE_NOT_FOUND]`
        );
        return;
      }

      if (oauthHandlerState.oauthStatus === OAuthStatus.Waiting) {
        // If the oauth status is waiting, it means that the dialog is waiting for the user to complete the OAuth flow
        console.debug(
          `[${DefaultHandlerManager.name}][TRACE] ${this._dispatchOAuthHandler.name}@end[OAUTH_STATUS_WAITING]`
        );
        return;
      }

      // If the dialog state is found switch to the original conversation and delehgate the handling to the handler present in the state
      await this.contextHelper.switchToConversationAsync(
        handlerContext.context,
        oauthHandlerState.conversationReference,
        async (ctx: TurnContext): Promise<void> => {
          console.debug(
            `[${DefaultHandlerManager.name}][TRACE] ${this._dispatchOAuthHandler.name} this._contextHelper.switchToConversation <anonymous>(ctx: TurnContext): Promise<void>@start`
          );

          // Sets the activity in the context to the one stored in the handler state, which should be
          (ctx as any)["_activity"] = oauthHandlerState.startActivity;

          // Runs the handler in the original conversation supplying the oauth result
          await oauthHandlerState.handler.run(
            HandlerTurnContext.from(
              ctx,
              oauthHandlerState.commandMessage,
              this.dialogManager,
              this.contextHelper
            ),
            oauthHandlerState.commandMessage,
            oauthHandlerState.commandMessageContext,
            oauthHandlerState.dialogResult
          );

          console.debug(
            `[${DefaultHandlerManager.name}][TRACE] ${this._dispatchOAuthHandler.name} this._contextHelper.switchToConversation <anonymous>(ctx: TurnContext): Promise<void>@end`
          );
        }
      );

      console.debug(
        `[${DefaultHandlerManager.name}][TRACE] ${this._dispatchOAuthHandler.name}@end[OAUTH_HANDLER_EXISTING]`
      );
    }
  }
}
