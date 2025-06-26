import { BotConfiguration } from "../config/config";
import { MicrosoftGraphClient, TeamChannelMessage } from "./graphClient";
import { HttpContentTypes, HttpHeaders, HttpMethods } from "./http";
import { logError } from "./logging";
import { Required, TypeUtils } from "./types";

export type HyperlinkEntity = Partial<{
  id: string;
  name: string;

  type: string;
  ref: HyperlinkType;

  _url: string;

  from: string;
  to: string;
  label: string;
  update: string;
}>;

export type TypedHyperlinkEntity = HyperlinkEntity &
  Required<HyperlinkEntity, "type" | "_url">;

export type RefHyperlinkEntity = HyperlinkEntity &
  Required<HyperlinkEntity, "ref" | "_url">;

export type CustomFieldHyperlink = TypedHyperlinkEntity &
  Required<HyperlinkEntity, "name"> & {
    values?: string[];
  };

export enum HyperlinkType {
  Self = "self",
  User = "user",
  Queue = "queue",
  Ticket = "ticket",
  CustomField = "customfield",
  CustomFieldValue = "customfieldvalue",
  Create = "create",
  Comment = "comment",
  History = "history",
}

export interface PagedCollection<T> {
  items: T[];
  page: number;
  per_page: number;
  total: number;
  pages: number;
  count: number;
  next_page?: string;
  prev_page?: string;
}

export interface TicketHistory extends PagedCollection<TypedHyperlinkEntity> {}

export interface Queues extends PagedCollection<TypedHyperlinkEntity> {}

export interface Queue {
  id: string;
  Name: string;
  TicketCustomFields: CustomFieldHyperlink[];
  _hyperlinks: RefHyperlinkEntity[];
}

export interface CreateTicket extends TypedHyperlinkEntity {}

export interface Ticket {
  id: string;

  Subject: string;
  Type: string;
  Status: string;

  Requestor: string[];

  InitialPriority: number;
  Priority: number;
  FinalPriority: number;

  TimeLeft: number;
  TimeWorked: number;
  TimeEstimated: number;

  Cc: string[];
  AdminCc: string[];

  Started: Date;
  Resolved: Date;
  Starts: Date;
  Due: Date;
  Created: Date;
  LastUpdated: Date;

  Queue: TypedHyperlinkEntity;
  Owner: TypedHyperlinkEntity;
  Creator: TypedHyperlinkEntity;
  LastUpdatedBy: TypedHyperlinkEntity;

  EffectiveId: TypedHyperlinkEntity;

  CustomFields: CustomFieldHyperlink[];

  _hyperlinks: RefHyperlinkEntity[];
}

export interface CustomField {
  id: string;
  Name: string;
  Description: string;
  Values: string[];
  Type: "Select" | "Freeform" | string;
  Disabled: "0" | "1";
  MaxValues: number;
  Pattern: string;
  BasedOn?: TypedHyperlinkEntity;
  Dependents?: CustomField[];
  _hyperlinks: RefHyperlinkEntity[];
}

export interface CustomFieldValue {
  id: string;
  Name: string;
  Description: string;
  Category: string;
  _hyperlinks: RefHyperlinkEntity[];
}

export interface User {
  id: string;
  Name: string;
  Email: string;
  RealName: string;
  Privileged: "0" | "1";
  _hyperlinks: RefHyperlinkEntity[];
}

export class APIClient {
  private _cookie: string | null = null;

  constructor(private readonly _config: BotConfiguration) {}

