/**
 * Simple email address validator.
 * Validates format only — does not check MX records or domain existence.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
