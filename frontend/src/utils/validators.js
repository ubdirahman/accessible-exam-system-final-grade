/**
 * Validation utilities for form inputs across the application.
 */

// Text only: letters and spaces (Latin + Somali/Arabic)
export const textOnly = (val) => (val ? String(val).replace(/[^a-zA-Z\s\u0600-\u06FF]/g, '') : '');
export const isTextOnly = (val) => Boolean(val && /^[a-zA-Z\s\u0600-\u06FF]+$/.test(String(val).trim()));

// Number only: digits only (no spaces, letters or symbols)
export const numberOnly = (val) => (val ? String(val).replace(/[^0-9]/g, '') : '');
export const isNumberOnly = (val) => Boolean(val && /^[0-9]+$/.test(String(val).trim()));

// Text and Number only: alphanumeric only (no spaces or special chars)
export const textAndNumberOnly = (val) => (val ? String(val).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '');
export const isTextAndNumberOnly = (val) => Boolean(val && /^[a-zA-Z0-9]+$/.test(String(val).trim()));

// Starts with text: first character must be a letter
export const startsWithText = (val) => Boolean(val && /^[a-zA-Z\u0600-\u06FF]/.test(String(val).trim()));

// Custom Email: first 3 characters must be text (letters), and local part before '@' allows only text and numbers
export const isValidCustomEmail = (val) => {
    if (!val || typeof val !== 'string') return false;
    const customEmailRegex = /^[a-zA-Z]{3}[a-zA-Z0-9]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return customEmailRegex.test(val.trim());
};