  public async login(): Promise<string | null> {
    // Logs into the API and returns the cookie to be used in subsequent requests

    console.debug(
      `[${APIClient.name}][DEBUG] ${this.login.name} endpoint: ${this._config.apiEndpoint}`
    );

    // Fetch the cookie from the API using the supplied credentials
    const cookie: string | null = await fetch(`${this._config.apiEndpoint}`, {
      method: HttpMethods.Post,
      headers: {
        [HttpHeaders.ContentType]: HttpContentTypes.FormUrlEncoded,
        // Accept:
        //   "text/html,\
        //   application/xhtml+xml,\
        //   application/xml;0.9,\
        //   image/avif,\
        //   image/webp,\
        //   image/apng;q=0.9,\
        //   image/avif,\
        //   image/webp,\
        //   image/apng,\
        //   /;q=0.8,\
        //   application/signed-exchange;v=b3;q=0.7",
      },
      body: new URLSearchParams({
        user: this._config.apiUsername,
        pass: this._config.apiPassword,
        next: "7a73ae647301ce8bdff23044613b37a3",
      }),
    })
      .then((response: Response): string => {
        //   const helper = async function (
        //     array: ReadableStream<Uint8Array>
        //   ): Promise<string> {
        //     const utf8 = new TextDecoder("utf-8");
        //     let asString = "";
        //     for await (const chunk of array as any) {
        //       // Can use for-await starting ES 2018
        //       asString += utf8.decode(chunk);
        //     }
        //     return asString;
        //   };
        //   const asString = await helper(response.body);
        //   for (const header of response.headers.entries()) {
        //     console.debug(
        //       `[${APIClient.name}][DEBUG] ${this.login.name} header:\n${header}`
        //     );
        //   }

        if (!response.ok) {
          // If the response is not OK, throw an error to be caught by the catch block below
          throw new Error(
            `Failed to login to API. Status: ${response.status}, Status Text: ${response.statusText}`
          );
        }

        // Gets the Set-Cookie header from the response
        const setCookies = response.headers.getSetCookie();
        if (setCookies) {
          // If the Set-Cookie header is found, return the first cookie in the header (There can be multiple Set-Cookie headers)
          return setCookies[0];
        }

        // If the Set-Cookie header is not found, throw an error to be caught by the catch block below
        throw new Error("No Set-Cookie header found in the response.");
      })
      .catch((error: any) => {
        // Catches any errors that occur during the login process, logs the error, and returns null
        logError(APIClient.name, this.login.name, error);
        return null;
      });

    // Returns the result of the login process to the caller
    return cookie;
  }

  public async get<T>(url: string): Promise<T> {
    if (!this._cookie) {
      // If the cookie is not set, login to the API and set the cookie
      this._cookie = await this.login();
    }

    console.debug(
      `[${APIClient.name}][DEBUG] ${this.get.name} endpoint: ${url}`
    );

    // Fetch the data from the API as a GET request
    return fetch(url, {
      method: HttpMethods.Get,
      headers: {
        Cookie: this._cookie!,
        Accept: HttpContentTypes.Json,
      },
    }).then((response: Response): Promise<T> => {
      // Return the JSON response from the API
      return response?.json();
    });
  }

  public async next<T>(
    page: PagedCollection<T>
  ): Promise<PagedCollection<T> | null> {
    if (!this._cookie) {
      // If the cookie is not set, login to the API and set the cookie
      this._cookie = await this.login();
    }

    if (!page.next_page) {
      // If the next page is not found, return null
      return null;
    }

    console.debug(
      `[${APIClient.name}][DEBUG] ${this.next.name} endpoint: ${page.next_page}`
    );

    // Fetch the next page of the collection
    return this.get<PagedCollection<T>>(page.next_page);
  }

  public async queues(): Promise<Queues> {
    // if (!this._cookie) {
      // If the cookie is not set, login to the API and set the cookie
      this._cookie = await this.login();
    // }

    console.debug(
      `[${APIClient.name}][DEBUG] ${this.queues.name} endpoint: ${this._config.apiEndpoint}/REST/2.0/queues/all`
    );

    // Fetch the queues
    return this.get<Queues>(`${this._config.apiEndpoint}/REST/2.0/queues/all`);
  }

