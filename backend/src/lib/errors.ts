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
  // 78 of the ~90 call sites pass a message that already ends in "not found"
  // ("Invoice not found", "Case not found"), so the old unconditional suffix
  // produced "Invoice not found not found" — which is what the API actually
  // returned to users on every one of those 404s. Appending only when it is
  // missing fixes all of them at once and keeps both call styles working, so
  // nobody has to remember which one this class expects.
  // Matched anywhere, not just at the end: several call sites pass a whole
  // sentence ("Document not found on this case"), which an end-anchored check
  // would turn into "...on this case not found".
  constructor(resource = 'Resource') {
    super(/not found/i.test(resource) ? resource : `${resource} not found`, 404);
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
