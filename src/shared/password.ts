const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "11111111",
  "00000000",
  "password",
  "password1",
  "password123",
  "qwerty",
  "qwerty123",
  "qwerty1234",
  "qwertyuiop",
  "abc12345",
  "abcd1234",
  "letmein1",
  "letmein123",
  "iloveyou",
  "iloveyou1",
  "admin123",
  "welcome1",
  "welcome123",
  "1q2w3e4r",
  "1q2w3e4r5t",
  "sunshine1",
  "monkey123",
  "football1",
  "baseball1",
  "dragon123",
  "master123",
  "trustno1",
  "starwars1"
]);

export interface PasswordRuleResult {
  id: "length" | "letter" | "digit" | "variety" | "common";
  label: string;
  passed: boolean;
}

export function evaluatePassword(password: string): PasswordRuleResult[] {
  const lower = password.toLowerCase();
  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return [
    { id: "length", label: "At least 8 characters", passed: password.length >= 8 },
    { id: "letter", label: "Includes a letter", passed: hasLetter },
    { id: "digit", label: "Includes a number", passed: hasDigit },
    {
      id: "variety",
      label: "Mixed case or a symbol",
      passed: (/[A-Z]/.test(password) && /[a-z]/.test(password)) || hasSymbol
    },
    {
      id: "common",
      label: "Not a commonly used password",
      passed: password.length > 0 && !COMMON_PASSWORDS.has(lower)
    }
  ];
}

export function passwordIssues(password: string): string[] {
  return evaluatePassword(password)
    .filter((rule) => !rule.passed)
    .map((rule) => rule.label);
}

export function isPasswordStrong(password: string): boolean {
  return evaluatePassword(password).every((rule) => rule.passed);
}