  public async queue(queue: TypedHyperlinkEntity | string): Promise<Queue> {
    if (!this._cookie) {
      // If the cookie is not set, login to the API and set the cookie
      this._cookie = await this.login();
    }

    if (TypeUtils.isString(queue)) {
      // If the queue is a string, convert it to a hyperlink entity
      queue = {
        id: queue,
        _url: `${this._config.apiEndpoint}/REST/2.0/queue/${queue}`,
        type: "queue",
      };
    }

    console.debug(
      `[${APIClient.name}][DEBUG] ${this.queue.name} endpoint: ${queue._url}`
    );

    if (queue.type !== "queue") {
      // If the queue is not of the expected type, throw an error
      throw new Error(
        `The supplied hyperlink of type '${queue.type}' is not of the expected type 'queue'.`
      );
    }

    // Fetch the queue
    return this.get<Queue>(`${queue._url}`);
  }

  public async createTicket(
    queue: Queue,
    subject: string,
    status: string,
    description: string,
    requestorEmail: string,
    ownerEmail: string,
    customFields: {
      [key: string]: {
        text: string;
        value: string;
      };
    }
  ): Promise<Ticket> {
    // if (!this._cookie) {
      // If the cookie is not set, login to the API and set the cookie
      this._cookie = await this.login();
    // }

    console.debug(
      `[${APIClient.name}][DEBUG] ${
        this.createTicket.name
      } queue:\n${JSON.stringify(queue, null, 2)}`
    );

    const endpoint: string = queue._hyperlinks.find((v: RefHyperlinkEntity) => v.ref === "create")._url;

    console.debug(
      `[${APIClient.name}][DEBUG] ${this.createTicket.name} endpoint: ${endpoint}`
    );

    const customFieldsBody: { [key: string]: string } = {};
    if (customFields && Object.keys(customFields).length > 0) {
      // If custom fields are provided, convert them to the expected format
      for (const [_, value] of Object.entries(customFields)) {
        customFieldsBody[value.text] = value.value;
      }
    }

    const ownerUser: User = await this.user(ownerEmail);

    console.debug(
      `[${APIClient.name}][DEBUG] ${
        this.createTicket.name
      } body:\n${JSON.stringify(
        JSON.stringify(
          {
            Subject: subject,
            Status: status,
            Content: description,
            CustomFields: customFieldsBody,
            Requestor: requestorEmail,
            Owner: ownerUser?.Name,
          },
          null,
          2
        )
      )}`
    );

    // Create the ticket using the supplied queue and subject
    const createTicket: CreateTicket = await fetch(
      endpoint,
      {
        method: HttpMethods.Post,
        headers: {
          Cookie: this._cookie,
          [HttpHeaders.ContentType]: HttpContentTypes.Json,
        },
        body: JSON.stringify({
          Subject: subject,
          Status: status,
          Content: description,
          CustomFields: customFieldsBody,
          // Creator: creator,
          Requestor: requestorEmail,
          Owner: ownerUser?.Name,
        }),
      }
    ).then((response: Response): Promise<CreateTicket> => {
      return response?.json();
    });

    console.debug(
      `[${APIClient.name}][DEBUG] ${
        this.createTicket.name
      } createTicket:\n${JSON.stringify(createTicket, null, 2)}`
    );

    return await this.ticket(createTicket);
  }

  public async ticket(ticket: TypedHyperlinkEntity): Promise<Ticket> {
    // if (!this._cookie) {
      this._cookie = await this.login();
    // }

    console.debug(
      `[${APIClient.name}][DEBUG] ${this.ticket.name} endpoint: ${ticket._url}`
    );

    if (ticket.type !== "ticket") {
      throw new Error(
        `The supplied hyperlink of type '${ticket.type}' is not of the expected type 'ticket'.`
      );
    }

    return await this.get<Ticket>(ticket._url);
  }

  public async updateTicket(ticket: Ticket): Promise<any> {
    // if (!this._cookie) {
      this._cookie = await this.login();
    // }

    const endpoint = ticket._hyperlinks.find((v) => v.ref === "self")._url;

    console.debug(
      `[${APIClient.name}][DEBUG] ${this.updateTicket.name} endpoint: ${endpoint}`
    );

    return fetch(endpoint, {
      method: HttpMethods.Put,
      headers: {
        Cookie: this._cookie,
        [HttpHeaders.ContentType]: HttpContentTypes.Json,
      },
      body: JSON.stringify({
        Status: ticket.Status,
      }),
    }).then((response: Response): Promise<any> => {
      return response?.json();
    });
  }

