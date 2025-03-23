import { MemoryStorage, TurnContext } from "botbuilder";
import { BotBuilderCloudAdapter } from "@microsoft/teamsfx";
import ConversationBot = BotBuilderCloudAdapter.ConversationBot;

import { config } from "./config";

// Create the command bot and register the command handlers for your app.
// You can also use the commandBot.command.registerCommands to register other commands
// if you don't want to register all of them in the constructor
export const commandBot = new ConversationBot({
  // The bot id and password to create CloudAdapter.
  // See https://aka.ms/about-bot-adapter to learn more about adapters.
  adapterConfig: {
    MicrosoftAppId: config.botId,
    MicrosoftAppPassword: config.botPassword,
    MicrosoftAppType: config.botType,
    MicrosoftAppTenantId: config.tenantId,
  },
  // See https://docs.microsoft.com/microsoftteams/platform/toolkit/teamsfx-sdk to learn more about ssoConfig
  ssoConfig: {
    aad: {
      scopes: [
        "User.Read",
        "ChatMessage.Read",
        "ChannelMessage.Read.All",
        "Team.ReadBasic.All",
        "Channel.ReadBasic.All",
        "ProfilePhoto.Read.All",
        "Files.Read.All",
      ],
      initiateLoginEndpoint: `https://${config.botDomain}/auth-start.html`,
      authorityHost: config.authorityHost,
      clientId: config.clientId,
      tenantId: config.tenantId,
      clientSecret: config.clientSecret,
    },
    dialog: {
      // userState: userState,
      // conversationState: conversationState,
      dedupStorage: new MemoryStorage(),
      ssoPromptConfig: {
        timeout: 900000,
        endOnInvalidMessage: true,
      },
    },
  },
  command: {
    enabled: false,
    commands: [],
    ssoCommands: [],
  },
});

// // Creates the SSO token exchange middleware.
// // This middleware is used to exchange the SSO token for a user.
// const tokenExchangeMiddleware = new TeamsSSOTokenExchangeMiddleware(
//   memoryStorage,
//   config.connectionName
// );
// commandBot.adapter.use(tokenExchangeMiddleware);

const adapterTurnErrorHandler = commandBot.adapter.onTurnError;
const onTurnErrorHandler = async (
  context: TurnContext,
  error: any
): Promise<void> => {
  console.error(
    `[commandBot][DEBUG] ${onTurnErrorHandler.name} [[ERROR]]: ${error}`
  );
  await adapterTurnErrorHandler(context, error);
};
commandBot.adapter.onTurnError = onTurnErrorHandler;
