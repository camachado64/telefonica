import { config } from "../config/config";

export interface TokenExchangeResponse {
  token_type: string;
  expires_in: number;
  ext_expires_in: number;
  access_token: string;
}

export class AppInstallUtils {
  public static getAccessToken(
    tenantId: string
  ): Promise<TokenExchangeResponse> {
    return new Promise(
      async (
        resolve: (value: TokenExchangeResponse) => void,
        reject: (reason: Error) => void
      ) => {
        fetch(
          `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams(
              Object.entries({
                grant_type: "client_credentials",
                scope: "https://graph.microsoft.com/.default",
                client_id: config.clientId,
                client_secret: config.clientSecret,
              })
            ).toString(),
          }
        )
          .then((response: Response): Promise<TokenExchangeResponse> => {
            return response?.json();
          })
          .then((response: TokenExchangeResponse): void => {
            console.debug(
              `[${
                AppInstallUtils.name
              }] getAccessToken response:\n${JSON.stringify(
                response,
                null,
                2
              )}\n`
            );
            resolve(response);
          })
          .catch((error: Error): void => {
            console.debug(
              `${AppInstallUtils.name} getAccessToken error:\n${JSON.stringify(
                error,
                null,
                2
              )}\n`
            );
            reject(error);
          });
      }
    );
  }
}
