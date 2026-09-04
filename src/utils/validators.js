// utils/validators.js

export const required = (value) => {
  if (value === null || value === undefined || value === '') return 'This field is required';
  return null;
};

export const phone = (value) => {
  if (!value) return null;
  const clean = value.replace(/\s/g, '');
  if (!/^[+]?[\d]{10,13}$/.test(clean)) return 'Enter a valid phone number';
  return null;
};

export const positiveNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  if (isNaN(value) || Number(value) < 0) return 'Enter a valid positive number';
  return null;
};

export const validateForm = (data, rules) => {
  const errors = {};
  Object.keys(rules).forEach((field) => {
    const validators = rules[field];
    for (const validator of validators) {
      const err = validator(data[field]);
      if (err) {
        errors[field] = err;
        break;
      }
    }
  });
  return errors;
};
