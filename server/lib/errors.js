export class AppError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = options.code || 'APP_ERROR';
    this.details = options.details;
  }
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function zodError(error) {
  return new AppError(400, '参数校验失败', {
    code: 'VALIDATION_ERROR',
    details: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

export function parseOrThrow(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw zodError(result.error);
  return result.data;
}
