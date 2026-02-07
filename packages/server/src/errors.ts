export type ApiErrorShape = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function apiError(code: string, message: string, details?: unknown): ApiErrorShape {
  return {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };
}
