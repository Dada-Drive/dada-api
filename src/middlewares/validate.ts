import { Request, Response, NextFunction } from 'express';
import { ValidationChain, validationResult } from 'express-validator';

function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map((v) => v.run(req)));

    const result = validationResult(req);
    if (result.isEmpty()) {
      next();
      return;
    }

    const details = result.array().map((e) => ({
      field: e.type === 'field' ? e.path : e.type,
      message: e.msg as string,
    }));

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details,
      },
    });
  };
}

export { validate };
