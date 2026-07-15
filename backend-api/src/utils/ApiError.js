export class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
  static badRequest(m, d) { return new ApiError(400, m, d); }
  static unauthorized(m = "Unauthorized") { return new ApiError(401, m); }
  static forbidden(m = "Forbidden") { return new ApiError(403, m); }
  static notFound(m = "Not found") { return new ApiError(404, m); }
  static conflict(m) { return new ApiError(409, m); }
}
