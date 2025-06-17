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
