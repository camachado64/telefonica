import {
  ConversationState,
  MemoryStorage,
  TurnContext,
  UserState,
} from "botbuilder";
import express, { Response, Request, Router } from "express";
// import https, { ServerOptions } from "https";

import "isomorphic-fetch";
// import path from "path";
// import send from "send";

import { TeamsBot } from "./bots/teamsBot";
import {
  ConversationReferenceStore,
  DefaultHandlerManager,
  HandlerContextManager,
  HandlerManager,
} from "./commands/handlerManager";
import { TicketCommandHandler } from "./commands/ticket/ticket";
import { AuthCommandDispatchDialog } from "./dialogs/authCommandDispatchDialog";
import { AuthRefreshActionHandler } from "./adaptiveCards/actions/authRefresh/authRefresh";
import { TicketAdaptiveCardCreateActionHandler } from "./adaptiveCards/actions/ticket/create";
import { TicketAdaptiveCardCancelActionHandler } from "./adaptiveCards/actions/ticket/cancel";

import { commandBot } from "./config/initialize";
import { config } from "./config/config";
import { apiClient } from "./config/ticket";
import { logsRepository, techRepository } from "./config/db";
import { graphClient } from "./config/graph";

import { router as techiniciansRouter } from "./api/technicians";
import { router as apiLogs } from "./api/logs";
import { router as ticketRouter } from "./api/ticket";
import { router as graphRouter } from "./api/graph";
import { router as sharepointRouter } from "./api/sharepoint";
import { router as dbRouter } from "./api/db";

// Define the state store for your bot.
// See https://aka.ms/about-bot-state to learn more about using MemoryStorage.
// A bot requires a state storage system to persist the dialog and user state between messages
const memoryStorage: MemoryStorage = new MemoryStorage();

// Create conversation and user state with the storage provider defined above
export const conversationState: ConversationState = new ConversationState(
  memoryStorage
);
export const userState: UserState = new UserState(memoryStorage);

// Define a simple conversation reference store
const conversationStore: ConversationReferenceStore = {};

// Create the context manager
const contextManager: HandlerContextManager = new HandlerContextManager(
  config,
  conversationStore
);

// Create the handler manager
const handlerManager: HandlerManager = new DefaultHandlerManager(
  contextManager,
  {
    commands: [new TicketCommandHandler(apiClient, graphClient)],
    actions: [
      new AuthRefreshActionHandler(),
      new TicketAdaptiveCardCreateActionHandler(
        config,
        apiClient,
        graphClient,
        logsRepository
      ),
      new TicketAdaptiveCardCancelActionHandler(graphClient),
    ],
  }
);

// Create the auth flow dialog
const dialog: AuthCommandDispatchDialog = new AuthCommandDispatchDialog(
  config,
  conversationState,
  new MemoryStorage(),
  handlerManager
);

// Register the dialog with the context manager
contextManager.registerDialog(dialog);

// Create the activity handler.
const bot: TeamsBot = new TeamsBot(
  config,
  conversationState,
  userState,
  handlerManager,
  dialog,
  techRepository
);

// Create express application.
const app = express();
app.use(express.json());

// Add an API router to the express app and mount the API routes
const apiRouter: Router = Router();
app.use("/api", apiRouter);
apiRouter.use("/db", dbRouter);
apiRouter.use("/ticket", ticketRouter);
apiRouter.use("/graph", graphRouter);
apiRouter.use("/sharepoint", sharepointRouter);
apiRouter.use("/technicians", techiniciansRouter);
apiRouter.use("/logs", apiLogs);

// Https server configuration
// const options: ServerOptions = {
//   key: config.ssl.key,
//   cert: config.ssl.cert,
// };

// Create the server and listen on the specified port or default to 3978 if not specified
const server = 
  // https.createServer(options, app)
  app.listen(process.env.port || process.env.PORT || 3978, () => {
    console.log(
      `[expressApp][INFO] Bot started, ${app.name} listening to`,
      server.address()
    );
  });

// Register an API endpoint with `express`. Teams sends messages to your application
// through this endpoint.
//
// The Teams Toolkit bot registration configures the bot with `/api/messages` as the
// Bot Framework endpoint. If you customize this route, update the Bot registration
// in `infra/botRegistration/azurebot.bicep`.
// Process Teams activity with Bot Framework.
apiRouter.post(
  "/messages",
  async (req: Request, res: Response): Promise<void> => {
    await commandBot
      .requestHandler(req, res, async (context: TurnContext): Promise<any> => {
        console.debug(
          `[${req.method} ${req.url}][DEBUG] req.headers:\n${JSON.stringify(
            req.headers,
            null,
            2
          )}`
        );
        return await bot.run(context);
      })
      .catch((err: any) => {
        // Catches any errors that occur during the request

        console.error(
          `[${req.method} ${req.url}][ERROR] error:\n${JSON.stringify(
            err,
            null,
            2
          )}`
        );

        if (!err.message.includes("412")) {
          // Error message including "412" means it is waiting for user's consent, which is a normal process of SSO, shouldn't throw this error
          throw err;
        }
      });
  }
);

// Health check endpoint for the express app to verify that the app is running
apiRouter.get("/health", async (req: Request, res: Response): Promise<void> => {
  console.debug(
    `[${req.method} ${req.url}][DEBUG] req.headers:\n${JSON.stringify(
      req.headers,
      null,
      2
    )}`
  );

  // Return a 200 status code to indicate that the bot is running
  res
    .status(200)
    .send(
      JSON.stringify(
        { status: 200, data: { message: "Bot is running" } },
        null,
        2
      )
    );
});

// Allow the auth-start.html and auth-end.html to be served from the public folder.
// expressApp.get(["/auth-start.html", "/auth-end.html"], async (req, res) => {
//   console.debug(`[expressApp][DEBUG] [${req.method}] req.url: ${req.url}`);
//   console.debug(
//     `[expressApp][DEBUG] [${req.method}] req.originalUrl:\n${JSON.stringify(req.originalUrl, null, 2)}`
//   );
//
//   send(
//     req,
//     path.join(
//       __dirname,
//       "public",
//       req.url.includes("auth-start.html") ? "auth-start.html" : "auth-end.html"
//     )
//   ).pipe(res);
// });
