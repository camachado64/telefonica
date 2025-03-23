import { APIClient } from "../utils/apiClient";
import { config } from "./config";

// Create the API client to the ticketing API
export const apiClient: APIClient = new APIClient(config);