  public async addTicketComment(
    graphClient: MicrosoftGraphClient,
    ticket: Partial<Ticket>,
    message: TeamChannelMessage
  ): Promise<string[]> {
    // if (!this._cookie) {
      this._cookie = await this.login();
    // }

    console.debug(
      `[${APIClient.name}][DEBUG] ${this.addTicketComment.name} message.id:${message.id}, message.@odata.context: ${message["@odata.context"]}`
    );

    console.debug(
      `[${APIClient.name}][DEBUG] ${this.addTicketComment.name} endpoint: ${
        ticket._hyperlinks.find((v) => v.ref === "comment")._url
      }`
    );

    // const botToken = await MicrosoftGraphUtils.getAccessToken(this._config);

    const attachments = [];
    if (message.attachments?.length > 0) {
      message.body.content += "<br><br>Attachments:<br>";

      for (const attachment of message.attachments) {
        message.body.content += `<a href="${attachment.contentUrl}">${attachment.name}</a><br>`;

        // const buffer = await fetch(attachment.contentUrl, {
        //   method: "GET",
        //   headers: {
        //     Authorization: `${botToken.tokenType} ${botToken.token}`,
        //   },
        // }).then((res: Response): Promise<ArrayBuffer> => {
        //   return res.arrayBuffer();
        // });

        // console.debug(
        //   `[${APIClient.name}][DEBUG] ${
        //     this.addTicketComment.name
        //   } buffer:\n${JSON.stringify(buffer, null, 2)}`
        // );

        // const decoder = new TextDecoder("utf-8");
        // const bufferStr = decoder.decode(buffer);
        // const encodedFile = Buffer.from(bufferStr, "binary").toString("base64");

        // console.debug(
        //   `[${APIClient.name}][DEBUG] ${
        //     this.addTicketComment.name
        //   } encodedFile:\n${JSON.stringify(encodedFile, null, 2)}`
        // );

        // attachments.push({
        //   FileName: attachment.id,
        //   FileType: "text/plain",
        //   FileContent: encodedFile,
        // });
      }
    }

    const createComment: string[] = await fetch(
      `${ticket._hyperlinks.find((v) => v.ref === "comment")._url}`,
      {
        method: HttpMethods.Post,
        headers: {
          Cookie: this._cookie,
          [HttpHeaders.ContentType]: HttpContentTypes.Json,
        },
        body: JSON.stringify({
          Subject: `Respuesta de ${message.from.user.displayName}`,
          Content: message.body.content,
          ContentType: HttpContentTypes.Html,
          TimeTaken: "1",
          Attachments: attachments,
        }),
      }
    ).then((response: Response): Promise<string[]> => {
      return response?.json();
    });

    console.debug(
      `[${APIClient.name}][DEBUG] ${
        this.addTicketComment.name
      } createComment:\n${JSON.stringify(createComment, null, 2)}`
    );

    return createComment;
  }

  public async ticketHistory(ticket: Partial<Ticket>): Promise<TicketHistory> {
    // if (!this._cookie) {
      this._cookie = await this.login();
    // }

    console.debug(
      `[${APIClient.name}][DEBUG] ${this.addTicketComment.name} endpoint: ${
        ticket._hyperlinks.find((v) => v.ref === "history")._url
      }`
    );

    const history: TicketHistory = await this.get<TicketHistory>(
      ticket._hyperlinks.find((v) => v.ref === "history")._url
    );

    console.debug(
      `[${APIClient.name}][DEBUG] ${
        this.ticketHistory.name
      } history:\n${JSON.stringify(history, null, 2)}`
    );

    return history;
  }

