export interface EmailLayoutValidationError {
  code: string;
  message: string;
  line?: number;
  column?: number;
}
