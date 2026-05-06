import { ValidationChain, body, param, query } from 'express-validator';

// ── UUID ──────────────────────────────────────────────────────────────────────

function uuidParam(field = 'id'): ValidationChain {
  return param(field).isUUID(4).withMessage('Must be a valid UUID');
}

// ── Phone ─────────────────────────────────────────────────────────────────────

function phoneField(field = 'phone'): ValidationChain {
  return body(field).isMobilePhone('any').withMessage('Invalid phone number');
}

// ── Coordinates ───────────────────────────────────────────────────────────────

function coordinateFields(latField: string, lngField: string): ValidationChain[] {
  return [
    body(latField)
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),
    body(lngField)
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180'),
  ];
}

// ── Pagination ────────────────────────────────────────────────────────────────

function paginationParams(): ValidationChain[] {
  return [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .toInt()
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt()
      .withMessage('Limit must be between 1 and 100'),
  ];
}

// ── Enum ──────────────────────────────────────────────────────────────────────

function enumField(field: string, enumObj: Record<string, string>): ValidationChain {
  const allowed = Object.values(enumObj);
  return body(field)
    .isIn(allowed)
    .withMessage(`Must be one of: ${allowed.join(', ')}`);
}

// ── Text ──────────────────────────────────────────────────────────────────────

function textField(field: string, maxLength = 500): ValidationChain {
  return body(field)
    .isString()
    .isLength({ max: maxLength })
    .withMessage(`Must be at most ${String(maxLength)} characters`)
    .trim();
}

// ── Amount ────────────────────────────────────────────────────────────────────

function amountField(field: string): ValidationChain {
  return body(field)
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number')
    .custom((value: number) => {
      const parts = String(value).split('.');
      if (parts[1] && parts[1].length > 2) {
        throw new Error('Amount must have at most 2 decimal places');
      }
      return true;
    });
}

export {
  amountField,
  coordinateFields,
  enumField,
  paginationParams,
  phoneField,
  textField,
  uuidParam,
};
