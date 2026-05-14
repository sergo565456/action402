export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorBody(error) {
  return {
    error: {
      code: error.code || "internal_error",
      message: error.message || "internal server error",
      ...(error.details === undefined ? {} : { details: error.details })
    }
  };
}
