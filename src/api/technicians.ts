import { NextFunction, Router, Response, Request } from "express";

import { techRepository as repository } from "../config/db";

export const router = Router();

router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.debug(
      `[techniciansRouter][DEBUG] [${req.method} ${
        req.url
      }] req.headers:\n${JSON.stringify(req.headers, null, 2)}`
    );

    try {
      // Fetch the technicians from the database
      const result = await repository.technicians();

      // Send the technicians as a JSON response
      res.status(200).json({ status: 200, data: { result } });
    } catch (error: any) {
      // Catches any errors that occur during the technicians query

      console.error(
        `[techniciansRouter][ERROR] [${req.method} ${
          req.url
        }] error:\n${JSON.stringify(error, null, 2)}`
      );

      // Send a 500 error to the client with the error
      res.status(500).json({
        status: 500,
        data: { error },
      });
    }

    next();
  }
);

router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.debug(
      `[techniciansRouter][DEBUG] [${req.method} ${
        req.url
      }] req.headers:\n${JSON.stringify(req.headers, null, 2)}`
    );

    try {
      // Parse the id from the request params
      const id = parseInt(req.params?.id);
      if (isNaN(id)) {
        // If the request params does not contain a valid id, send a 400 error to the client
        res.status(400).send(
          JSON.stringify(
            {
              status: 400,
              data: { error: "Request parameter 'id' is required" },
            },
            null,
            2
          )
        );
        return;
      }

      // Fetch the technicians from the database
      const result = await repository.technician(id);

      // Send the technicians as a JSON response
      res.status(200).json({ status: 200, data: { result } });
    } catch (error: any) {
      // Catches any errors that occur during the technicians query

      console.error(
        `[techniciansRouter][ERROR] [${req.method} ${
          req.url
        }] error:\n${JSON.stringify(error, null, 2)}`
      );

      // Send a 500 error to the client with the error
      res.status(500).json({
        status: 500,
        data: { error },
      });
    }

    next();
  }
);

router.post(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.debug(
      `[techniciansRouter][DEBUG] [${req.method} ${
        req.url
      }] req.headers:\n${JSON.stringify(req.headers, null, 2)}`
    );

    try {
      if (typeof req?.body?.email !== "string") {
        // If the request body does not contain a email field, send a 400 error to the client
        res.status(400).send(
          JSON.stringify(
            {
              status: 400,
              data: { error: "Field 'email' is required" },
            },
            null,
            2
          )
        );
        return;
      }

      // Creates a new technician in the database
      const result = await repository.createTechnician(req.body.email);

      // Send the technician creation result as a JSON response
      res
        .status(200)
        .send(JSON.stringify({ status: 200, data: { result } }, null, 2));
    } catch (error: any) {
      // Catches any errors that occur during the technician creation query

      console.error(
        `[techniciansRouter][ERROR] [${req.method} ${
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

router.put(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.debug(
      `[techniciansRouter][DEBUG] [${req.method} ${
        req.url
      }] req.headers:\n${JSON.stringify(req.headers, null, 2)}`
    );

    try {
      // Parse the id from the request params
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        // If the request params does not contain a valid id, send a 400 error to the client
        res.status(400).send(
          JSON.stringify(
            {
              status: 400,
              data: { error: "Request parameter 'id' is required" },
            },
            null,
            2
          )
        );
        return;
      }

      if (typeof req?.body !== "object") {
        // If the request does not contain a body, send a 400 error to the client
        res.status(400).send(
          JSON.stringify(
            {
              status: 400,
              data: { error: "Request body is required" },
            },
            null,
            2
          )
        );
        return;
      }

      // Updates a new technician in the database
      const result = await repository.updateTechnician({
        id: id,
        email: req.body.email,
        activo: req.body.activo,
      });

      // Send the technician update result as a JSON response
      res
        .status(200)
        .send(JSON.stringify({ status: 200, data: { result } }, null, 2));
    } catch (error: any) {
      // Catches any errors that occur during the technician update query

      console.error(
        `[techniciansRouter][ERROR] [${req.method} ${
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

router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.debug(
      `[techniciansRouter][DEBUG] [${req.method} ${
        req.url
      }] req.headers:\n${JSON.stringify(req.headers, null, 2)}`
    );

    try {
      // Parse the id from the request params
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        // If the request params does not contain a valid id, send a 400 error to the client
        res.status(400).send(
          JSON.stringify(
            {
              status: 400,
              data: { error: "Request parameter 'id' is required" },
            },
            null,
            2
          )
        );
        return;
      }

      if (typeof req?.body !== "object") {
        // If the request does not contain a body, send a 400 error to the client
        res.status(400).send(
          JSON.stringify(
            {
              status: 400,
              data: { error: "Request body is required" },
            },
            null,
            2
          )
        );
        return;
      }

      // Deletes a technician in the database
      const result = await repository.deleteTechnician(id ?? -1);

      // Send the technician deletion result as a JSON response
      res
        .status(200)
        .send(JSON.stringify({ status: 200, data: { result } }, null, 2));
    } catch (error: any) {
      // Catches any errors that occur during the technician deletion query

      console.error(
        `[techniciansRouter][ERROR] [${req.method} ${
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
