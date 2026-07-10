// A small hierarchy of domain errors. Each carries the HTTP status and a stable
// machine-readable code, so the HTTP layer can translate any thrown AppError
// into a response without knowing the specifics (Open/Closed: add a subclass,
// no change to the handler).

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class AuthError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests — please slow down") {
    super(message, 429, "RATE_LIMITED");
  }
}

export class UpstreamError extends AppError {
  constructor(message = "An upstream service is unavailable") {
    super(message, 502, "UPSTREAM_ERROR");
  }
}
