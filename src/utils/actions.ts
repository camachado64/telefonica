import {
  ChannelAccount,
  ChannelInfo,
  ConversationAccount,
  TeamDetails,
} from "botbuilder";

export enum AdaptiveCardAction {
  Name = "adaptiveCard/action",

  AuthRefresh = "authRefresh",
  CreateTicket = "createTicket",
}

export type AdaptiveCardActionActivityValue = {
  action: {
    verb: string;
    data?: any & {
      command: string;
    };
  };
};

export type AdaptiveCardActionAuthRefreshDataInput = {
  command: string;
  team: TeamDetails;
  channel: ChannelInfo;
  conversation: ConversationAccount;
  from: ChannelAccount;
  userIds: string[];
};

export type AdaptiveCardActionAuthRefreshDataOutput = {
  command: string;
  team: TeamDetails;
  channel: ChannelInfo;
  conversation: ConversationAccount;
  from: ChannelAccount;
};

export type AdaptiveCardActionCreateTicketData = {
  command: string;
  team: TeamDetails & { choices: { title: string; value: string }[] };
  channel: { id: string; name: string } & {
    choices: { title: string; value: string }[];
  };
  conversation: { id: string; name: string } & {
    choices: { title: string; value: string }[];
  };
  from: ChannelAccount & { choices: { title: string; value: string }[] };
  ticket: {
    state: {
      id: string;
      choices: { title: string; value: string }[];
    };
    queue: {
      id: string;
      choices: { title: string; value: string }[];
    };
    description: string;
  };
  token: string;
  createdUtc: string;
  gui: any;

  ticketStateChoiceSet: string;
  ticketCategoryChoiceSet: string;
  ticketDescriptionInput: string;
};
