/**
 * src/services/AuthError.js
 *
 * Structured error class for authentication failures.
 *
 * `field` indicates WHERE in the form the error should surface:
 *   "email"       → highlight email input
 *   "credentials" → highlight password input (ambiguous by design — don't leak which field is wrong)
 *   "account"     → general banner (account disabled, not activated)
 *   "network"     → general banner (connectivity issue)
 *   "server"      → general banner (5xx, unexpected)
 *   "rate_limit"  → general banner (429)
 */
export class AuthError extends Error {
  constructor(message, field = "server") {
    super(message);
    this.name = "AuthError";
    this.field = field;
  }
}