  public async queueCustomFields(queueId: string): Promise<CustomField[]> {
    if (!this._cookie) {
      this._cookie = await this.login();
    }

    if (!queueId) {
      // If the queue ID is not provided, throw an error
      throw new Error("Queue ID is required to fetch custom fields.");
    }

    const queue: Queue = await this.queue(queueId);

    const customFields = [];
    if (!queue || !queue.TicketCustomFields) {
      // If the queue is not provided or it does not have 'TicketCustomFields', return an empty array
      return customFields;
    }

    for (const hyperlink of queue.TicketCustomFields) {
      if (hyperlink.ref === "customfield") {
        // If the hyperlink is of type 'customfield', fetch the custom fields
        const customField: CustomField = await this.get<CustomField>(
          hyperlink._url
        );

        if (!customField || !customField.id) {
          // If the custom field is not found or does not have an ID, skip it
          continue;
        }

        console.debug(
          `[${APIClient.name}][DEBUG] ${
            this.queueCustomFields.name
          } customField:\n${JSON.stringify(customField, null, 2)}`
        );

        customFields.push(customField);
      }
    }

    return customFields;
  }

  public async customFieldValues(
    customFieldId: string,
    value: string
  ): Promise<CustomFieldValue[]> {
    // if (!this._cookie) {
      this._cookie = await this.login();
    // }

    if (!customFieldId) {
      // If the custom field ID is not provided, throw an error
      throw new Error("Custom field ID is required to fetch choices.");
    }

    console.debug(
      `[${APIClient.name}][DEBUG] ${
        this.customFieldValues.name
      } endpoint: ${`${this._config.apiEndpoint}/REST/2.0/customfield/${customFieldId}/values`}`
    );

    console.debug(
      `[${APIClient.name}][DEBUG] ${this.customFieldValues.name} value: ${value}`
    );

    // Fetch the custom field choices
    return await this.get<PagedCollection<TypedHyperlinkEntity>>(
      `${this._config.apiEndpoint}/REST/2.0/customfield/${customFieldId}/values`
    ).then(
      async (
        response: PagedCollection<TypedHyperlinkEntity>
      ): Promise<CustomFieldValue[]> => {
        // Convert the response to an array of CustomFieldValue objects
        if (!response || response.items?.length === 0) {
          // If the response is empty, return an empty array
          return [];
        }

        // Map the response to CustomFieldValue objects
        const customFieldValues: CustomFieldValue[] = [];
        for (const ref of response.items) {
          if (ref.type !== "customfieldvalue") {
            continue;
          }

          const customFieldValue: CustomFieldValue =
            await this.get<CustomFieldValue>(ref._url);
          if (!customFieldValue || !customFieldValue.id) {
            // If the custom field value is not found or does not have an ID, skip it
            continue;
          }

          if (customFieldValue.Category === value) {
            customFieldValues.push(customFieldValue);
          }
        }

        const total: number = response.total;
        let seen: number = response.count;
        let page: number = response.page;
        while (seen <= total) {
          const nextResponse: PagedCollection<TypedHyperlinkEntity> =
            await this.get<PagedCollection<TypedHyperlinkEntity>>(
              `${
                this._config.apiEndpoint
              }/REST/2.0/customfield/${customFieldId}/values?page=${++page}`
            );
          if (!nextResponse || nextResponse.items?.length === 0) {
            break;
          }

          seen += nextResponse.count;

          console.debug(
            `[${APIClient.name}][DEBUG] ${this.customFieldValues.name} seen: ${seen}`
          );

          for (const ref of nextResponse.items) {
            if (ref.type !== "customfieldvalue") {
              continue;
            }

            const customFieldValue: CustomFieldValue =
              await this.get<CustomFieldValue>(ref._url);
            if (!customFieldValue || !customFieldValue.id) {
              // If the custom field value is not found or does not have an ID, skip it
              continue;
            }

            if (customFieldValue.Category === value) {
              customFieldValues.push(customFieldValue);
            }
          }
        }

        return customFieldValues;
      }
    );
  }

  public async user(email: string): Promise<User> {
    // if (!this._cookie) {
      this._cookie = await this.login();
    // }

    console.debug(
      `[${APIClient.name}][DEBUG] ${this.user.name} email: ${email}`
    );

    // Fetch the user by email
    return await this.get<User>(
      `${this._config.apiEndpoint}/REST/2.0/user/${email}`
    );
  }
}
