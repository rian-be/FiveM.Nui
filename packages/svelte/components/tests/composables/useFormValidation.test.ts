import { describe, it, expect } from 'vitest';
import { validateField, validateForm } from '../../src/composables/useFormValidation';

describe('useFormValidation - validateField & validateForm', () => {
  describe('validateField', () => {
    it('validates required fields', () => {
      expect(validateField('username', '', { required: true })).toBe('username is required');
      expect(validateField('username', '   ', { required: true })).toBe('username is required');
      expect(validateField('username', null, { required: true })).toBe('username is required');
      expect(validateField('username', undefined, { required: true })).toBe('username is required');
      expect(validateField('items', [], { required: true })).toBe('items is required');
      expect(validateField('num', NaN, { required: true })).toBe('num is required');

      // Valid required
      expect(validateField('username', 'valid', { required: true })).toBeNull();
      expect(validateField('flag', false, { required: true })).toBeNull();
      expect(validateField('zero', 0, { required: true })).toBeNull();
    });

    it('uses custom label and messages for required error', () => {
      const err = validateField('email', '', {
        required: true,
        label: 'Adres e-mail',
        messages: { required: 'Pole jest wymagane' }
      });
      expect(err).toBe('Pole jest wymagane');
    });

    it('validates min rule on string, array, and number', () => {
      // String
      expect(validateField('pass', 'abc', { min: 5 })).toBe('pass must be at least 5 characters');
      expect(validateField('pass', 'abcdef', { min: 5 })).toBeNull();

      // Array
      expect(validateField('tags', ['a'], { min: 2 })).toBe('tags must have at least 2 items');
      expect(validateField('tags', ['a', 'b'], { min: 2 })).toBeNull();

      // Number
      expect(validateField('age', 15, { min: 18 })).toBe('age must be at least 18');
      expect(validateField('age', 21, { min: 18 })).toBeNull();
    });

    it('validates max rule on string, array, and number', () => {
      // String
      expect(validateField('name', 'too long name here', { max: 5 })).toBe('name must be at most 5 characters');
      expect(validateField('name', 'ok', { max: 5 })).toBeNull();

      // Array
      expect(validateField('tags', [1, 2, 3], { max: 2 })).toBe('tags must have at most 2 items');
      expect(validateField('tags', [1, 2], { max: 2 })).toBeNull();

      // Number
      expect(validateField('rating', 11, { max: 10 })).toBe('rating must be at most 10');
      expect(validateField('rating', 9, { max: 10 })).toBeNull();
    });

    it('validates email format', () => {
      expect(validateField('email', 'not-an-email', { email: true })).toBe('email must be a valid email address');
      expect(validateField('email', 'user@domain.com', { email: true })).toBeNull();
      expect(validateField('email', '  user@domain.com  ', { email: true })).toBeNull();
    });

    it('validates pattern regex string and RegExp instance', () => {
      expect(validateField('code', 'abc', { pattern: '^[0-9]+$' })).toBe('code has an invalid format');
      expect(validateField('code', '12345', { pattern: '^[0-9]+$' })).toBeNull();

      expect(validateField('code', 'XYZ', { pattern: /^[a-z]+$/i })).toBeNull();
    });

    it('validates custom validator returning boolean or string', () => {
      const customRule = {
        custom: (val: unknown) => (val === 'secret' ? true : 'Incorrect secret code')
      };

      expect(validateField('code', 'wrong', customRule)).toBe('Incorrect secret code');
      expect(validateField('code', 'secret', customRule)).toBeNull();

      const boolRule = {
        custom: (val: unknown) => val === 'allowed'
      };
      expect(validateField('gate', 'denied', boolRule)).toBe('gate is invalid');
      expect(validateField('gate', 'allowed', boolRule)).toBeNull();
    });

    it('throws TypeError if custom validator returns a Promise', () => {
      const asyncRule = {
        custom: () => Promise.resolve(true) as any
      };

      expect(() => validateField('asyncField', 'val', asyncRule)).toThrow(TypeError);
    });
  });

  describe('validateForm', () => {
    it('validates entire form object against rules dictionary', () => {
      const values = {
        username: 'admin',
        email: 'invalid-email',
        age: 12
      };

      const rules = {
        username: { required: true, min: 3 },
        email: { required: true, email: true },
        age: { required: true, min: 18 }
      };

      const errors = validateForm(values, rules);
      expect(errors.username).toBeUndefined();
      expect(errors.email).toBe('email must be a valid email address');
      expect(errors.age).toBe('age must be at least 18');
    });

    it('returns empty object when all fields are valid', () => {
      const values = {
        username: 'superadmin',
        email: 'test@example.com'
      };

      const rules = {
        username: { required: true, min: 3 },
        email: { required: true, email: true }
      };

      const errors = validateForm(values, rules);
      expect(Object.keys(errors).length).toBe(0);
    });
  });
});
