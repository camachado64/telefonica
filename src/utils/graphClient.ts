import {
  AuthProviderCallback,
  Client,
} from "@microsoft/microsoft-graph-client";

import { BotConfiguration } from "../config/config";
import { HttpContentTypes, HttpHeaders, HttpMethods } from "./http";

export interface TokenResponse {
  token_type: "Bearer" | string;
  scope: string;
  started_at: Date;
  expires_in: number;
  ext_expires_in: number;
  access_token: string;
}

export interface TokenErrorResponse {
  error: string;
  error_description: string;
  error_codes: number[];
  timestamp: string;
  trace_id: string;
  correlation_id: string;
  suberror: string;
}

export enum ApplicationIdentityType {
  BOT = "bot",
}

export interface MicrosoftGraphEntity {
  "@odata.context": string;
  id: string;
}

export interface MicrosoftGraphCollection<T> extends MicrosoftGraphEntity {
  "@odata.count": number;
  "@odata.nextLink": string;
  value: T[];
}

export interface Me extends MicrosoftGraphEntity {
  businessPhones: string[];
  displayName: string;
  givenName: string;
  jobTitle: string;
  mail: string;
  mobilePhone: string;
  officeLocation: string;
  preferredLanguage: "pt-PT" | "es-ES" | "en-US" | string;
  surname: string;
  userPrincipalName: string;
}

export interface Teams extends MicrosoftGraphCollection<Team> {}

export interface Team extends MicrosoftGraphEntity {
  displayName: string;
  description: string;
  createdDateTime: Date | null;
  internalId: string | null;
  classification: any | null; // Better typing
  specialization: string | null;
  visibility: "private" | string;
  webUrl: string | null;
  isArchived: boolean | null;
  isMembershipLimitedToOwners: boolean | null;
  tagSettings: any | null; // Better typing
  memberSettings: {
    allowCreateUpdateChannels: boolean;
    allowCreatePrivateChannels: boolean;
    allowDeleteChannels: boolean;
    allowAddRemoveApps: boolean;
    allowCreateUpdateRemoveTabs: boolean;
    allowCreateUpdateRemoveConnectors: boolean;
  } | null;
  guestSettings: {
    allowCreateUpdateChannels: boolean;
    allowDeleteChannels: boolean;
  } | null;
  messagingSettings: {
    allowUserEditMessages: boolean;
    allowUserDeleteMessages: boolean;
    allowOwnerDeleteMessages: boolean;
    allowTeamMentions: boolean;
    allowChannelMentions: boolean;
  } | null;
  funSettings: {
    allowGiphy: boolean;
    giphyContentRating: string;
    allowStickersAndMemes: boolean;
    allowCustomMemes: boolean;
  } | null;
  discoverySettings: {
    showInTeamsSearchAndSuggestions: boolean;
  } | null;
  summary: {
    ownersCount: number;
    membersCount: number;
    guestsCount: number;
  } | null;
}

export interface TeamChannels extends MicrosoftGraphCollection<TeamChannel> {}

export interface TeamChannel extends MicrosoftGraphEntity {
  displayName: string;
  description: string;
  tenantId: string;
  isArchived: boolean;
}

export interface TeamChannelMessages
  extends MicrosoftGraphCollection<TeamChannelMessage> {}

export interface TeamChannelMessage extends MicrosoftGraphEntity {
  subject: string;
  attachments: TeamsChannelMessageAttachment[];
  messageType: "message" | string;
  createdDateTime: Date;
  lastEditedDateTime: Date | null;
  deletedDateTime: Date | null;
  from: TeamsChannelMessageFrom;
  webUrl: string;
  body: TeamsChannelMessageBody;
  mentions: TeamsMessageMention[];
}

export interface TeamsMessageMention {
  id: number;
  mentionText: string;
  mentioned: {
    device: any | null; // Better typing
    user: {
      "@odata.type": string;
      id: string;
      displayName: string;
      userIdentityType: string;
      tenantId: string;
    } | null;
    conversation: any | null; // Better typing
    tag: any | null; // Better typing
    application: {
      "@odata.type": string;
      id: string;
      displayName: string;
      applicationIdentityType: string;
    } | null;
  };
}

export interface TeamsChannelMessageFrom {
  user: {
    id: string;
    tenantId: string;
    displayName: string;
    userIdentityType: string;
  };
}

