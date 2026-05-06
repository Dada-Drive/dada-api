import { UserRole } from './enums';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        userId: string;
        role: UserRole;
      };
    }
  }
}

export {};
