import Decimal from 'decimal.js-light';

// Shared policy for new Decimal calculations; legacy calculators migrate separately.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export { Decimal };
