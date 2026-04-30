/**
 * Maps ABI types to input kinds and validation rules.
 * Unknown/custom types default to text input.
 */

export type InputKind = "text" | "number" | "checkbox" | "date" | "asset" | "bytes";

export interface ValidationRules {
  required?: boolean;
  pattern?: RegExp;
  min?: number;
  max?: number;
  message?: string;
}

const NUMBER_TYPES = new Set([
  "int8",
  "int16",
  "int32",
  "uint8",
  "uint16",
  "uint32",
  "fixed8",
  "fixed16",
  "fixed32",
  "byte",
  "float",
  "double",
]);

const INT64_LIKE = new Set(["int64", "uint64", "fixed64"]);

const TEXT_TYPES = new Set(["string", "image", "ipfs", "name"]);

/** Asset format: amount (e.g. 12.1234) + space + symbol (e.g. TLM) */
const ASSET_PATTERN = /^\d+(\.\d{1,4})?\s+[A-Za-z0-9]{1,14}$/;

/**
 * Normalize ABI type: strip [] for arrays and optional ?, return base type and isArray.
 */
export function parseAbiType(
  raw: string
): { baseType: string; isArray: boolean } {
  let t = raw.trim();
  const isArray = t.endsWith("[]");
  if (isArray) t = t.slice(0, -2);
  if (t.endsWith("?")) t = t.slice(0, -1);
  return { baseType: t, isArray };
}

/**
 * Get input kind for an ABI type (base type, not including []).
 */
export function getInputKind(abiType: string): InputKind {
  const base = abiType.trim();
  if (NUMBER_TYPES.has(base) || INT64_LIKE.has(base)) return "number";
  if (TEXT_TYPES.has(base) || base === "name") return "text";
  if (base === "asset") return "asset";
  if (base === "bool") return "checkbox";
  if (base === "time_point_sec") return "date";
  if (base === "bytes") return "bytes";
  return "text";
}

/**
 * Get validation rules for an ABI type (base type).
 */
export function getValidation(
  abiType: string
): ValidationRules {
  const base = abiType.trim();
  const rules: ValidationRules = { required: true };

  if (base === "asset") {
    rules.pattern = ASSET_PATTERN;
    rules.message = "Format: amount + space + symbol (e.g. 12.1234 TLM)";
    return rules;
  }

  if (NUMBER_TYPES.has(base)) {
    if (base.startsWith("int")) {
      const bits = parseInt(base.replace("int", ""), 10);
      const max = 2 ** (bits - 1) - 1;
      const min = -(2 ** (bits - 1));
      rules.min = min;
      rules.max = max;
    } else if (base.startsWith("uint")) {
      const bits = parseInt(base.replace("uint", ""), 10);
      rules.min = 0;
      rules.max = 2 ** bits - 1;
    }
    return rules;
  }

  if (INT64_LIKE.has(base)) {
    rules.pattern = /^-?\d+$/;
    rules.message = "Enter a valid 64-bit integer";
    return rules;
  }

  if (base === "time_point_sec") {
    rules.pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
    rules.message = "Use UTC ISO format: YYYY-MM-DDTHH:mm:ssZ";
    return rules;
  }

  if (base === "name") {
    rules.pattern = /^[a-z1-5.]{1,12}$/;
    rules.message = "EOSIO name: 1-12 chars, a-z, 1-5, and .";
    return rules;
  }

  return rules;
}

/**
 * Validate a value against the given ABI type rules.
 * Returns error message or null if valid.
 */
export function validateField(
  value: unknown,
  abiType: string,
  rules?: ValidationRules | null
): string | null {
  const r = rules ?? getValidation(abiType);
  const str = value == null ? "" : String(value).trim();

  if (r.required && str === "") return "Required";

  if (str === "" && !r.required) return null;

  if (r.pattern && !r.pattern.test(str)) return r.message ?? "Invalid format";

  if (r.min != null || r.max != null) {
    const num = Number(str);
    if (Number.isNaN(num)) return "Must be a number";
    if (r.min != null && num < r.min) return `Min ${r.min}`;
    if (r.max != null && num > r.max) return `Max ${r.max}`;
  }

  return null;
}
