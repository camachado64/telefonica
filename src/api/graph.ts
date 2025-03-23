import { Router, Response, Request, NextFunction } from "express";

import { graphClient } from "../config/graph";

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
    const me = await graphClient.me();
    if (me instanceof Error) {
      console.error(
        `[${req.method} ${req.url}][ERROR] error:\n${JSON.stringify(
          me,
          null,
          2
        )}`
      );

      res.status(503).send(
        JSON.stringify(
          {
            status: 503,
            data: { message: "Microsoft Graph API connection failed" },
          },
          null,
          2
        )
      );
    } else {
      // Return a 200 status code to indicate that the API connection was successful
      res.status(200).send(
        JSON.stringify(
          {
            status: 200,
            data: { message: "API connection successful", me },
          },
          null,
          2
        )
      );
    }

    next();
  }
);
