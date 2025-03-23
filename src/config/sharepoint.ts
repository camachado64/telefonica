import { DefaultSharepointClient } from "../utils/sharepointClient";
import { config } from "./config";

export const sharepointClient = new DefaultSharepointClient(config, {
  username: config.graphUsername,
  password: config.graphPassword,
});
