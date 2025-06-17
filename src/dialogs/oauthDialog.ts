import {
  ComponentDialog,
  Dialog,
  DialogContext,
  DialogContextError,
  DialogSet,
  DialogState,
  DialogTurnResult,
  DialogTurnStatus,
  OAuthPrompt,
  WaterfallDialog,
  WaterfallStepContext,
} from "botbuilder-dialogs";
import {
  ActivityTypes,
  ConversationState,
  StatePropertyAccessor,
  Storage,
  TurnContext,
  tokenExchangeOperationName,
  verifyStateOperationName,
  TokenResponse,
  InputHints,
  Activity,
  ResourceResponse,
} from "botbuilder";
import { ErrorCode, ErrorWithCode } from "@microsoft/teamsfx";

import { HandlerManager, HandlerState } from "../commands/manager";
import { OAuthStatus } from "./manager";
import { RunnableDialog } from "./dialog";
import { BotConfiguration } from "../config/config";

export type OAuthDialogWaterfallStepContextOptions = {
  sequenceId?: string;
};

// const TEAMS_BOT_SSO_PROMPT_ID = "TeamsBotSsoPrompt";

export class OAuthDialog extends ComponentDialog implements RunnableDialog {
  public readonly name: string = OAuthDialog.name;

  private static readonly DIALOG_STATE_PROPERTY: string = "dialogStateProperty";

  private static readonly OAUTH_PROMPT_ID: string = "OAuthPrompt";
  private static readonly MAIN_WATERFALL_DIALOG_ID: string =
    "MainWaterfallDialog";
  private static readonly MAIN_DIALOG_ID: string = "MainDialog";

  private readonly _dialogStateAccessor: StatePropertyAccessor<DialogState>;
  private _dedupStorageKeys: string[] = [];

  constructor(
    config: BotConfiguration,
    conversationState: ConversationState,
    private readonly _dedupStorage: Storage,
    private readonly _handlerManager: HandlerManager
  ) {
    super(OAuthDialog.MAIN_DIALOG_ID);

    this._dialogStateAccessor = conversationState.createProperty(
      OAuthDialog.DIALOG_STATE_PROPERTY
    );

    // const settings: TeamsBotSsoPromptSettings = {
    //   scopes: [
    //     "User.Read",
    //     "Channel.ReadBasic.All",
    //     "ChannelMessage.Read.All",
    //     "Team.ReadBasic.All",
    //     "ChatMessage.Read",
    //     "ProfilePhoto.Read.All",
    //     "Files.Read.All",
    //   ],
    //   timeout: 900000,
    //   endOnInvalidMessage: true,
    // };
    // const authConfig: OnBehalfOfCredentialAuthConfig = {
    //   authorityHost: config.authorityHost,
    //   clientId: config.clientId,
    //   tenantId: config.tenantId,
    //   clientSecret: config.clientSecret,
    // };
    // const loginUrl = 'https://login.microsoftonline.com' // `https://${config.botDomain}/auth-start.html`;
    // this.addDialog(
    //   new TeamsBotSsoPrompt(
    //     authConfig,
    //     loginUrl,
    //     TEAMS_BOT_SSO_PROMPT_ID,
    //     // {
    //     //   title: "Flujo Consentimiento",
    //     //   text: "Revise y acepte el flujo de consentimiento para continuar.",
    //     //   timeout: 900000,
    //     //   endOnInvalidMessage: true,
    //     //   showSignInLink: true,
    //     //   connectionName: config.botConnectionName,
    //     // }
    //     settings
    //   )
    // );

    const oauthPrompt = new OAuthPrompt(
      OAuthDialog.OAUTH_PROMPT_ID,
      {
        title: "Flujo Consentimiento",
        text: "Revise y acepte el flujo de consentimiento para continuar.",
        timeout: 900000,
        endOnInvalidMessage: true,
        showSignInLink: true,
        connectionName: config.botConnectionName,
      }
      // async (
      //   prompt: PromptValidatorContext<TokenResponse>
      // ): Promise<boolean> => {
      //   console.debug(
      //     `[${SSOCommandDispatchDialog.name}][DEBUG] [${
      //       OAuthPrompt.name
      //     }] promptValidator prompt:\n${JSON.stringify(prompt, null, 2)}`
      //   );
      //   return false;
      // }
    );
    oauthPrompt.beginDialog = this._cacheBypass;
    this.addDialog(oauthPrompt);

    this.addDialog(
      new WaterfallDialog<OAuthDialogWaterfallStepContextOptions>(
        OAuthDialog.MAIN_WATERFALL_DIALOG_ID,
        [
          this._promptStep.bind(this),
          this._dedupStep.bind(this),
          this._dispatchStep.bind(this),
        ]
      )
    );

    this.initialDialogId = OAuthDialog.MAIN_WATERFALL_DIALOG_ID;
  }

