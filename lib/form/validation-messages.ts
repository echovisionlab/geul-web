export interface FormValidationMessages {
  required: string;
  invalidUrl: string;
  invalidFormat: string;
  invalidEmail: string;
  invalidPhoneNumber: string;
  stringGt: (threshold: number) => string;
  stringGte: (threshold: number) => string;
  stringLt: (threshold: number) => string;
  stringLte: (threshold: number) => string;
  stringEq: (threshold: number) => string;
  numberGt: (threshold: number) => string;
  numberGte: (threshold: number) => string;
  numberLt: (threshold: number) => string;
  numberLte: (threshold: number) => string;
  numberEq: (threshold: number) => string;
  arrayGt: (threshold: number) => string;
  arrayGte: (threshold: number) => string;
  arrayLt: (threshold: number) => string;
  arrayLte: (threshold: number) => string;
  arrayEq: (threshold: number) => string;
  dateMin: (date: string) => string;
  dateMax: (date: string) => string;
  futureDate: string;
  pastDate: string;
  weekdayOnly: string;
  minAge: (age: number) => string;
  maxAge: (age: number) => string;
}

export const defaultFormValidationMessages: FormValidationMessages = {
  required: 'This field is required',
  invalidUrl: 'Please enter a valid URL',
  invalidFormat: 'Invalid format',
  invalidEmail: 'Please enter a valid email',
  invalidPhoneNumber: 'Invalid phone number',
  stringGt: (threshold) => `Must be more than ${threshold} characters`,
  stringGte: (threshold) => `Minimum ${threshold} characters`,
  stringLt: (threshold) => `Must be less than ${threshold} characters`,
  stringLte: (threshold) => `Maximum ${threshold} characters`,
  stringEq: (threshold) => `Must be exactly ${threshold} characters`,
  numberGt: (threshold) => `Must be greater than ${threshold}`,
  numberGte: (threshold) => `Minimum value is ${threshold}`,
  numberLt: (threshold) => `Must be less than ${threshold}`,
  numberLte: (threshold) => `Maximum value is ${threshold}`,
  numberEq: (threshold) => `Must be exactly ${threshold}`,
  arrayGt: (threshold) => `Select more than ${threshold}`,
  arrayGte: (threshold) => `Select at least ${threshold}`,
  arrayLt: (threshold) => `Select less than ${threshold}`,
  arrayLte: (threshold) => `Select at most ${threshold}`,
  arrayEq: (threshold) => `Select exactly ${threshold}`,
  dateMin: (date) => `Date must be on or after ${date}`,
  dateMax: (date) => `Date must be on or before ${date}`,
  futureDate: 'Date must be in the future',
  pastDate: 'Date must be in the past',
  weekdayOnly: 'Please select a weekday',
  minAge: (age) => `Must be at least ${age} years old`,
  maxAge: (age) => `Must be at most ${age} years old`,
};
