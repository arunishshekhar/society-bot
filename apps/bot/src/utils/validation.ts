export function isValidName(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 80;
}

export function normalizeFlatNumber(value: string) {
  return value.trim().toUpperCase();
}

export function isValidFlatNumber(value: string) {
  return /^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)+$/.test(value.trim());
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
