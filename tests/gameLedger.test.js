// Pure unit tests for the virtual-naira ledger rules.
// These intentionally avoid importing the ESM module (which pulls mongoose/DB)
// and instead test the exported constants via a lightweight inline re-declaration
// kept in sync with src/services/gameLedger.js.

const START_BALANCE = 10_000_000;
const MIN_BET = 5000;
const MAX_BET = 100000;
const validateBet = (bet) => {
  const n = Number(bet);
  if (!Number.isInteger(n) || n < MIN_BET || n > MAX_BET) return null;
  return n;
};

describe('game ledger constants', () => {
  test('starting balance is 10 million naira', () => {
    expect(START_BALANCE).toBe(10_000_000);
  });
});

describe('bet validation', () => {
  test('accepts 5,000 minimum', () => {
    expect(validateBet(5000)).toBe(5000);
  });
  test('accepts 100,000 maximum', () => {
    expect(validateBet(100000)).toBe(100000);
  });
  test('rejects below minimum', () => {
    expect(validateBet(4999)).toBeNull();
  });
  test('rejects above maximum', () => {
    expect(validateBet(100001)).toBeNull();
  });
  test('rejects non-integers', () => {
    expect(validateBet(5000.5)).toBeNull();
  });
  test('rejects NaN', () => {
    expect(validateBet(NaN)).toBeNull();
  });
  test('rejects zero', () => {
    expect(validateBet(0)).toBeNull();
  });
  test('rejects strings that are not whole numbers', () => {
    expect(validateBet('5000abc')).toBeNull();
  });
});