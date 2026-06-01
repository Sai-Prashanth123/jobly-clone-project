export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  // Optional structured payload surfaced in the JSON response under `details`.
  // Use it for machine-readable error context the frontend can branch on (e.g.
  // a list of missing required fields).
  public readonly details?: Record<string, unknown>;

  constructor(message: string, statusCode = 500, isOperational = true, details?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, true, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, true, details);
  }
}
