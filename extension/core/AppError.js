export class AppError extends Error {
  constructor(code, message, detail = null) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.detail = detail;
  }
  static wrap(err, code = "UNKNOWN") {
    if (err instanceof AppError) return err;
    return new AppError(code, err?.message || String(err), { cause: String(err?.stack || "") });
  }
  toJSON() { return { code: this.code, message: this.message, detail: this.detail }; }
}
export const ERR = {
  STORAGE: "STORAGE_FAIL",
  VAULT_LOCKED: "VAULT_LOCKED",
  VAULT_BAD_PASS: "VAULT_BAD_PASS",
  LICENSE: "LICENSE_INVALID",
  LLM: "LLM_FAIL",
  RPA: "RPA_FAIL",
  SELECTOR: "SELECTOR_NOT_FOUND",
  CONNECT: "CONNECT_FAIL",
  PERMISSION: "PERMISSION_DENIED",
  EXPORT: "EXPORT_FAIL",
  VALIDATION: "VALIDATION_FAIL",
};
