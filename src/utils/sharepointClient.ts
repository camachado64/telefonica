import { BotConfiguration } from "../config/config";
import { TokenResponse } from "./graphClient";
import { HttpContentTypes, HttpHeaders, HttpMethods } from "./http";

export interface SharepointClientOptions {
  username: string;
  password: string;
}

export interface SharepointClient {
  health(): Promise<TokenResponse>;
}

export class DefaultSharepointClient implements SharepointClient {
  public static readonly DEFAULT_SCOPE =
    "https://microsoft.sharepoint.com/.default";

  constructor(
    private readonly _config: BotConfiguration,
    private readonly _options: SharepointClientOptions
  ) {}

  public async health(): Promise<TokenResponse> {
    console.debug(
      `[${DefaultSharepointClient.name}][DEBUG] ${this.health.name}`
    );

    // Attempt to connect to the Sharepoint API
    return await this._getToken(this._config, this._options);
  }

  private async _getToken(
    config: BotConfiguration,
    options: SharepointClientOptions
  ): Promise<TokenResponse> {
    return await fetch(`${config.authority}/oauth2/v2.0/token`, {
      method: HttpMethods.Post,
      headers: {
        [HttpHeaders.ContentType]: HttpContentTypes.FormUrlEncoded
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
      .then<TokenResponse>((response: Response): Promise<TokenResponse> => {
        return response.json();
      })
      .then((response: TokenResponse): TokenResponse => {
        return {
          ...response,
          started_at: new Date(),
        };
      })
      .catch((error: any): never => {
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
