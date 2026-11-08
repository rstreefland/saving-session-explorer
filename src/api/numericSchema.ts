import { decimal } from '../domain/decimal';
import { z } from 'zod';
z.config({ jitless: true });
// Preserve decimal strings until arithmetic; reject blank, hexadecimal and nonfinite values.
export const numericSchema = z.union([
  z.number().finite(),
  z
    .string()
    .regex(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i)
    .pipe(
      z.string().refine((value) => {
        if (!Number.isFinite(Number(value))) return false;
        try {
          decimal(value);
          return true;
        } catch {
          return false;
        }
      }),
    ),
]);
