import {
  isValidFlatNumber,
  isValidName,
  isValidPhone,
  isValidVehicleNumber,
  normalizeFlatNumber,
  normalizeVehicleNumber,
} from './validation';

describe('validation utilities', () => {
  it('validates names within the onboarding limits', () => {
    expect(isValidName('Arunish Kumar')).toBe(true);
    expect(isValidName('A')).toBe(false);
  });

  it('normalizes and validates flat numbers', () => {
    expect(normalizeFlatNumber('a-101')).toBe('A-101');
    expect(isValidFlatNumber('A-101')).toBe(true);
    expect(isValidFlatNumber('Tower A')).toBe(false);
  });

  it('normalizes and validates vehicle numbers', () => {
    expect(normalizeVehicleNumber('ka 01 ab 1234')).toBe('KA01AB1234');
    expect(isValidVehicleNumber('KA01AB1234')).toBe(true);
    expect(isValidVehicleNumber('1234')).toBe(false);
  });

  it('validates simple phone formats', () => {
    expect(isValidPhone('+91 9876543210')).toBe(true);
    expect(isValidPhone('abc')).toBe(false);
  });
});
