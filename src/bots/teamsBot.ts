import {
  TeamsActivityHandler,
  TurnContext,
  ConversationState,
  UserState,
  SigninStateVerificationQuery,
  InvokeResponse,
  TeamsInfo,
  TeamsChannelAccount,
  StatusCodes,
} from "botbuilder";

import { BotConfiguration } from "../config/config";
import { HandlerManager, OAuthAwareHandlerManager } from "../commands/manager";
import { DialogManager } from "../dialogs/manager";
import { OAuthDialog } from "../dialogs/oauthDialog";
import {
  AdaptiveCardAction,
  AdaptiveCardActionActivityValue,
} from "../utils/actions";
import { TechnicianRepository } from "../repositories/technicians";
import { ErrorCode, ErrorWithCode } from "@microsoft/teamsfx";

export class TeamsBot extends TeamsActivityHandler {
  constructor(
    private readonly _config: BotConfiguration,
    private readonly _conversationState: ConversationState,
    private readonly _userState: UserState,
    private readonly _handlerManager: HandlerManager,
    private readonly _dialogManager: DialogManager,
    // private readonly _dialog: RunnableDialog, // TODO: Map each dialog to a dialog name
    private readonly _techRepository: TechnicianRepository
  ) {
    super();

    // this.onMembersAdded(this._handleMembersAdded.bind(this));
    // this.onInstallationUpdateAdd(this._handleInstalationUpdateAdd.bind(this));
    // this.onInstallationUpdateRemove(
    //   this._handleInstalationUpdateRemove.bind(this)
    // );
    this.onMessage(this._handleMessage.bind(this));
    this.onTokenResponseEvent(this._handleTokenResponse.bind(this));
  }

  public get config(): BotConfiguration {
    return this._config;
  }

  /**
   * @inheritdoc
   */
  public async run(context: TurnContext): Promise<void> {
    console.debug(`@start`);

    // Entry point for the bot logic which receives all incoming activities
    await super.run(context).catch((error: any): void => {
      // Catches any errors that occur during the bot logic and logs them
      console.error(error);
    });

    // Save any state changes after the bot logic completes
    await this._conversationState.saveChanges(context, false);
    await this._userState.saveChanges(context, false);

    console.debug(`@end`);
  }

  /**
   * @inheritdoc
   */
  public async onInvokeActivity(context: TurnContext): Promise<InvokeResponse> {
    console.debug(`@start`);
    console.debug(
      `context.activity:${context.activity ? "\n" : " "}`,
      context.activity
    );

    if (context.activity.name === AdaptiveCardAction.Name) {
      // Extracts the action value from the activity when the activity has name 'adaptiveCard/action'
      const value: AdaptiveCardActionActivityValue = context.activity.value;

      console.debug(`context.activity.value:${value ? "\n" : " "}`, value);

      // Resolves action handler from 'activity.value.action.verb' and dispatches the action
      await this._handlerManager
        .resolveAndDispatch(context, value.action.verb, value.action.data)
        .catch((error: any): void => {
          // Catches any errors that occur during the action handling and logs them
          console.error(error);
        });

      console.debug(`@end[ADAPTIVE_CARD_ACTION]`);

      // Return an invoke response to indicate that the activity was handled and to prevent the Teams client from displaying an error message
      // due to the activity not being responded to
      return { status: StatusCodes.OK };
    }

    // Call super implementation for all other invoke activities
    const result = await super.onInvokeActivity(context);
    console.debug(`@end`);
    return result;
  }

  /**
   * @inheritdoc
   */
  public async handleTeamsSigninVerifyState(
    context: TurnContext,
    query: SigninStateVerificationQuery
  ): Promise<void> {
    return await this._handleSigninAction(context, query);
  }

  /**
   * @inheritdoc
   */
  public async handleTeamsSigninTokenExchange(
    context: TurnContext,
    query: SigninStateVerificationQuery
  ): Promise<void> {
    return await this._handleSigninAction(context, query);
  }

