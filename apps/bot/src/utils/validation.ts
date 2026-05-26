export function isValidName(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 80;
}

export function normalizeFlatNumber(value: string) {
  return value.trim().toUpperCase();
}

export function isValidFlatNumber(value: string) {
  return /^[A-Za-z]-?\d{1,4}[A-Za-z]?$/.test(value.trim());
}

export function normalizeVehicleNumber(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function isValidVehicleNumber(value: string) {
  return /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4}$/.test(value);
}

export function isValidPhone(value: string) {
  return /^[+]?[0-9][0-9\s-]{6,18}$/.test(value.trim());
}