  /**
   * The run method handles the incoming activity (in the form of a DialogContext) and passes it through the dialog system.
   * If no dialog is active, it will start the default dialog.
   *
   * @param {TurnContext} context The context object for this turn of the conversation
   * @returns {Promise<DialogTurnResult>} A promise representing the result of the dialog's turn
   */
  public async run(
    context: TurnContext,
    data?: OAuthDialogWaterfallStepContextOptions
  ): Promise<DialogTurnResult> {
    const dialogSet = new DialogSet(this._dialogStateAccessor);
    dialogSet.add(this);

    const dialogContext = await dialogSet.createContext(context);
    const dialogResult = await dialogContext.continueDialog();

    if (dialogResult?.status === DialogTurnStatus.empty) {
      return await dialogContext.beginDialog(this.id, data);
    }
    // return dialogResult;
    return await dialogContext.continueDialog();
  }

  /**
   * The continue method handles the incoming activity (in the form of a DialogContext) and passes it through the dialog system.
   * If no dialog is active, no dialog will be started and an empty `DialogTurnResult` will be returned.
   *
   * @param {TurnContext} context The context object for this turn of the conversation
   * @returns {Promise<DialogTurnResult>} A promise representing the result of the dialog's turn
   */
  public async continue(context: TurnContext): Promise<DialogTurnResult> {
    const dialogSet = new DialogSet(this._dialogStateAccessor);
    dialogSet.add(this);

    const dialogContext = await dialogSet.createContext(context);
    const dialogResult = await dialogContext.continueDialog();

    if (dialogResult?.status === DialogTurnStatus.empty) {
      // return await dialogContext.beginDialog(this.id);
      return Promise.resolve({
        status: DialogTurnStatus.empty,
      });
    }
    return await dialogContext.continueDialog();
  }

  /**
   * The stop method handles the incoming activity (in the form of a DialogContext) and ends the dialog.
   *
   * @param {TurnContext} context The context object for this turn of the conversation
   * @returns {Promise<DialogTurnResult>} A promise representing the result of the dialog's turn
   */
  public async stop(context: TurnContext): Promise<DialogTurnResult> {
    const dialogSet = new DialogSet(this._dialogStateAccessor);
    dialogSet.add(this);

    const dialogContext = await dialogSet.createContext(context);

    // await this._dialogStateAccessor.delete(context);
    return await dialogContext.cancelAllDialogs();
  }

