import { DefaultMicrosoftGraphClient } from "../utils/graphClient";
import { config } from "./config";

// Create the graph client
export const graphClient = new DefaultMicrosoftGraphClient(config, {
  username: config.graphUsername,
  password: config.graphPassword,
});
