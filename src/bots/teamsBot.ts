import {
  TeamsActivityHandler,
  TurnContext,
  ConversationState,
  UserState,
  SigninStateVerificationQuery,
  InvokeResponse,
  TeamsInfo,
  TeamsChannelAccount,
} from "botbuilder";

import { HandlerManager } from "../commands/handlerManager";
import { BotConfiguration } from "../config/config";

import {
  AdaptiveCardAction,
  AdaptiveCardActionActivityValue,
} from "../utils/actions";
import { RunnableDialog } from "../dialogs/dialog";
import { TechnicianRepository } from "../repositories/technicians";

export class TeamsBot extends TeamsActivityHandler {
  constructor(
    private readonly _config: BotConfiguration,
    private readonly _conversationState: ConversationState,
    private readonly _userState: UserState,
    private readonly _handlerManager: HandlerManager,
    private readonly _dialog: RunnableDialog, // TODO: Map each dialog to a dialog name
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
    // Entry point for the bot logic which receives all incoming activities.

    await super.run(context).catch((error: Error) => {
      // Catches any errors that occur during the bot logic

      console.error(
        `[${TeamsBot.name}][ERROR] ${this.run.name} error:\n${JSON.stringify(
          error,
          null,
          2
        )}`
      );

      // Unexpected errors are logged and the bot continues to run
    });

    // Save any state changes after the bot logic completes.
    await this._conversationState.saveChanges(context, false);
    await this._userState.saveChanges(context, false);
  }

  /**
   * @inheritdoc
   */
  public async onInvokeActivity(context: TurnContext): Promise<InvokeResponse> {
    console.debug(
      `[${TeamsBot.name}][DEBUG] ${
        this.onInvokeActivity.name
      } activity:\n${JSON.stringify(context.activity, null, 2)}`
    );

    if (context.activity.name === AdaptiveCardAction.Name) {
      // Extracts the action value from the activity when the activity has name 'adaptiveCard/action'
      const activityValue: AdaptiveCardActionActivityValue =
        context.activity.value;

      console.debug(
        `[${TeamsBot.name}][DEBUG] ${
          this.onInvokeActivity.name
        } activityValue:\n${JSON.stringify(activityValue, null, 2)}`
      );

      // Resolves action handler from activity value and dispatches the action
      await this._handlerManager
        .resolveAndDispatch(context, activityValue.action.verb)
        .catch((error: Error) => {
          // Catches any errors that occur during the command handling process

          console.error(
            `[${TeamsBot.name}][ERROR] ${
              this.onInvokeActivity.name
            } error:\n${JSON.stringify(error, null, 2)}`
          );

          // Unexpected errors are logged and the bot continues to run
          return;
        });

      // Return an invoke response to indicate that the activity was handled and to prevent the Teams client from displaying an error message
      // due to the activity not being handled.
      return { status: 200 };
    }

    // Call super implementation for all other invoke activities.
    return await super.onInvokeActivity(context);
  }

  /**
   * @inheritdoc
   */
  public async handleTeamsSigninVerifyState(
    context: TurnContext,
    query: SigninStateVerificationQuery
  ): Promise<void> {
    await this._handleSignInAction(context, query);
  }

  /**
   * @inheritdoc
   */
  public async handleTeamsSigninTokenExchange(
    context: TurnContext,
    query: SigninStateVerificationQuery
  ): Promise<void> {
    await this._handleSignInAction(context, query);
  }

  private async _handleSignInAction(
    context: TurnContext,
    query: SigninStateVerificationQuery
  ): Promise<void> {
    // This activity type can be triggered during the auth flow in either a 'signin/verifyState' or 'signin/tokenExchange' event

    console.debug(
      `[${TeamsBot.name}][DEBUG] ${
        this._handleSignInAction.name
      } activity:\n${JSON.stringify(context.activity, null, 2)}`
    );

    console.debug(
      `[${TeamsBot.name}][DEBUG] ${
        this._handleSignInAction.name
      } query:\n${JSON.stringify(query, null, 2)}`
    );

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
      await this._dialog.stop(context);
    } else {
      // If the auth flow was completed, continues the dialog to run the next step
      await this._dialog.continue(context);
    }
  }

  private async _handleTokenResponse(
    context: TurnContext,
    next: () => Promise<void>
  ): Promise<void> {
    // This activity type can be triggered during the auth flow

    console.debug(
      `[${TeamsBot.name}][DEBUG] ${
        this._handleTokenResponse.name
      } activity:\n${JSON.stringify(context.activity, null, 2)}`
    );

    // Deletes the message corresponding to the auth flow card sent by the bot
    if (context.activity?.replyToId) {
      await context.deleteActivity(context.activity.replyToId);
    }

    // Continues the dialog to run the next step
    await this._dialog.continue(context);

    // By calling next() you ensure that the next BotHandler is run.
    return await next();
  }

  private async _handleMessage(
    context: TurnContext,
    next: () => Promise<void>
  ): Promise<void> {
    console.debug(
      `[${TeamsBot.name}][DEBUG] ${
        this._handleMessage.name
      } activity:\n${JSON.stringify(context.activity, null, 2)}`
    );

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

    console.debug(
      `[${TeamsBot.name}][DEBUG] ${this._handleMessage.name} text: ${text}`
    );
    console.debug(
      `[${TeamsBot.name}][DEBUG] ${this._handleMessage.name} context.activity.conversation.conversationType: ${context.activity.conversation.conversationType}`
    );

    // Gets the caller information
    const fromInfo: TeamsChannelAccount = await TeamsInfo.getMember(
      context,
      context.activity.from.id
    );
    if (!fromInfo) {
      // If the caller email address cannot be resolved, log an error and return as it would be impossible to validate
      // if the caller is a technician
      console.error(
        `[${TeamsBot.name}][ERROR] ${this._handleMessage.name} Unable to resolve caller email address`
      );
      return;
    }

    // Checks if the caller is a technician
    const technician = await this._techRepository.technicianByEmail(
      fromInfo.email
    );
    if (!technician) {
      // If the caller is not a technician, log a warning and return as the caller is not authorized to use the bot
      console.warn(
        `[${TeamsBot.name}][WARN] ${this._handleMessage.name} Caller is not a technician`
      );
      return;
    }

    // Resolves command handler from text and dispatches the command
    await this._handlerManager
      .resolveAndDispatch(context, text)
      .catch((error: Error): Promise<void> => {
        // Catches any errors that occur during the command handling process

        console.error(
          `[${TeamsBot.name}][ERROR] ${
            this._handleMessage.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        // Unexpected errors are logged and the bot continues to run
        return;
      });

    // By calling next() you ensure that the next BotHandler is run.
    return await next();
  }
}
