export function isValidName(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 80;
}

export function normalizeFlatNumber(value: string) {
  return value.trim().toUpperCase();
}

export function isValidFlatNumber(value: string) {
  // Exactly 3 hyphen-separated alphanumeric segments: Tower-Floor-Unit
  // e.g. 03-12-03, A-12-03, B2-11-04
  return /^[a-zA-Z0-9]{1,6}-[a-zA-Z0-9]{1,4}-[a-zA-Z0-9]{1,4}$/.test(value.trim());
}

export function normalizeVehicleNumber(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function isValidVehicleNumber(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 6 && trimmed.length <= 15 && /[a-zA-Z]/.test(trimmed);
}

export function isValidPhone(value: string) {
  return /^[+]?[0-9][0-9\s-]{6,18}$/.test(value.trim());
}
