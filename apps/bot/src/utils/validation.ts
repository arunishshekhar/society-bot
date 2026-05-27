export function isValidName(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 80;
}

export function normalizeFlatNumber(value: string) {
  return value.trim();
}

export function isValidFlatNumber(value: string) {
  return /^[0-9]{1,2}-[0-9]{1,2}-[0-9]{1,2}$/.test(value.trim());
}

export function normalizeVehicleNumber(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function isValidVehicleNumber(value: string) {
  return value.trim().length >= 2 && value.trim().length <= 20;
}

export function isValidPhone(value: string) {
  return /^[+]?[0-9][0-9\s-]{6,18}$/.test(value.trim());
}
