export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code)
    this.name = this.constructor.name
  }
}

export class BadRequestError extends AppError {
  constructor(code = 'bad_request', msg?: string) {
    super(400, code, msg)
  }
}

export class UnauthorizedError extends AppError {
  constructor(code = 'unauthorized', msg?: string) {
    super(401, code, msg)
  }
}

export class ForbiddenError extends AppError {
  constructor(code = 'forbidden', msg?: string) {
    super(403, code, msg)
  }
}

export class NotFoundError extends AppError {
  constructor(code = 'not_found', msg?: string) {
    super(404, code, msg)
  }
}

export class ConflictError extends AppError {
  constructor(code = 'conflict', msg?: string) {
    super(409, code, msg)
  }
}

export class TooManyRequestsError extends AppError {
  constructor(code = 'too_many_requests', msg?: string) {
    super(429, code, msg)
  }
}