  private async _handleSigninAction(
    context: TurnContext,
    query: SigninStateVerificationQuery
  ): Promise<void> {
    // This activity type can be triggered during the auth flow in either a 'signin/verifyState' or 'signin/tokenExchange' event
    console.debug(`@start`);
    console.debug(`query:`, query);

    // Retrieves the oauth handler state from the handler manager using the 'replyToId' of the activity
    // which should correspond to the auth flow login card sent by the bot, and would match a state containing
    // the property 'oauthActivityId' set to the 'replyToId' of this activity.
    const oauthHandlerState: any | null = (
      this._handlerManager as OAuthAwareHandlerManager
    ).oauthDialogState(context.activity?.replyToId);

    // Deletes the message corresponding to the auth flow card sent by the bot
    if (context.activity?.replyToId) {
      await context.deleteActivity(context.activity.replyToId);
    }

    // Checks if the auth flow was canceled by the user or completed
    const state = query.state;
    if (state?.indexOf("CancelledByUser") >= 0) {
      // If the auth flow was canceled by the user, ends the dialog
      await context.sendActivity(
        "El usuario rechazó el flujo de autenticación."
      );
      await this._dialogManager
        .stopDialog(context, OAuthDialog.name)
        .catch((error: any): void => {
          // Catches any errors that occur during the dialog stopping and logs them
          console.error(error, error.stack);
        });
    } else {
      // If the auth flow was completed, continues the dialog to runs the next step
      await this._dialogManager
        .continueDialog(context, OAuthDialog.name)
        .catch((error: any): void => {
          // Catches any errors that occur during the dialog continuation and logs them
          console.error(error, error.stack);
        });

      // Checks if the OAuth handler state was found
      if (oauthHandlerState) {
        // If the OAuth handler state was found, dispatches the handling of the current context to the
        // handler stored in the state and supplies it with the original command message and its context
        await this._handlerManager
          .dispatch(oauthHandlerState.handler, context, null, {
            sequenceId: oauthHandlerState.sequenceId,
            commandMessage: oauthHandlerState.commandMessage,
            commandMessageContext: oauthHandlerState.commandMessageContext,
          })
          .catch((error: any): void => {
            // Catches any errors that occur during the handler dispatching and logs them.
            console.error(error, error.stack);
          });
      }
    }

    console.debug(`@end`);
  }

  private async _handleTokenResponse(
    context: TurnContext,
    next: () => Promise<void>
  ): Promise<void> {
    // This activity type can be triggered during the OAuth flow
    console.debug(`@start`);
    console.debug(`context.activity:`, context.activity);

    if (context.activity?.replyToId) {
      // Deletes the message corresponding to the OAuth flow card sent by the bot
      await context.deleteActivity(context.activity.replyToId);
    }

    // Continues the dialog to run the next step
    await this._dialogManager
      .continueDialog(context, OAuthDialog.name)
      .catch((error: any): void => {
        // Catches any errors that occur during the dialog continuation and logs them
        console.error(error, error.stack);
      });

    console.debug(`@end`);

    // By calling next() you ensure that the next BotHandler is run.
    return await next();
  }

  private async _handleMessage(
    context: TurnContext,
    next: () => Promise<void>
  ): Promise<void> {
    console.debug(`@start`);
    console.debug(`context.activity:`, context.activity);

    // throw new ErrorWithCode(
    //   "This method is not implemented yet. Please implement the _handleMessage method to handle incoming messages.",
    //   ErrorCode.FailedOperation
    // );

    // Gets the text of the activity
    let text = context.activity.text;
    // Remove the mention of this bot from activity text
    const removedMentionText = TurnContext.removeRecipientMention(
      context.activity
    );
    if (removedMentionText) {
      // Remove any line breaks as well as leading and trailing white spaces
      text = removedMentionText.toLowerCase().replace(/\n|\r/g, "").trim();
    }

    if (!text || text.length === 0) {
      // If the text is empty, check if activity value is present and contains an 'action.verb'
      console.warn(`Empty message text`);

      if (context.activity.value?.action) {
        // If the activity value contains an action, delegate the handling to the 'onInvokeActivity' method
        // Set the activity name to 'adaptiveCard/action' to trigger the onInvokeActivity method
        context.activity.name = AdaptiveCardAction.Name;
        await this.onInvokeActivity(context);
        console.debug("@end[ADAPTIVE_CARD_ACTION]");
        return;
      }
    }

    console.debug(`text: ${text}`);
    console.debug(
      `context.activity.conversation.conversationType:`,
      context.activity.conversation.conversationType
    );

    // Gets the caller information
    const fromInfo: TeamsChannelAccount = await TeamsInfo.getMember(
      context,
      context.activity.from.id
    );
    if (!fromInfo) {
      // If the caller email address cannot be resolved, log an error and return as it would be impossible to validate
      // if the caller is a technician
      console.error(`Unable to resolve caller email address`);
      return;
    }

    if (!this.config.allowAll) {
      // If the bot is not configured to allow all users, check if the caller is a technician
      const technician = await this._techRepository.technicianByEmail(
        fromInfo.email
      );
      if (!technician) {
        // If the caller is not a technician, log a warning and return as the caller is not authorized to use the bot
        console.warn(`Caller is not a technician`);
        console.debug(`@end[UNAUTHORIZED_CALLER]`);

        // By calling next() you ensure that the next BotHandler is run.
        return await next();
      }
    }

    // Resolves command handler from text and dispatches the command
    await this._handlerManager
      .resolveAndDispatch(context, text)
      .catch((error: any): void => {
        console.error(error, error.stack);
      });

    console.debug(`@end`);

    // By calling next() you ensure that the next BotHandler is run.
    return await next();
  }
}
