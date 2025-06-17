import { TokenResponse } from "botbuilder";
import { TriggerPatterns } from "@microsoft/teamsfx";

import { HandlerMessage, HandlerMessageContext } from "./manager";
import { HandlerTurnContext } from "./context";

// export type AuthHandlerData = AdaptiveCardActionAuthRefreshDataOutput & {
//   token: string;
// };

/**
 * A handler is a class that can be triggered by a message. Handlers can be of different types, such as
 * command handlers or action handlers. The handler should implement the `run` method to handle an incoming
 * message.
 */
export interface Handler {
  /**
   * The pattern that the handler should be triggered by. This can be a string or a regular expression.
   * If a string is provided, the handler will be triggere d by an exact match of the string.
   * If a regular expression is provided, the handler will be triggered by a match of the regular expression.
   * If the pattern is not provided, the handler will not be triggered by any message.
   *
   * @example
   * // This handler will be triggered by the string "example"
   * export class ExampleCommandHandler implements Handler {
   *    pattern = "example"
   *    ...
   *
   * @example
   * // This handler will not be triggered by any message
   * export class ExampleCommandHandler implements Handler {
   *    pattern = undefined
   *    ...
   *
   * @example
   * // This handler will be triggered by the string "hello" or "hi"
   * export class ExampleCommandHandler implements Handler {
   *    pattern = /^(hello|hi)$/
   *    ...
   */
  pattern: TriggerPatterns;

  /**
   * The run method should be implemented to handle the incoming message which matches or is
   * triggered by the `pattern`.
   *
   * @param handlerContext The context of the incoming message.
   * @param commandMessage The message that triggered the handler.
   * @param commandMessageContext The context of the message that triggered the handler.
   * @returns A promise that resolves when the handler has finished processing the message.
   */
  run(
    handlerContext: HandlerTurnContext,
    commandMessage: HandlerMessage,
    commandMessageContext: HandlerMessageContext
  ): Promise<any>;
}

export abstract class ActionHandler implements Handler {
  public abstract pattern: TriggerPatterns;

  /**
   * @inheritdoc
   */
  public abstract run(
    handlerContext: HandlerTurnContext,
    commandMessage: HandlerMessage,
    commandMessageContext: HandlerMessageContext
  ): Promise<any>;
}

export abstract class CommandHandler implements Handler {
  pattern: TriggerPatterns;

  public abstract run(
    handlerContext: HandlerTurnContext,
    commandMessage: HandlerMessage,
    commandMessageContext: HandlerMessageContext
  ): Promise<any>;
}

export abstract class OAuthCommandHandler extends CommandHandler {
  public abstract pattern: TriggerPatterns;

  /**
   * The run method should be implemented to handle the incoming message which matches or is
   * triggered by the `pattern`. This method is called by the `run` method or alternatively by the `AuthCommandDispatchDialog` when `needsAuth` is set to `true`
   * and should be implemented by the handler.
   *
   * @param context The context of the incoming message.
   * @param commandMessage The message that triggered the handler.
   * @param commandMessageContext The context of the message that triggered the handler.
   * @param token Optional delegated access token for the user who triggered the command.
   * @returns A promise that resolves when the handler has finished processing the message.
   */
  public abstract run(
    context: HandlerTurnContext,
    commandMessage: HandlerMessage,
    commandMessageContext: HandlerMessageContext,
    token?: Partial<TokenResponse>
  ): Promise<any>;
}