  private async _promptStep(
    stepContext: WaterfallStepContext<OAuthDialogWaterfallStepContextOptions>
  ): Promise<DialogTurnResult> {
    // Prompts the user to accept the authentication flow

    console.debug(
      `[${OAuthDialog.name}][TRACE] [${WaterfallDialog.name}] ${this._promptStep.name}@start`
    );

    console.debug(
      `[${OAuthDialog.name}][DEBUG] [${WaterfallDialog.name}] ${
        this._promptStep.name
      } options:\n${JSON.stringify(stepContext.options, null, 2)}`
    );

    // Starts the OAuth prompt dialog
    await stepContext
      .beginDialog(
        OAuthDialog.OAUTH_PROMPT_ID,
        this._handlerManager.handlerState(stepContext.options?.sequenceId)
      )
      // .beginDialog(TEAMS_BOT_SSO_PROMPT_ID)
      .catch((error: DialogContextError): Promise<DialogTurnResult> => {
        // Catches any errors that occur during the OAuth prompt dialog in the prompt step

        console.error(
          `[${OAuthDialog.name}][ERROR] [${WaterfallDialog.name}] ${
            this._promptStep.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        console.debug(
          `[${OAuthDialog.name}][TRACE] [${WaterfallDialog.name}] ${this._promptStep.name}@end[ERROR]`
        );

        // Unexpected errors are logged and the bot continues to run to the next step
        return stepContext.next();
      });

    console.debug(
      `[${OAuthDialog.name}][TRACE] [${WaterfallDialog.name}] ${this._promptStep.name}@end`
    );

    // End the turn and wait for the user to accept the authentication flow
    return Dialog.EndOfTurn;
    // return await stepContext.next();
  }

  private async _dedupStep(
    stepContext: WaterfallStepContext<OAuthDialogWaterfallStepContextOptions>
  ): Promise<DialogTurnResult> {
    // Deduplicates the token exchange request to prevent processing the same token exchange multiple times

    console.debug(
      `[${OAuthDialog.name}][TRACE] [${WaterfallDialog.name}] ${this._dedupStep.name}@start`
    );

    // Get the token response from the previous step
    const tokenResult: Partial<TokenResponse> = stepContext.result;
    // const tokenResult: Partial<TeamsBotSsoPromptTokenResponse> =
    //   stepContext.result;

    // Only dedup after promptStep to make sure that all Teams' clients receive the login request
    if (tokenResult && (await this._shouldDedup(stepContext.context))) {
      // If the token exchange is a duplicate, end the turn without dispatching the command handler.
      // This is to prevent the bot from processing the same token exchange multiple times
      console.debug(
        `[${OAuthDialog.name}][TRACE] [${WaterfallDialog.name}] ${this._dedupStep.name}@end[DUPLICATE_TOKEN]`
      );

      return Dialog.EndOfTurn;
    }

    console.debug(
      `[${OAuthDialog.name}][TRACE] [${WaterfallDialog.name}] ${this._dedupStep.name}@end`
    );

    // Continue to the next step with the token response as the result
    return await stepContext.next(tokenResult);
  }

  private async _dispatchStep(
    stepContext: WaterfallStepContext<OAuthDialogWaterfallStepContextOptions>
  ): Promise<DialogTurnResult> {
    // Dispatches the command handler with the token response if the token exchange was successful
    console.debug(
      `[${OAuthDialog.name}][TRACE] [${WaterfallDialog.name}] ${this._dispatchStep.name}@start`
    );

    // Get the token response from the previous step
    const tokenResult: Partial<TokenResponse> = stepContext.result;
    // const tokenResult: Partial<TeamsBotSsoPromptTokenResponse> =
    //   stepContext.result;

    console.debug(
      `[${OAuthDialog.name}][DEBUG] [${WaterfallDialog.name}] ${
        this._dispatchStep.name
      } options:\n${JSON.stringify(stepContext.options, null, 2)}`
    );
    console.debug(
      `[${OAuthDialog.name}][DEBUG] [${WaterfallDialog.name}] ${
        this._dispatchStep.name
      } tokenResult:\n${JSON.stringify(tokenResult, null, 2)}`
    );

    // Get the handler state using the sequenceId from the dialog options
    const handlerState: HandlerState = this._handlerManager.handlerState(
      stepContext.options?.sequenceId
    );

    // Check if the handler state is present
    if (!handlerState) {
      // If the handler state is not present, log an error and end the dialog
      console.error(
        `[${OAuthDialog.name}][ERROR] [${WaterfallDialog.name}] ${this._dispatchStep.name} handlerState is not present`
      );
      console.debug(
        `[${OAuthDialog.name}][TRACE] [${WaterfallDialog.name}] ${this._dispatchStep.name}@end[NO_HANDLER_STATE]`
      );

      // Unable to retrieve handler state or an unexpected error occurred
      return await stepContext.endDialog();
    }

    // Check if the token exchange was successful
    if (!tokenResult) {
      // If the token exchange was unsuccessful, log an error and send a message to the user
      console.error(
        `[${OAuthDialog.name}][ERROR] [${WaterfallDialog.name}] ${this._dispatchStep.name} tokenResult is not present`
      );

      await stepContext.context.sendActivity(
        `No se puede iniciar sesión o el usuario rechazó el flujo de autenticación.`
      );

      console.debug(
        `[${OAuthDialog.name}][TRACE] [${WaterfallDialog.name}] ${this._dispatchStep.name}@end[NO_TOKEN]`
      );

      // Unable to retrieve token or an unexpected error occurred
      return await stepContext.endDialog();
    }

    // Check if the command is present in the dialog options
    // const command: string = stepContext.options?.data?.command;

    // Resolves command handler from text, resolution can only be a `HandlerType.Command` type handler as this dialog should only be reacheable from the `authRefresh` action
    // and the `authRefresh` action is only triggered by a message that matched a command handler. Since the initial context has changed, due to the authentication flow
    // steps triggering 'signin/*' invoke actions the handler needs to be resolved again here as the context switch(and subsequently any bot turn switch), jsonifies any dialog options
    // passed to the dialog context and as such any handler passed in the options would be lost.
    // await this._handlerManager
    //   .resolveAndDispatch(stepContext.context, command, {
    //     hint: ContextHint.Dialog,
    //     token: tokenResult.token,
    //     ...stepContext.options?.data,
    //   })
    //   .catch((error: Error) => {
    //     // Catches any errors that occur during the command handling process

    //     console.error(
    //       `[${OAuthDialog.name}][ERROR] ${
    //         this._dispatchStep.name
    //       } error:\n${JSON.stringify(error, null, 2)}`
    //     );

    //     // Unexpected errors are logged and the bot continues to run
    //     return;
    //   });

    // Sets the dialog result to the token result and updates the dialog status to complete in the handler state
    handlerState.dialogResult = tokenResult;
    handlerState.dialogStatus = OAuthStatus.Complete;

    console.debug(
      `[${OAuthDialog.name}][TRACE] [${WaterfallDialog.name}] ${this._dispatchStep.name}@end`
    );

    return await stepContext.endDialog({
      sequenceId: stepContext.options?.sequenceId,
      tokenResult,
    });
  }

  /**
   * @inheritdoc
   */
  public async onEndDialog(context: TurnContext): Promise<void> {
    // Cleans up the deduplication storage by removing all keys related to the current conversation
    console.debug(
      `[${OAuthDialog.name}][TRACE] ${this.onEndDialog.name}@start`
    );
    console.debug(
      `[${OAuthDialog.name}][DEBUG] ${
        this.onEndDialog.name
      } this._dedupStorageKeys:\n${JSON.stringify(
        this._dedupStorageKeys,
        null,
        2
      )}`
    );

    // Get the conversation id from the context activity and filter the deduplication keys to only those related to the current conversation
    const conversationId = context.activity.conversation.id;
    const currentDedupKeys = this._dedupStorageKeys.filter(
      (key) => key.indexOf(conversationId) > 0
    );

    // Delete the deduplication keys from the storage
    await this._dedupStorage.delete(currentDedupKeys);

    // Replace the deduplication keys in memory with the remaining keys that are not related to the current conversation
    this._dedupStorageKeys = this._dedupStorageKeys.filter(
      (key) => key.indexOf(conversationId) < 0
    );

    console.debug(
      `[${OAuthDialog.name}][DEBUG] ${
        this.onEndDialog.name
      } Removed deduplication keys:\n${JSON.stringify(
        currentDedupKeys,
        null,
        2
      )}`
    );
    console.debug(`[${OAuthDialog.name}][TRACE] ${this.onEndDialog.name}@end`);
  }

  // If a user is signed into multiple Teams clients, the Bot might receive a "signin/tokenExchange" from each client.
  // Each token exchange request for a specific user login will have an identical activity.value.Id.
  // Only one of these token exchange requests should be processed by the bot.  For a distributed bot in production,
  // this requires a distributed storage to ensure only one token exchange is processed.
  private async _shouldDedup(context: TurnContext): Promise<boolean> {
    // Checks if the current activity is a token exchange or verify state invoke activity
    if (
      !this._isSignInTokenExchangeInvoke(context) &&
      !this._isSignInVerifyStateInvoke(context)
    ) {
      throw new ErrorWithCode(
        `Unable to deduplicate token exchange request as current activity is of type 
        '${context.activity.type}::${context.activity.name}' and should be 
        '${ActivityTypes.Invoke}::${tokenExchangeOperationName} 
        or '${ActivityTypes.Invoke}::${verifyStateOperationName}'`,
        ErrorCode.FailedToRunDedupStep
      );
    }

    // Checks if the current activity value has an id, which is used to deduplicate the token exchange request
    // as an eTag in the storage
    const value = context.activity.id;
    if (!value) {
      throw new ErrorWithCode(
        "Unable to deduplicate token exchange request as current activity is missing its id",
        ErrorCode.FailedToRunDedupStep
      );
    }

    // Creates the eTag for the token exchange request based on the activity value id and creates the item object to store in the deduplication storage
    // The eTag is used to deduplicate the token exchange request, as only one request with the same eTag should be processed
    const storeItem = {
      eTag: `${value}`,
    };

    // Gets the storage key for the token exchange request based on the activity channel id, conversation id and value id
    const key = this._getStorageKey(context);
    const storeItems = { [key]: storeItem };

    try {
      // Attempts to write the item to the deduplication storage and saves the key in memory for later cleanup
      await this._dedupStorage.write(storeItems);
      this._dedupStorageKeys.push(key);
    } catch (error: any) {
      if (error instanceof Error && error.message.indexOf("eTag conflict")) {
        // Duplicate activity value id already in storage
        return true;
      }

      // Unexpected error encountered while writing to storage
      throw error;
    }

    // If the item was successfully written to the storage, it means that this is the first time this token exchange request is being processed
    return false;
  }

  private _isSignInVerifyStateInvoke(context: TurnContext): boolean {
    // Checks if the current activity is an invoke signin/verifyState activity
    const activity = context.activity;
    return (
      activity.type === ActivityTypes.Invoke &&
      activity.name === verifyStateOperationName
    );
  }

  private _isSignInTokenExchangeInvoke(context: TurnContext): boolean {
    // Checks if the current activity is an invoke signin/tokenExchange activity
    const activity = context.activity;
    return (
      activity.type === ActivityTypes.Invoke &&
      activity.name === tokenExchangeOperationName
    );
  }

  private _getStorageKey(context: TurnContext): string {
    if (!context?.activity?.conversation?.id) {
      throw new ErrorWithCode(
        "Unable to deduplicate token exchange request as current turn context is missing its activity conversation id",
        ErrorCode.FailedToRunDedupStep
      );
    }

    const activity = context.activity;
    const channelId = activity.channelId;
    const conversationId = activity.conversation.id;

    if (
      !this._isSignInTokenExchangeInvoke(context) &&
      !this._isSignInVerifyStateInvoke(context)
    ) {
      throw new ErrorWithCode(
        `Unable to get storage key as current activity is of type 
        '${activity.type}::${activity.name}' and should be 
        '${ActivityTypes.Invoke}::${tokenExchangeOperationName} 
        or '${ActivityTypes.Invoke}::${verifyStateOperationName}'`,
        ErrorCode.FailedToRunDedupStep
      );
    }
    // const value = activity.value;
    const value = activity.id;
    if (!value) {
      throw new ErrorWithCode(
        "Unable to get storage key as current activity is missing its id",
        ErrorCode.FailedToRunDedupStep
      );
    }
    return `${channelId}/${conversationId}/${value}`;
  }

  private async _cacheBypass(
    dc: DialogContext,
    options?: any
  ): Promise<DialogTurnResult> {
    // Ensure prompts have input hint set
    const o = Object.assign({}, options);
    if (
      o.prompt &&
      typeof o.prompt === "object" &&
      typeof o.prompt.inputHint !== "string"
    ) {
      o.prompt.inputHint = InputHints.AcceptingInput;
    }
    if (
      o.retryPrompt &&
      typeof o.retryPrompt === "object" &&
      typeof o.retryPrompt.inputHint !== "string"
    ) {
      o.retryPrompt.inputHint = InputHints.AcceptingInput;
    }
    // Initialize prompt state
    const timeout =
      typeof this["settings"].timeout === "number"
        ? this["settings"].timeout
        : 900000;
    const state = dc.activeDialog.state;
    state.state = {};
    state.options = o;
    state.expires = new Date().getTime() + timeout;
    // Attempt to get the users token
    // const output = yield UserTokenAccess.getUserToken(dc.context, this.settings, undefined);
    // if (output) {
    //     // Return token
    //     return yield dc.endDialog(output);
    // }
    // Prompt user to login

    let activityId: string | undefined = undefined;
    const sendActivity = dc.context.sendActivity;
    dc.context.sendActivity = async (
      activityOrText: string | Partial<Activity>,
      speak?: string,
      inputHint?: string
    ): Promise<ResourceResponse | undefined> => {
      const response = await sendActivity.call(
        dc.context,
        activityOrText,
        speak,
        inputHint
      );
      if (response && response.id) {
        activityId = response.id;
      }
      return response;
    };

    await OAuthPrompt.sendOAuthCard(
      this["settings"],
      dc.context,
      state.options.prompt
    );
    dc.context.sendActivity = sendActivity; // Restore original sendActivity
    options.oauthActivityId = activityId;

    return Dialog.EndOfTurn;
  }
}
