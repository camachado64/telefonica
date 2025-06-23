import { CardFactory, MessageFactory } from "botbuilder";
import { TriggerPatterns } from "@microsoft/teamsfx";

import * as ACData from "adaptivecards-templating";

import {
  HandlerMessage,
  HandlerMessageContext,
  HandlerState,
} from "../../../commands/manager";
import { ActionHandler } from "../../../commands/handler";
import { HandlerTurnContext } from "../../../commands/context";
import {
  AdaptiveCardActionActivityValue,
  AdaptiveCardActionSelectChoiceData,
  AdaptiveCardTicketCardPageData,
} from "../../../utils/actions";
import { APIClient, CustomFieldValue } from "../../../utils/apiClient";

import page0 from "../../templates/ticket/page0.json";

export class TicketAdaptiveCardSelectChoiceActionHandler
  implements ActionHandler
{
  public pattern: TriggerPatterns = "selectChoiceTicket";

  constructor(private readonly _apiClient: APIClient) {}

  public async run(
    handlerContext: HandlerTurnContext,
    commandMessage: HandlerMessage,
    commandMessageContext?: HandlerMessageContext
  ): Promise<void> {
    console.debug(
      `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][TRACE] ${this.run.name}@start`
    );

    // Get the data from the action and update the card GUI properties to reflect the state of the ticket creation
    const activityValue: AdaptiveCardActionActivityValue =
      handlerContext.context.activity.value;
    const actionData: AdaptiveCardActionSelectChoiceData =
      activityValue?.action?.data;

    // Calidate that we can retrieve the state
    const state: HandlerState = handlerContext.state;
    if (!state) {
      throw new Error("Ticket adaptive card state is not initialized.");
    }

    // Get the choiceId from the action data
    const choiceType: string = actionData?.choice;
    const page: number = actionData.gui.page;

    console.debug(
      `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${this.run.name} page: ${page}`
    );

    if (page === 0) {
      // Update the corresponding state property based on the 'choiceType'
      switch (choiceType) {
        case "ticketStateChoiceSet":
          await this._selectChoice(state, activityValue, choiceType);
          break;
        case "ticketCategoryChoiceSet":
          await this._selectChoice(state, activityValue, choiceType);
          break;
      }

      const enabled: boolean =
        Boolean(state.ticket.ticketStateChoiceSet.value) &&
        Boolean(state.ticket.ticketCategoryChoiceSet.value);

      console.debug(
        `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${this.run.name} enabled: ${enabled}`
      );

      if (enabled) {
        actionData.gui.buttons.create.enabled = enabled;
      }
    } else {
      // For custom fields, we need to update the state with the selected choice
      const customFieldId: string = actionData.choice;
      await this._selectCustomFieldChoice(state, activityValue, customFieldId);

      // Check if all custom fields are filled in and if the create button should be enabled
      let enabled: boolean = true;
      const customFields = state.page1.body[4].items;
      for (const item of customFields) {
        const key = item.items[0].id;
        const field = state.ticket.customFields[key];

        console.debug(
          `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${this.run.name} field.id: ${field.id}, field.value: ${field.value}`
        );

        // If the field is required and has no value, we cannot enable the create button
        if (field.required && !field.value && field.choices?.length > 0) {
          enabled = false;
          break;
        }
      }
      // Update the create button state based on the custom fields validation
      state.gui.buttons.create.enabled = enabled;

      console.debug(
        `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${this.run.name} enabled: ${enabled}`
      );

      // console.debug`[${
      //   TicketAdaptiveCardSelectChoiceActionHandler.name
      // }][DEBUG] ${this.run.name} state.page1:\n${JSON.stringify(
      //   state.page1,
      //   null,
      //   2
      // )}`;

      // Update the GUI properties of the card to reflect the state of the ticket creation
      const cardData: AdaptiveCardTicketCardPageData = {
        sequenceId: state.sequenceId,
        gui: state.gui,
      };

      // Expands the adaptive card template with the data provided
      const cardJson = new ACData.Template(state.page1).expand({
        $root: cardData,
      });

      // console.debug(
      //   `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${
      //     this.run.name
      //   } cardJson:\n${JSON.stringify(cardJson, null, 2)}`
      // );

      // Update the card with the ticket information that was just submitted
      const message = MessageFactory.attachment(
        CardFactory.adaptiveCard(cardJson)
      );
      message.id = handlerContext.context.activity.replyToId;
      await handlerContext.context.updateActivity(message);

      return;
    }

    // Update the GUI properties of the card to reflect the state of the ticket creation
    const cardData: AdaptiveCardTicketCardPageData = {
      sequenceId: state.sequenceId,
      ticket: state.ticket,
      gui: actionData.gui,
    };

    // Expands the adaptive card template with the data provided
    const cardJson = new ACData.Template(page0).expand({
      $root: cardData,
    });

    // Update the card with the ticket information that was just submitted
    const message = MessageFactory.attachment(
      CardFactory.adaptiveCard(cardJson)
    );
    message.id = handlerContext.context.activity.replyToId;
    await handlerContext.context.updateActivity(message);

    console.debug(
      `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][TRACE] ${this.run.name}@end`
    );
  }

  private async _selectChoice(
    state: HandlerState,
    activityValue: AdaptiveCardActionActivityValue,
    choiceSet: string
  ): Promise<void> {
    console.debug(
      `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][TRACE] ${this._selectChoice.name}@start`
    );

    const choiceValue: string = activityValue[choiceSet];
    state.ticket[choiceSet].value = choiceValue;
    state.ticket.ticketCategoryChoiceSet.required = true;

    console.debug(
      `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${this._selectChoice.name} choiceValue: ${choiceValue}`
    );

    console.debug(
      `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${
        this._selectChoice.name
      } handlerState.ticket:\n${JSON.stringify(state.ticket, null, 2)}`
    );

    console.debug(
      `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][TRACE] ${this._selectChoice.name}@end`
    );
  }

  private async _selectCustomFieldChoice(
    state: HandlerState,
    activityValue: AdaptiveCardActionActivityValue,
    customFieldId: string
  ): Promise<void> {
    console.debug(
      `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][TRACE] ${this._selectCustomFieldChoice.name}@start`
    );

    const customFieldValue: string = activityValue[customFieldId];
    const customFieldState = state.ticket.customFields[customFieldId];

    if (!customFieldValue) {
      // If customFieldValue is empty but customField.value is defined, it means the user wants to reset the field
      // If both are empty, we can just return
      if (!customFieldState?.value) {
        console.debug(
          `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][TRACE] ${this._selectCustomFieldChoice.name}@end[NO_VALUE]`
        );
        return;
      }

      const customFieldsJson = state.page1.body[4].items;
      for (const customFieldJson of customFieldsJson) {
        const keyJson: string = customFieldJson.items[0].id;

        if (keyJson === customFieldId) {
          console.debug(
            `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${this._selectCustomFieldChoice.name} Resetting field: ${keyJson}`
          );

          customFieldState.value = "";

          if (customFieldJson.items[1].items) {
            customFieldJson.items[1].items[0].type = "Input.ChoiceSet";
            customFieldJson.items[1].items[0].text = "";
            customFieldJson.items[1].items[0].value = "";
            customFieldJson.items[1].items[0].choices =
              customFieldState.choices;
            customFieldJson.items[1].items[0].isRequired = true;
          }
        }
      }

      await this._resetField(state, customFieldId, null);

      console.debug(
        `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][TRACE] ${this._selectCustomFieldChoice.name}@end[FIELD_RESET]`
      );

      return;
    }

    if (!customFieldState) {
      throw new Error(
        `Custom field with id ${customFieldId} not found in the ticket state.`
      );
    }

    if (customFieldState.value === customFieldValue) {
      console.debug(
        `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][TRACE] ${this._selectCustomFieldChoice.name}@end[NO_CHANGE]`
      );

      return;
    }

    const customFieldsJson = state.page1.body[4].items;
    for (const customFieldJson of customFieldsJson) {
      const keyJson: string = customFieldJson.items[0].id;
      const currentFieldState: any = state.ticket.customFields[keyJson];

      // Update the field value in the state with the "auto" inputs returned by the adaptive card
      if (keyJson in activityValue) {
        currentFieldState.value = activityValue[keyJson] || "";
      }

      // Update the field value in the card
      // if (customFieldState.type === "Select") {
      //   customFieldJson.items[1].items[0].value = customFieldState.value;
      // } else {
      //   customFieldJson.items[1].value = customFieldState.value;
      // }

      if (keyJson === customFieldId) {
        console.debug(
          `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${this._selectCustomFieldChoice.name} Updating field: ${keyJson}`
        );

        console.debug(
          `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${this._selectCustomFieldChoice.name} customFieldValue:\n`,
          customFieldJson
        );

        if (customFieldJson.items[1].items) {
          // item.items[1].items[0].type = "TextBlock";
          // item.items[1].items[0].text = customFieldValue;
          // item.items[1].items[0].value = customFieldValue;
          // item.items[1].items[0].isRequired = true;
          customFieldJson.items[1].items[0].type = "TextBlock";
          customFieldJson.items[1].items[0].text = currentFieldState.value;
          customFieldJson.items[1].items[0].value = currentFieldState.value;
          customFieldJson.items[1].items[0].isRequired = true;
        }
      }
    }

    // customFieldState.value = customFieldValue;

    console.debug(
      `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${
        this._selectCustomFieldChoice.name
      } state.ticket:\n${JSON.stringify(state.ticket, null, 2)}`
    );

    await this._resetField(state, customFieldId, customFieldValue);

    console.debug(
      `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][TRACE] ${this._selectCustomFieldChoice.name}@end`
    );
  }

  private async _resetField(
    state: HandlerState,
    customFieldId: string,
    customFieldValue: string
  ): Promise<void> {
    console.debug(
      `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][TRACE] ${this._resetField.name}@start`
    );

    console.debug(
      `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${this._resetField.name} customFieldId: ${customFieldId}`
    );

    // Once a field value changes all other fields that are 'basedOn' this field
    // should be reset to empty string and its choices should be recalculated
    for (const key of Object.keys(state.ticket.customFields)) {
      const customFieldState = state.ticket.customFields[key];

      console.debug(
        `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${this._resetField.name} field.id: ${customFieldState.id}, field.basedOn: ${customFieldState.basedOn}`
      );

      if (customFieldState.basedOn === customFieldId) {
        console.debug(
          `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${this._resetField.name} Resetting field: ${customFieldState.id}`
        );

        let choices: { title: string; value: string }[] = [];
        if (customFieldValue) {
          choices = await this._apiClient
            .customFieldValues(customFieldState.id, customFieldValue)
            .then((response: CustomFieldValue[]) => {
              return response.map((value: CustomFieldValue) => {
                return { title: value.Name, value: value.Name };
              });
            });
        }

        console.debug(
          `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${
            this._resetField.name
          } choices: ${JSON.stringify(choices, null, 2)}`
        );

        customFieldState.value = "";
        customFieldState.choices = choices;

        const customFieldsJson = state.page1.body[4].items;
        for (const customFieldJson of customFieldsJson) {
          const keyJson: string = customFieldJson.items[0].id;

          if (keyJson === String(customFieldState.id)) {
            console.debug(
              `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][DEBUG] ${this._resetField.name} Updating field: ${keyJson}`
            );

            customFieldJson.items[1].items[0].type = "Input.ChoiceSet";
            customFieldJson.items[1].items[0].choices = choices;
            customFieldJson.items[1].items[0].value = "";
            customFieldJson.items[1].items[0].text = "";
            customFieldJson.items[1].items[0].isRequired = false;
            customFieldJson.items[1].selectAction.isEnabled =
              choices.length > 0;
            break;
          }
        }

        this._resetField(state, String(customFieldState.id), null);
      }
    }

    console.debug(
      `[${TicketAdaptiveCardSelectChoiceActionHandler.name}][TRACE] ${this._resetField.name}@end`
    );
  }
}
