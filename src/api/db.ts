import { Router, Response, Request, NextFunction } from "express";

import { dbConnection } from "../config/db";

export const router = Router();

// Database health check endpoint to verify that the database is running
router.get(
  "/health",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.debug(
      `[dbRouter][DEBUG] [${req.method} ${
        req.url
      }] req.headers:\n${JSON.stringify(req.headers, null, 2)}`
    );

    try {
      // Connect to the database
      await dbConnection.connect();

      console.debug(
        `[dbRouter][DEBUG] [${req.method} ${req.url}] Connected to database`
      );

      // Return a 200 status code to indicate that the database is running
      res.status(200).send(
        JSON.stringify(
          {
            status: 200,
            data: { message: "Database connection successful" },
          },
          null,
          2
        )
      );
    } catch (error: any) {
      // Catches any errors that occur during the request

      console.error(
        `[dbRouter][ERROR] [${req.method} ${req.url}] error:\n${JSON.stringify(
          error,
          null,
          2
        )}`
      );

      // Return a 503 status code to indicate that the database connection failed
      res.status(503).send(
        JSON.stringify(
          {
            status: 403,
            data: { message: "Database connection failed", error },
          },
          null,
          2
        )
      );
    } finally {
      // Close the database connection after the request is complete
      await dbConnection.close();
    }

    next();
  }
);