export interface TeamsChannelMessageIdentity {
  teamId: string;
  channelId: string;
}

export interface TeamsChannelMessageBody {
  content: string;
  contentType: string;
}

export interface TeamsChannelMessageAttachment {
  id: string;
  content: any;
  contentType: string;
  contentUrl: string;
  name: string;
  teamsAppId: string;
  thumbnailUrl: string;
}

export const DELETED_MESSAGE: TeamChannelMessage = {
  "@odata.context": "",
  id: "-1",
  subject: "La mensaje ha sido eliminada",
  attachments: [],
  body: {
    content: "La mensaje ha sido eliminada",
    contentType: "text/plain",
  },
  from: {
    user: {
      displayName: "La mensaje ha sido eliminada",
      id: "-1",
      tenantId: "-1",
      userIdentityType: undefined,
    },
  },
  createdDateTime: new Date(),
  deletedDateTime: new Date(),
  lastEditedDateTime: new Date(),
  mentions: [],
  messageType: "message",
  webUrl: "",
};

export interface MicrosoftGraphClient {
  health(): Promise<TokenResponse | Error>;

  me(): Promise<Me | null>;

  teams(): Promise<Teams | null>;

  team(teamAadGroupId: string): Promise<Team | null>;

  teamChannels(teamAadGroupId: string): Promise<TeamChannels | null>;

  teamChannel(
    teamAadGroupId: string,
    channelId: string
  ): Promise<TeamChannel | null>;

  teamChannelMessage(
    teamAadGroupId: string,
    channelId: string,
    threadId: string
  ): Promise<TeamChannelMessage | null>;

  teamChannelMessageReplies(
    teamAadGroupId: string,
    channelId: string,
    threadId: string
  ): Promise<TeamChannelMessage[]>;

  deleteTeamChannelMessage(
    teamAadGroupId: string,
    channelId: string,
    threadId: string
  ): Promise<void>;

  deleteTeamChannelMessageReply(
    teamAadGroupId: string,
    channelId: string,
    threadId: string,
    replyId: string
  ): Promise<void>;
}

export interface MicrosoftGraphClientOptions {
  username?: string;
  password?: string;
}

/**
 * This class is a wrapper for the Microsoft Graph API.
 * See: https://developer.microsoft.com/en-us/graph for more information.
 */
export class DefaultMicrosoftGraphClient implements MicrosoftGraphClient {
  public static readonly DEFAULT_SCOPE = "https://graph.microsoft.com/.default";

  private readonly _client: Client;

  constructor(
    private readonly _config: BotConfiguration,
    private readonly _options: MicrosoftGraphClientOptions
  ) {
    this._client = Client.init({
      debugLogging: false,
      authProvider: async (done: AuthProviderCallback): Promise<void> => {
        await this._authProvider(done, this._config, this._options);
      },
    });
  }

  public async health(): Promise<TokenResponse | Error> {
    console.debug(
      `[${DefaultMicrosoftGraphClient.name}][DEBUG] ${this.health.name}`
    );

    // Attempt to connect to the Graph API
    return await this._getToken(this._config, this._options);
  }

  private async _authProvider(
    done: AuthProviderCallback,
    config: BotConfiguration,
    options: MicrosoftGraphClientOptions
  ): Promise<void> {
    const token = await this._getToken(config, options);
    if (token instanceof Error) {
      done(token, null);
    } else {
      done(null, token.access_token);
    }
  }

