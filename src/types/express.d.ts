declare namespace Express {
  interface Request {
    requestId: string;
    user?: {
      userId: string;
      role: string;
    };
  }
}
