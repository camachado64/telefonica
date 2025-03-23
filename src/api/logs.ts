import { Router, Response, Request, NextFunction } from "express";

import { logsRepository as repository } from "../config/db";

export const router = Router();

router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.debug(
      `[logsRouter][DEBUG] [${req.method} ${
        req.url
      }] req.headers:\n${JSON.stringify(req.headers, null, 2)}`
    );

    try {
      // Fetch the api logs from the database
      const result = await repository.logs();

      // Send the api logs as a JSON response
      res
        .status(200)
        .send(JSON.stringify({ status: 200, data: { result } }, null, 2));
    } catch (error: any) {
      // Catches any errors that occur during the api logs query

      console.error(
        `[logsRouter][ERROR] [${req.method} ${
          req.url
        }] error:\n${JSON.stringify(error, null, 2)}`
      );

      // Send a 500 error to the client with the error
      res.status(500).send(
        JSON.stringify(
          {
            status: 500,
            data: { error },
          },
          null,
          2
        )
      );
    }

    next();
  }
);

router.post(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.debug(
      `[logsRouter][DEBUG] [${req.method} ${
        req.url
      }] req.headers:\n${JSON.stringify(req.headers, null, 2)}`
    );

    try {
      if (typeof req?.body?.message !== "string") {
        // If the request body does not contain a message field, send a 400 error to the client
        res.status(400).send(
          JSON.stringify(
            {
              status: 400,
              data: { error: "Field 'message' is required" },
            },
            null,
            2
          )
        );
        return;
      }

      // Creates a new api log in the database
      const result = await repository.createLog(req.body.message);

      // Send the api log creation result as a JSON response
      res
        .status(200)
        .send(JSON.stringify({ status: 200, data: { result } }, null, 2));
    } catch (error: any) {
      // Catches any errors that occur during the api log creation query

      console.error(
        `[logsRouter][ERROR] [${req.method} ${
          req.url
        }] error:\n${JSON.stringify(error, null, 2)}`
      );

      // Send a 500 error to the client with the error
      res.status(500).send(
        JSON.stringify(
          {
            status: 500,
            data: { error },
          },
          null,
          2
        )
      );
    }

    next();
  }
);
