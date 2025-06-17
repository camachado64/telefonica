import { Router, Response, Request, NextFunction } from "express";

import { graphClient } from "../config/graph";
import { TokenResponse } from "../utils/graphClient";

export const router = Router();

// Microsoft Graph cconnection check endpoint to verify that the API is running
router.get(
  "/health",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.debug(
      `[${req.method} ${req.url}][DEBUG] req.headers:\n${JSON.stringify(
        req.headers,
        null,
        2
      )}`
    );

    // Attempt to connect to the Graph API using the graphClient instance with a me request
    await graphClient
      .health()
      .then((response: TokenResponse) => {
        // Return a 200 status code to indicate that the API is running
        res
          .status(200)
          .send(
            JSON.stringify({ status: 200, data: { token: response } }, null, 2)
          );
      })
      .catch((error: Error) => {
        // Catches any errors that occur during the connection check

        console.error(
          `[${req.method} ${req.url}][ERROR] error:\n${JSON.stringify(
            error,
            null,
            2
          )}`
        );

        // Return a 503 status code to indicate that the API is not running
        res
          .status(503)
          .send(
            JSON.stringify(
              { status: 503, data: { message: "API connection failed" } },
              null,
              2
            )
          );
      });
    next();
  }
);
