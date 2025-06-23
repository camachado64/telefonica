export enum AdaptiveCardAction {
  Name = "adaptiveCard/action",

  AuthRefresh = "authRefresh",
  CreateTicket = "createTicket",
}

export type AdaptiveCardActionActivityValue = {
  action: {
    verb: string;
    data?: {
      sequenceId?: string;
    } & any;
  };
};

export type AdaptiveCardActionAuthRefreshDataInput = {
  sequenceId: string;
  userIds: string[];
};

export type AdaptiveCardActionAuthRefreshDataOutput = {
  sequenceId: string;
};

export type AdaptiveCardTicketCardDataPageGUI = {
  page: number;
  header: {
    startedAt: string;
    from: {
      name: string;
      email: string;
    };
  };
  context: {
    team: string;
    channel: string;
    conversation: string;
  };
  // customFields?: any[];
  buttons: {
    visible: boolean;
    create: {
      title: string;
      tooltip: string;
      enabled: boolean;
    };
    cancel: {
      title: string;
      tooltip: string;
      enabled: boolean;
    };
  };
};

export type AdaptiveCardActionSelectChoiceData = {
  sequenceId: string;
  choice: string;
  gui: AdaptiveCardTicketCardDataPageGUI;
};

export type AdaptiveCardTicketCardPageData = {
  sequenceId: string;
  ticket?: any;
  gui: AdaptiveCardTicketCardDataPageGUI;
};

export type AdaptiveCardActionPositiveTicketPageData = {
  sequenceId: string;
  ticketStateChoiceSet?: string;
  ticketCategoryChoiceSet?: string;
  ticketDescriptionInput?: string;
};

// export type AdaptiveCardActionCreateTicketData = {
//   // command: string;
//   team: TeamDetails & { choices: { title: string; value: string }[] };
//   channel: { id: string; name: string } & {
//     choices: { title: string; value: string }[];
//   };
//   conversation: { id: string; name: string } & {
//     choices: { title: string; value: string }[];
//   };
//   from: ChannelAccount & { choices: { title: string; value: string }[] };
//   ticket: {
//     state: {
//       id: string;
//       choices: { title: string; value: string }[];
//     };
//     queue: {
//       id: string;
//       choices: { title: string; value: string }[];
//     };
//     description: string;
//   };
//   // token: string;
//   // createdUtc: string;
//   gui: any;

//   ticketStateChoiceSet: string;
//   ticketCategoryChoiceSet: string;
//   ticketDescriptionInput: string;
// };