  private async _getToken(
    config: BotConfiguration,
    options: MicrosoftGraphClientOptions
  ): Promise<TokenResponse | Error> {
    const response = await fetch(`${config.authority}/oauth2/v2.0/token`, {
      method: HttpMethods.Post,
      headers: {
        [HttpHeaders.ContentType]: HttpContentTypes.FormUrlEncoded,
      },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: config?.clientId,
        client_secret: config?.clientSecret,
        scope: DefaultMicrosoftGraphClient.DEFAULT_SCOPE,
        username: options?.username,
        password: options?.password,
      }),
    })
      .then<TokenResponse>(
        async (response: Response): Promise<TokenResponse> => {
          if (!response.ok) {
            // If the response is not ok, throw the response as an error
            throw await response.json();
          }
          return response.json();
        }
      )
      .then((response: TokenResponse): TokenResponse => {
        if ("error" in response) {
          // Sanity check to ensure the response is not an error, should never happen
          // If the response contains an "error" field, log it and throw an error
          console.error(
            `[${DefaultMicrosoftGraphClient.name}][ERROR] ${
              this._getToken.name
            } error:\n${JSON.stringify(response, null, 2)}`
          );

          // Throw the response as an error
          throw response;
        }

        return {
          ...response,
          started_at: new Date(),
        };
      })
      .catch((error: TokenErrorResponse): Error => {
        // Catches any errors that occur during the request

        console.error(
          `[${DefaultMicrosoftGraphClient.name}][ERROR] ${this._getToken.name} error: ${error.error_description}`
        );

        // Return the error if there is an error during the request if the error is an instance of 'Error'
        // otherwise create a new 'Error' instance with the error as its reason
        if (error instanceof Error) {
          return error;
        }
        return new Error(error.error_description);
      });

    // console.debug(
    //   `[${DefaultMicrosoftGraphClient.name}][DEBUG] [${
    //     this._getToken.name
    //   }] response:\n${JSON.stringify(response, null, 2)}`
    // );

    return response;
  }

  public async me(): Promise<Me | null> {
    // Get the user's profile from the '/me' endpoint of Microsoft Graph API
    const me = await this._client
      .api("/me")
      .get()
      .catch((error: Error) => {
        // Catches any errors that occur during the request

        console.error(
          `[${DefaultMicrosoftGraphClient.name}][ERROR] ${
            this.me.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        // Return null if there is an error
        return null;
      });

    return me;
  }

  public async teams(): Promise<Teams | null> {
    // Get the user's teams from the '/teams' endpoint of Microsoft Graph API
    return await this._client
      .api(`/teams`)
      .get()
      .catch((error: any) => {
        // Catches any errors that occur during the request

        console.error(
          `[${DefaultMicrosoftGraphClient.name}][ERROR] ${
            this.teamChannel.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        // Return null if there is an error
        return null;
      });
  }

  public async team(teamAadGroupId: string): Promise<Team | null> {
    // Get the team from the '/teams/{team-id}' endpoint of Microsoft Graph API
    return await this._client
      .api(`/teams/${teamAadGroupId}`)
      .get()
      .catch((error: any) => {
        // Catches any errors that occur during the request

        console.error(
          `[${DefaultMicrosoftGraphClient.name}][ERROR] ${
            this.teamChannel.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        // Return null if there is an error
        return null;
      });
  }

  public async teamChannels(
    teamAadGroupId: string
  ): Promise<TeamChannels | null> {
    // Get the team's channels from the '/teams/{team-id}/channels' endpoint of Microsoft Graph API
    return await this._client
      .api(`/teams/${teamAadGroupId}/channels`)
      .get()
      .catch((error: any) => {
        // Catches any errors that occur during the request

        console.error(
          `[${DefaultMicrosoftGraphClient.name}][ERROR] ${
            this.teamChannel.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        // Return null if there is an error
        return null;
      });
  }

  public async teamChannel(
    teamAadGroupId: string,
    channelId: string
  ): Promise<TeamChannel | null> {
    // Get the team's channel from the '/teams/{team-id}/channels/{channel-id}' endpoint of Microsoft Graph API
    return await this._client
      .api(`/teams/${teamAadGroupId}/channels/${channelId}`)
      .get()
      .catch((error: any) => {
        // Catches any errors that occur during the request

        console.error(
          `[${DefaultMicrosoftGraphClient.name}][ERROR] ${
            this.teamChannel.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        // Return null if there is an error
        return null;
      });
  }

  public async teamChannelMessage(
    teamAadGroupId: string,
    channelId: string,
    threadId: string
  ): Promise<TeamChannelMessage> {
    // Get the team's channel message from the '/teams/{team-id}/channels/{channel-id}/messages/{thread-id}' endpoint of Microsoft Graph API
    return await this._client
      .api(
        `/teams/${teamAadGroupId}/channels/${channelId}/messages/${threadId}`
      )
      .version("beta")
      .get()
      .catch((error: any): TeamChannelMessage | never => {
        // Catches any errors that occur during the request

        console.error(
          `[${DefaultMicrosoftGraphClient.name}][ERROR] ${
            this.teamChannelMessage.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        // Return a deleted message placeholder if there is an error
        if (error.statusCode === "404") {
          // If the error is a 404, it means the message was deleted
          return {
            ...DELETED_MESSAGE,
            id: threadId,
          };
        }
        throw error;
      });
  }

  public async teamChannelMessageReplies(
    teamAadGroupId: string,
    channelId: string,
    threadId: string
  ): Promise<TeamChannelMessage[]> {
    // Get the team's channel message replies from the '/teams/{team-id}/channels/{channel-id}/messages/{thread-id}/replies' endpoint of Microsoft Graph API
    let result: TeamChannelMessage[] = [];
    const replies: TeamChannelMessages = await this._client
      .api(
        `/teams/${teamAadGroupId}/channels/${channelId}/messages/${threadId}/replies`
      )
      .version("beta")
      .get()
      .catch((error: any) => {
        // Catches any errors that occur during the request

        console.error(
          `[${DefaultMicrosoftGraphClient.name}][ERROR] ${
            this.teamChannelMessageReplies.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        // Return null if there is an error
        return null;
      });

    if (replies) {
      // Fetch the next replies from the next link
      let oDataNextLink = replies["@odata.nextLink"];
      while (oDataNextLink) {
        const nextReplies = await this._teamChannelMessageRepliesNext(
          oDataNextLink
        );
        if (!nextReplies) {
          // Break if there is an error fetching the next replies from the next link
          break;
        }

        // Loop through the next replies until there are no more replies
        // and collect them in the result array
        replies.value.push(...nextReplies.value);
        oDataNextLink = nextReplies["@odata.nextLink"];
      }

      // Reverse the replies to get the correct order of the replies since the replies are fetched acsending order by date by default
      result = replies.value.reverse();
    }

    return result ?? [];
  }

  private async _teamChannelMessageRepliesNext(
    odataNextLink: string
  ): Promise<TeamChannelMessages | null> {
    return await this._client
      .api(odataNextLink)
      .version("beta")
      .get()
      .catch((error: any) => {
        // Catches any errors that occur during the request

        console.error(
          `[${DefaultMicrosoftGraphClient.name}][ERROR] ${
            this._teamChannelMessageRepliesNext.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        // Return null if there is an error
        return null;
      });
  }

  public async deleteTeamChannelMessage(
    teamAadGroupId: string,
    channelId: string,
    threadId: string
  ): Promise<void> {
    // Deletes the team's channel message from the '/teams/{team-id}/channels/{channel-id}/messages/{thread-id}' endpoint of Microsoft Graph API
    return await this._client
      .api(
        `/teams/${teamAadGroupId}/channels/${channelId}/messages/${threadId}/softDelete`
      )
      .version("beta")
      .post({})
      .catch((error: Error): void => {
        // Catches any errors that occur during the request

        console.error(
          `[${DefaultMicrosoftGraphClient.name}][ERROR] ${
            this.deleteTeamChannelMessage.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );
      });
  }

  public async deleteTeamChannelMessageReply(
    teamAadGroupId: string,
    channelId: string,
    threadId: string,
    replyId: string
  ): Promise<void> {
    // Deletes the team's channel message reply from the '/teams/{team-id}/channels/{channel-id}/messages/{thread-id}/replies/{reply-id}' endpoint of Microsoft Graph API
    return await this._client
      .api(
        `/teams/${teamAadGroupId}/channels/${channelId}/messages/${threadId}/replies/${replyId}`
      )
      .version("beta")
      .delete()
      .catch((error: Error): void => {
        // Catches any errors that occur during the request

        console.error(
          `[${DefaultMicrosoftGraphClient.name}][ERROR] ${
            this.deleteTeamChannelMessageReply.name
          } error:\n${JSON.stringify(error, null, 2)}`
        );

        // Return null if there is an error
        return null;
      });
  }
}

// Init OnBehalfOfUserCredential instance with SSO token
// const oboCredential = new OnBehalfOfUserCredential(
//   token, // tokenResponse.ssoToken,
//   oboAuthConfig
// );

// // Create an instance of the TokenCredentialAuthenticationProvider by passing the tokenCredential instance and options to the constructor
// const authProvider = new TokenCredentialAuthenticationProvider(
//   oboCredential,
//   {
//     scopes: [
//       "User.Read",
//       "Team.ReadBasic.All",
//       "Channel.ReadBasic.All",
//       "ChatMessage.Read",
//       "ProfilePhoto.Read.All",
//     ],
//   }
// );

// // Initialize Graph client instance with authProvider
// return Client.initWithMiddleware({
//   authProvider: authProvider,
// });
