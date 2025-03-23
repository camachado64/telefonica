import {
  ComponentDialog,
  Dialog,
  DialogContext,
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
} from "botbuilder";
import {
  ErrorCode,
  ErrorWithCode,
  OnBehalfOfCredentialAuthConfig,
  TeamsBotSsoPrompt,
  TeamsBotSsoPromptSettings,
  TeamsBotSsoPromptTokenResponse,
} from "@microsoft/teamsfx";

import { RunnableDialog, WaterfallStepContextOptions } from "./dialog";
import { BotConfiguration } from "../config/config";
import { ContextHint, HandlerManager } from "../commands/handlerManager";

const MAIN_DIALOG = "MainDialog";
const INITIAL_DIALOG_ID = "MainWaterfallDialog";
// const TEAMS_BOT_SSO_PROMPT_ID = "TeamsBotSsoPrompt";
const OAUTH_PROMPT_ID = "OAuthPrompt";

const DIALOG_DATA = "dialogState";

export class AuthCommandDispatchDialog
  extends ComponentDialog
  implements RunnableDialog
{
  public readonly name: string = "authRefresh";

  private readonly _dialogStateAccessor: StatePropertyAccessor<DialogState>;
  private readonly _dedupStorageKeys: string[] = [];

  constructor(
    config: BotConfiguration,
    conversationState: ConversationState,
    private readonly _dedupStorage: Storage,
    private readonly _handlerManager: HandlerManager
  ) {
    super(MAIN_DIALOG);

    this._dialogStateAccessor = conversationState.createProperty(DIALOG_DATA);

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
      OAUTH_PROMPT_ID,
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
      new WaterfallDialog<WaterfallStepContextOptions>(INITIAL_DIALOG_ID, [
        this._promptStep.bind(this),
        this._dedupStep.bind(this),
        this._dispatchStep.bind(this),
      ])
    );

    this.initialDialogId = INITIAL_DIALOG_ID;
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
    data?: WaterfallStepContextOptions
  ): Promise<DialogTurnResult> {
    const dialogSet = new DialogSet(this._dialogStateAccessor);
    dialogSet.add(this);

    const dialogContext = await dialogSet.createContext(context);
    const dialogResult = await dialogContext.continueDialog();

    if (dialogResult?.status === DialogTurnStatus.empty) {
      return await dialogContext.beginDialog(this.id, data);
    }
    return dialogResult;
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

    await this._dialogStateAccessor.delete(context);
    return await dialogContext.cancelAllDialogs();
  }

  private async _promptStep(
    stepContext: WaterfallStepContext<WaterfallStepContextOptions>
  ): Promise<DialogTurnResult> {
    // Prompts the user to accept the authentication flow

    console.debug(
      `[${AuthCommandDispatchDialog.name}][DEBUG] [${WaterfallDialog.name}] ${this._promptStep.name}`
    );

    try {
      console.debug(
        `[${AuthCommandDispatchDialog.name}][DEBUG] [${WaterfallDialog.name}] ${
          this._promptStep.name
        } options:\n${JSON.stringify(stepContext.options, null, 2)}`
      );

      // Starts the OAuth prompt dialog
      await stepContext
        .beginDialog(OAUTH_PROMPT_ID)
        // .beginDialog(TEAMS_BOT_SSO_PROMPT_ID)
        .catch((error: any): Promise<DialogTurnResult> => {
          // Catches any errors that occur during the OAuth prompt dialog in the prompt step

          console.error(
            `[${AuthCommandDispatchDialog.name}][ERROR] [${
              WaterfallDialog.name
            }] ${this._promptStep.name} error:\n${JSON.stringify(
              error,
              null,
              2
            )}`
          );

          // Unexpected errors are logged and the bot continues to run to the next step
          return stepContext.next();
        });

      // End the turn and wait for the user to accept the authentication flow
      return Dialog.EndOfTurn;
      // return await stepContext.next();
    } catch (error: any) {
      // Catches any errors that occur during the prompt step

      console.error(
        `[${AuthCommandDispatchDialog.name}][ERROR] [${WaterfallDialog.name}] ${
          this._promptStep.name
        } error:\n${JSON.stringify(error, null, 2)}`
      );

      // Unexpected errors are logged and the bot continues to run
      return await stepContext.next();
    }
  }

  private async _dedupStep(
    stepContext: WaterfallStepContext<WaterfallStepContextOptions>
  ): Promise<DialogTurnResult> {
    // Deduplicates the token exchange request to prevent processing the same token exchange multiple times

    console.debug(
      `[${AuthCommandDispatchDialog.name}][DEBUG] [${WaterfallDialog.name}] ${this._dedupStep.name}`
    );

    // Get the token response from the previous step
    const tokenResult: Partial<TokenResponse> = stepContext.result;
    // const tokenResult: Partial<TeamsBotSsoPromptTokenResponse> =
    //   stepContext.result;

    // Only dedup after promptStep to make sure that all Teams' clients receive the login request
    if (tokenResult && (await this._shouldDedup(stepContext.context))) {
      // If the token exchange is a duplicate, end the turn without dispatching the command handler.
      // This is to prevent the bot from processing the same token exchange multiple times
      return Dialog.EndOfTurn;
    }

    // Continue to the next step with the token response as the result
    return await stepContext.next(tokenResult);
  }

  private async _dispatchStep(
    stepContext: WaterfallStepContext<WaterfallStepContextOptions>
  ): Promise<DialogTurnResult> {
    // Dispatches the command handler with the token response if the token exchange was successful

    // Get the token response from the previous step
    const tokenResult: Partial<TokenResponse> = stepContext.result;
    // const tokenResult: Partial<TeamsBotSsoPromptTokenResponse> =
    //   stepContext.result;

    console.debug(
      `[${AuthCommandDispatchDialog.name}][DEBUG] [${WaterfallDialog.name}] ${this._dispatchStep.name}`
    );
    console.debug(
      `[${AuthCommandDispatchDialog.name}][DEBUG] [${WaterfallDialog.name}] ${
        this._dispatchStep.name
      } options:\n${JSON.stringify(stepContext.options, null, 2)}`
    );
    console.debug(
      `[${AuthCommandDispatchDialog.name}][DEBUG] [${WaterfallDialog.name}] ${
        this._dispatchStep.name
      } tokenResult:\n${JSON.stringify(tokenResult, null, 2)}`
    );

    // Check if the token exchange was successful
    if (!tokenResult) {
      // If the token exchange was unsuccessful, end the dialog
      await stepContext.context.sendActivity(
        `No se puede iniciar sesión o el usuario rechazó el flujo de autenticación.`
      );

      // Unable to retrieve token or an unexpected error occurred
      return await stepContext.endDialog();
    }

    // Check if the command is present in the dialog options
    const command: string = stepContext.options?.data?.command;

    // Resolves command handler from text, resolution can only be a `HandlerType.Command` type handler as this dialog should only be reacheable from the `authRefresh` action
    // and the `authRefresh` action is only triggered by a message that matched a command handler. Since the initial context has changed, due to the authentication flow
    // steps triggering 'signin/*' invoke actions the handler needs to be resolved again here as the context switch(and subsequently any bot turn switch), jsonifies any dialog options
    // passed to the dialog context and as such any handler passed in the options would be lost.
    await this._handlerManager
      .resolveAndDispatch(stepContext.context, command, {
        hint: ContextHint.Dialog,
        token: tokenResult.token,
        ...stepContext.options?.data,
      })
      .catch((error: any) => {
        // Catches any errors that occur during the command handling process

        console.error(
          `[${AuthCommandDispatchDialog.name}][ERROR] ${
            this._dispatchStep.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        // Unexpected errors are logged and the bot continues to run
        return;
      });

    return await stepContext.endDialog(tokenResult);
  }

  private _isSignInVerifyStateInvoke(context: TurnContext): boolean {
    const activity = context.activity;
    return (
      activity.type === ActivityTypes.Invoke &&
      activity.name === verifyStateOperationName
    );
  }

  private _isSignInTokenExchangeInvoke(context: TurnContext): boolean {
    const activity = context.activity;
    return (
      activity.type === ActivityTypes.Invoke &&
      activity.name === tokenExchangeOperationName
    );
  }

  // If a user is signed into multiple Teams clients, the Bot might receive a "signin/tokenExchange" from each client.
  // Each token exchange request for a specific user login will have an identical activity.value.Id.
  // Only one of these token exchange requests should be processed by the bot.  For a distributed bot in production,
  // this requires a distributed storage to ensure only one token exchange is processed.
  private async _shouldDedup(context: TurnContext): Promise<boolean> {
    if (
      (!this._isSignInTokenExchangeInvoke(context) &&
        !this._isSignInVerifyStateInvoke(context)) ||
      !context.activity.value?.id
    ) {
      return false;
    }

    const storeItem = {
      eTag: context.activity.value.id,
    };

    const key = this._getStorageKey(context);
    const storeItems = { [key]: storeItem };

    try {
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
    return false;
  }

  private _getStorageKey(context: TurnContext): string {
    if (!context || !context.activity || !context.activity.conversation) {
      throw new Error("Unable to get storage key from current turn context");
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
    const value = activity.value;
    if (!value || !value.id) {
      throw new ErrorWithCode(
        "Unable to get storage key as current activity value is missing its id",
        ErrorCode.FailedToRunDedupStep
      );
    }
    return `${channelId}/${conversationId}/${value.id}`;
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
    await OAuthPrompt.sendOAuthCard(
      this["settings"],
      dc.context,
      state.options.prompt
    );
    return Dialog.EndOfTurn;
  }
}
