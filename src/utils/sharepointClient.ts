import { BotConfiguration } from "../config/config";
import { MicrosoftTokenResponse } from "./types";

export interface SharepointClientOptions {
  username: string;
  password: string;
}

export interface SharepointClient {
  health(): Promise<MicrosoftTokenResponse | Error>;
}

export class DefaultSharepointClient implements SharepointClient {
  public static readonly DEFAULT_SCOPE =
    "https://microsoft.sharepoint.com/.default";

  constructor(
    private readonly _config: BotConfiguration,
    private readonly _options: SharepointClientOptions
  ) {}

  public async health(): Promise<MicrosoftTokenResponse | Error> {
    console.debug(
      `[${DefaultSharepointClient.name}][DEBUG] ${this.health.name}`
    );

    // Attempt to connect to the Sharepoint API
    return await this._getToken(this._config, this._options);
  }

  private async _getToken(
    config: BotConfiguration,
    options: SharepointClientOptions
  ): Promise<MicrosoftTokenResponse | Error> {
    return await fetch(`${config.authority}/oauth2/v2.0/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: config?.clientId,
        client_secret: config?.clientSecret,
        scope: DefaultSharepointClient.DEFAULT_SCOPE,
        username: options?.username,
        password: options?.password,
      }),
    })
      .then<MicrosoftTokenResponse>(
        (response: Response): Promise<MicrosoftTokenResponse> => {
          return response.json();
        }
      )
      .then((response: MicrosoftTokenResponse): MicrosoftTokenResponse => {
        return {
          ...response,
          started_at: new Date(),
        };
      })
      .catch((error: Error): Error => {
        // Catches any errors that occur during the request

        console.error(
          `[${DefaultSharepointClient.name}][ERROR] ${
            this._getToken.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        // Return the error if there is an error during the request if the error is an instance of 'Error'
        // otherwise create a new 'Error' instance with the error as its reason
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(error);
      });
  }
}
