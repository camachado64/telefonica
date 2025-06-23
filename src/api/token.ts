import { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";

import { config } from "../config/config";
import { compareSync, hashSync } from "bcryptjs";

export const router = Router();

// Define the token endpoint
router.post("/", async (req: Request, res: Response): Promise<void> => {
  console.debug(
    `[tokenRouter] [${req.method} ${req.url}] [DEBUG] req.headers:`,
    req.headers
  );

  // Check if the request body is empty
  if (!req.body) {
    // If the request body is empty, log a warning and return 400
    console.warn(
      `[tokenRouter] [${req.method} ${req.url}] [WARN] Request body is empty`
    );
    res.status(400).send({
      status: 400,
      data: { message: "Request body cannot be empty" },
    });
    return;
  }

  // Check if the request body is a valid JSON object
  if (typeof req.body !== "object" || Object.keys(req.body).length === 0) {
    // If the request body is not a valid JSON object, log a warning and return 400
    console.warn(
      `[tokenRouter] [${req.method} ${req.url}] [WARN] Request body is not a valid JSON object`
    );
    res.status(400).send({
      status: 400,
      data: { message: "Request body must be a valid JSON object" },
    });
    return;
  }

  // Check if the request body contains a valid username and password fields
  if (
    !req.body.hasOwnProperty("username") ||
    !req.body.hasOwnProperty("password") ||
    !req.body.username ||
    !req.body.password ||
    typeof req.body.username !== "string" ||
    typeof req.body.password !== "string"
  ) {
    // If username or password is not provided, log a warning and return 400
    console.warn(
      `[tokenRouter] [${req.method} ${req.url}] [WARN] Missing username or password in request body`
    );
    res.status(400).send({
      status: 400,
      data: { message: "Username and password are required" },
    });
    return;
  }

  // Retrieve the username and password from the request body
  const { username, password } = req.body;
  if (
    !username ||
    !password ||
    typeof username !== "string" ||
    typeof password !== "string"
  ) {
    // If username or password is not provided, log a warning and return 400
    console.warn(
      `[tokenRouter] [${req.method} ${req.url}] [WARN] Missing username or password in request body`
    );
    res.status(400).send({
      status: 400,
      data: { message: "Username and password are required" },
    });
    return;
  }

  // Log the received username and password (for debugging purposes, avoid logging sensitive information in production)
  console.debug(
    `[tokenRouter] [${req.method} ${req.url}] [DEBUG] Received username: ${username}, password: ${password}`
  );

  // Hardcode the expected username and password for demonstration purposes
  const expectedUsername = config.jwt.rootUsername;
  const expectedPassword = config.jwt.rootPassword;

  // Hash the expected password for comparison since the password would typically be stored hashed in a database
  const expectedPasswordHash = hashSync(expectedPassword);

  console.debug(
    `[tokenRouter] [${req.method} ${req.url}] [DEBUG] Expected username: ${expectedUsername}, expected password hash: ${expectedPasswordHash}`
  );

  // Check if the provided username and password match the expected values
  if (
    username === expectedUsername &&
    compareSync(password, expectedPasswordHash)
  ) {
    // If the credentials are valid, generate a token
    const token = jwt.sign({ username: expectedUsername }, config.jwt.secret, {
      expiresIn: "1h", // Token expiration time
    });
    console.debug(
      `[tokenRouter] [${req.method} ${req.url}] [DEBUG] Token generated successfully`
    );

    // Send the token in the response
    res.status(200).send({
      status: 200,
      data: { token },
    });
  } else {
    // If the credentials are invalid, log a warning and return 401
    console.warn(
      `[tokenRouter] [${req.method} ${req.url}] [WARN] Invalid username or password`
    );
    res.status(401).send({
      status: 401,
      data: { message: "Invalid username or password" },
    });
  }
});
