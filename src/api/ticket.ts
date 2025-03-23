import { Router, Response, Request, NextFunction } from "express";

import { apiClient } from "../config/ticket";

export const router = Router();

// Database health check endpoint to verify that the database is running
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

    // Attempt to connect to the ticketing API
    const cookie = await apiClient.login();
    if (cookie) {
      // If we successfully connect the cookie will be defined

      console.debug(
        `[${req.method} ${req.url}][DEBUG] cookie:\n${JSON.stringify(
          cookie,
          null,
          2
        )}`
      );

      // Return a 200 status code to indicate that the API connection was successful
      res.status(200).send(
        JSON.stringify(
          {
            status: 200,
            data: { message: "API connection successful", cookie },
          },
          null,
          2
        )
      );
    } else {
      // If the cookied is not defined, we failed to connect to the API, return a 503 status code to indicate that the API connection failed
      res
        .status(503)
        .send(
          JSON.stringify(
            { status: 503, data: { message: "API connection failed" } },
            null,
            2
          )
        );
    }

    next();
  }
);
