export class SessionHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SessionHttpError";
    this.status = status;
  }
}

export function isSessionHttpError(error: unknown, status?: number): error is SessionHttpError {
  if (!(error instanceof SessionHttpError)) {
    return false;
  }

  if (status === undefined) {
    return true;
  }

  return error.status === status;
}
