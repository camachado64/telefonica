// Imports util to set the default depth for object inspection when logging
import * as util from "util";
util.inspect.defaultOptions.depth = null;

// function formatLogMessage(level: string, message: string): string {
//   const prepareStackTrace = Error.prepareStackTrace;
//   Error.prepareStackTrace = (_, stack) => stack;
//   const err = new Error();
//   const callSite = err.stack[2] as unknown as NodeJS.CallSite;

//   // for (const stackFrame of err.stack) {
//   //   const callSite = stackFrame as unknown as NodeJS.CallSite;
//   //   console.log(
//   //     `[${new Date().toISOString()}][DEBUG] [${callSite.getFileName()}:${callSite.getLineNumber()}] [${
//   //       callSite.getTypeName() || "Global"
//   //     }.${
//   //       callSite.getMethodName() || callSite.getFunctionName() || "<anonymous>"
//   //     }]`
//   //   );
//   // }

//   const callerLine = callSite.getLineNumber();
//   const callerFile = callSite.getFileName();

//   const typeName = callSite.getTypeName() || "<Global>";
//   const methodName =
//     callSite.getMethodName() || callSite.getFunctionName() || "<anonymous>";

//   Error.prepareStackTrace = prepareStackTrace;

//   return `[${new Date().toISOString()}] [${level}] [${callerFile}:${callerLine}] [${typeName}.${methodName}] ${
//     message ? `- ${message}` : ""
//   }`;
// }

// // Overrides the 'console.debug' and  method to add a timestamp to the debug messages
// console.debug = (message: string, ...optionalParams: any[]): void => {
//   // Log the debug message to the console
//   console.log(formatLogMessage("DEBUG", message), ...optionalParams);
// };
// console.info = (message: string, ...optionalParams: any[]): void => {
//   // Log the info message to the console
//   console.log(formatLogMessage("INFO", message), ...optionalParams);
// };
// console.warn = (message: string, ...optionalParams: any[]): void => {
//   // Log the warning message to the console
//   console.log(formatLogMessage("WARN", message), ...optionalParams);
// };
// // console.error is overridden to add a timestamp and the stack trace of the error
// console.error = (error: any, ...optionalParams: any[]): void => {
//   // Check if the error is an instance of Error, if not, convert it to a string
//   const message = error instanceof Error ? error.message : "";
//   console.log(formatLogMessage("ERROR", message));
//   // Log the stack trace of the error
//   if (optionalParams.length > 0 && optionalParams[0] instanceof Error) {
//     console.log(
//       formatLogMessage("ERROR", null),
//       optionalParams[0].stack || "No stack trace available"
//     );
//   }
// };

// Initializes the logging setup for the application
import * as _ from "./utils/logging";

import {
  ConversationState,
  MemoryStorage,
  TurnContext,
  UserState,
} from "botbuilder";
import express, { Response, Request, Router } from "express";
import { Server } from "http";
// import https, { ServerOptions } from "https";

import "isomorphic-fetch";
// import path from "path";
// import send from "send";

import { authMiddleware } from "./api/middleware/auth.middleware";

import { TeamsBot } from "./bots/teamsBot";
import { HandlerManager, OAuthAwareHandlerManager } from "./commands/manager";
import {
  ConversationReferenceStore,
  DefaultHandlerTurnContextHelper,
  HandlerTurnContextHelper,
} from "./commands/context";
import { DefaultDialogManager, DialogManager } from "./dialogs/manager";
import { OAuthDialog } from "./dialogs/oauthDialog";

import { TicketCommandHandler } from "./commands/ticket/ticket";
import { AuthRefreshActionHandler } from "./adaptiveCards/actions/authRefresh/authRefresh";
import { TicketAdaptiveCardPositiveActionHandler } from "./adaptiveCards/actions/ticket/positive";
import { TicketAdaptiveCardNegativeActionHandler } from "./adaptiveCards/actions/ticket/negative";
import { TicketAdaptiveCardSelectChoiceActionHandler } from "./adaptiveCards/actions/ticket/selectChoice";

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
import { router as authRouter } from "./api/token";
import { logError } from "./utils/logging";

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

// Creates the dialog manager
const dialogManager: DialogManager = new DefaultDialogManager();

// Create the context manager
const contextHelper: HandlerTurnContextHelper =
  new DefaultHandlerTurnContextHelper(config, conversationStore);

// Create the handler manager
const handlerManager: HandlerManager = new OAuthAwareHandlerManager(
  graphClient,
  contextHelper,
  dialogManager,
  {
    commands: [new TicketCommandHandler(apiClient)],
    actions: [
      new AuthRefreshActionHandler(),
      new TicketAdaptiveCardPositiveActionHandler(
        config,
        apiClient,
        graphClient,
        logsRepository
      ),
      new TicketAdaptiveCardNegativeActionHandler(graphClient),
      new TicketAdaptiveCardSelectChoiceActionHandler(apiClient),
    ],
  }
);

// Create the auth flow dialog
const dialog: OAuthDialog = new OAuthDialog(
  config,
  conversationState,
  new MemoryStorage(),
  handlerManager
);
// Register the dialog with the dialog manager
dialogManager.registerDialog(dialog);

// Create the activity handler.
const bot: TeamsBot = new TeamsBot(
  config,
  conversationState,
  userState,
  handlerManager,
  dialogManager,
  techRepository
);

// Create express application.
const app: express.Express = express();
app.use(express.json());
app.use(authMiddleware);

// Add an API router to the express app and mount the API routes
const apiRouter: Router = Router();
app.use("/api", apiRouter);
apiRouter.use("/token", authRouter);
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

// Create the server and listen on the specified port or default to 3978 if not specified\
const server: Server =
  // https.createServer(options, app)
  app.listen(process.env.port || process.env.PORT || 3978, (): void => {
    console.info(`Bot started, '${app.name}' listening to`, server.address());
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
          `[${req.method} ${req.url}][DEBUG] req.headers:${
            req.headers ? "\n" : " "
          }`,
          req.headers
        );
        return await bot.run(context);
      })
      .catch((err: any) => {
        // Catches any errors that occur during the request and logs them
        logError(err, "Express", `${req.method} ${req.url}`);

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
    `[${req.method} ${req.url}][DEBUG] req.headers:\n${
      req.headers ? "\n" : "undefined"
    }`,
    req.headers
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
