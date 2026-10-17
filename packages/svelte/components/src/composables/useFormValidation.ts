export interface ValidationRules {
  /** Whether the field is required. Considered empty: null, undefined, '', whitespace-only, [], NaN */
  required?: boolean;
  /** Minimum length for strings/arrays, or minimum numeric value */
  min?: number;
  /** Maximum length for strings/arrays, or maximum numeric value */
  max?: number;
  /** Whether to validate the value as an email address */
  email?: boolean;
  /** Regular expression pattern for strings. Sticky (y) and global (g) flags are ignored */
  pattern?: string | RegExp;
  /** Synchronous custom validator. Returns true if valid, false for default error, or a custom error message string */
  custom?: (value: unknown, values?: Record<string, unknown>) => boolean | string;
  /** Field label used in validation messages instead of the field key */
  label?: string;
  /** Custom error message overrides for specific rules */
  messages?: Partial<Record<'required' | 'min' | 'max' | 'email' | 'pattern' | 'custom', string>>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return Number.isNaN(value);
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function toRegExp(pattern: string | RegExp): RegExp {
  // New instance without g/y flags: ensures test() is stateless
  const flags = pattern instanceof RegExp ? pattern.flags.replace(/[gy]/g, '') : '';
  return new RegExp(pattern instanceof RegExp ? pattern.source : pattern, flags);
}

export function validateField(
  name: string,
  value: unknown,
  rules: ValidationRules,
  values?: Record<string, unknown>,
): string | null {
  const label = rules.label ?? name;
  const msg = rules.messages ?? {};

  if (isEmpty(value)) {
    return rules.required ? (msg.required ?? `${label} is required`) : null;
  }

  if (rules.min !== undefined) {
    if (typeof value === 'string' && value.length < rules.min)
      return msg.min ?? `${label} must be at least ${rules.min} characters`;
    if (Array.isArray(value) && value.length < rules.min)
      return msg.min ?? `${label} must have at least ${rules.min} items`;
    if (typeof value === 'number' && value < rules.min)
      return msg.min ?? `${label} must be at least ${rules.min}`;
  }

  if (rules.max !== undefined) {
    if (typeof value === 'string' && value.length > rules.max)
      return msg.max ?? `${label} must be at most ${rules.max} characters`;
    if (Array.isArray(value) && value.length > rules.max)
      return msg.max ?? `${label} must have at most ${rules.max} items`;
    if (typeof value === 'number' && value > rules.max)
      return msg.max ?? `${label} must be at most ${rules.max}`;
  }

  if (rules.email && typeof value === 'string' && !EMAIL_RE.test(value.trim())) {
    return msg.email ?? `${label} must be a valid email address`;
  }

  if (rules.pattern && typeof value === 'string') {
    // Invalid pattern is a configuration error: new RegExp will throw SyntaxError
    if (!toRegExp(rules.pattern).test(value)) {
      return msg.pattern ?? `${label} has an invalid format`;
    }
  }

  if (rules.custom) {
    const result = rules.custom(value, values);
    if (result && typeof (result as unknown as Promise<unknown>).then === 'function') {
      throw new TypeError(`[validateField] "${name}": async custom validators are not supported`);
    }
    if (typeof result === 'string') return result === '' ? null : result;
    if (!result) return msg.custom ?? `${label} is invalid`;
  }

  return null;
}

export function validateForm(
  values: Record<string, unknown>,
  rules: Record<string, ValidationRules>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const [field, rule] of Object.entries(rules)) {
    const error = validateField(field, values[field], rule, values);
    if (error) errors[field] = error;
  }

  return errors;
}