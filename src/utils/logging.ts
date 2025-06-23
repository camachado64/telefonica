import { ILogObj, Logger } from "tslog";

// const customFormat = format.printf((info: any): string => {
//   // Extract file and line from stack trace
//   Error.stackTraceLimit = 15; // Increase stack trace limit if needed
//   const stack = new Error().stack?.split("\n")[12] || "";
//   const locationMatch =
//     stack.match(/\(([^:]+):(\d+):(\d+)\)/) ||
//     stack.match(/at\s+(.+):(\d+):(\d+)/);
//   const location = locationMatch
//     ? `${basename(locationMatch[1])}:${locationMatch[2]}`
//     : "unknown";

//   console.log(info);

//   // Process info
//   const processId = process.pid;
//   const processName = process.title || "NodeProcess";

//   // Color codes using ANSI escape sequences
//   const colors = {
//     bold_black: "\x1b[1;30m",
//     thin_yellow: "\x1b[33m",
//     reset: "\x1b[0m",
//     log_color: {
//       ERROR: "\x1b[31m", // Red
//       WARN: "\x1b[33m", // Yellow
//       INFO: "\x1b[32m", // Green
//       DEBUG: "\x1b[36m", // Cyan
//     },
//   };

//   // Build the log format
//   return (
//     `${colors.bold_black}[${info.metadata.timestamp}]${colors.reset} ` +
//     `${colors.bold_black}[${processId}:${processName}]${colors.reset} ` +
//     `[${colors.thin_yellow}${location.padStart(45)}${colors.reset}] ` +
//     `[${colors.log_color[info.level.toUpperCase()] || ""}${info.level
//       .toUpperCase()
//       .padStart(8)}${colors.reset}] ` +
//     `${info.message}`
//   );
// });

// // Custom format to replicate the specified log format
// // Create logger instance
// const logger = createLogger({
//   level: process.env.LOG_LEVEL || "debug",
//   format: format.combine(
//     format.timestamp({ format: "YYYY-MM-DD hh:mm:ss.SSS" }),
//     // format.splat(),
//     format.errors({ stack: true }), // Include stack trace for errors
//     format.metadata(), // Store additional fields in metadata
//     // format.align(),
//     customFormat
//   ),
//   transports: [
//     new transports.Console(), // Log to console
//     // Add more transports (e.g., File) as needed
//   ],
// });

const logger: Logger<ILogObj> = new Logger({
  type: "pretty",
  name: "RootLogger",
});

// logger.debug(
//   "Logger initialized with custom format and transports",
//   42,
//   "Helloworld",
//   true,
//   [1, 2, 3],
//   { key: "value" }
// );
// logger.error(new Error("This is a test error"));

export function logError(
  error: any,
  className: string = "",
  functionName: string = ""
): void {
  // Catches any errors that occur during the command handling process and logs them
  if (error instanceof Error) {
    // If the error is an instance of 'Error', log the error message
    console.error(
      `[${className}][ERROR] ${functionName} error: ${error.message}`
    );
  } else if (typeof error === "object") {
    // If the error is an 'object', log the error as JSON
    console.error(
      `[${className}][ERROR] ${functionName} error: ${JSON.stringify(
        error,
        null,
        2
      )}`
    );
  } else {
    // If the error is neither an instance of 'Error' nor an 'object', log it as a string
    console.error(`[${className}][ERROR] ${functionName} error: ${error}`);
  }
}
