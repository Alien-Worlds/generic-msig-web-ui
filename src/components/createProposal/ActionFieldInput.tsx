import type { ActionField } from "@/utils/abiForm";
import { getInputKind } from "@/utils/abiTypeMapping";
import { inputClassName } from "./createProposalConstants";

export interface ActionFieldInputProps {
  field: ActionField;
  value: unknown;
  error: string;
  onValueChange: (v: unknown) => void;
  onBlur: () => void;
}

export function ActionFieldInput({
  field,
  value,
  error,
  onValueChange,
  onBlur,
}: ActionFieldInputProps) {
  const toUtcIso = (input: string): string => {
    if (!input) return "";
    const normalized = input.trim().replace(/\.\d+Z$/, "Z");
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(normalized)) {
      return normalized;
    }
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return input;
    }
    return parsed.toISOString().replace(/\.\d{3}Z$/, "Z");
  };

  const kind = getInputKind(field.type);
  const label = field.name + (field.isArray ? " (comma-separated)" : "");

  if (kind === "checkbox") {
    const checked = value === true || value === "true" || value === "1";
    return (
      <div>
        <label className="block text-sm font-medium text-white/90 mb-1.5 font-titillium">
          {label}
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onValueChange(e.target.checked)}
            onBlur={onBlur}
            className="w-4 h-4 rounded border-white/20 bg-[#100F10] text-[#D9A555] focus:ring-[#D9A555]"
          />
          <span className="text-sm text-white/80 font-titillium">Yes</span>
        </label>
        {error && (
          <p className="mt-1 text-xs text-red-400 font-titillium">{error}</p>
        )}
      </div>
    );
  }

  if (kind === "date") {
    const str = value != null ? String(value) : "";
    return (
      <div>
        <label className="block text-sm font-medium text-white/90 mb-1.5 font-titillium">
          {label}
        </label>
        <input
          type="text"
          value={str}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="YYYY-MM-DDTHH:mm:ssZ (UTC)"
          onBlur={onBlur}
          className={`${inputClassName} ${error ? "border-red-400" : ""}`}
        />
        <p className="mt-1 text-xs text-white/50 font-titillium">
          Use UTC ISO format (example: 2026-03-27T09:37:34Z)
        </p>
        {error && (
          <p className="mt-1 text-xs text-red-400 font-titillium">{error}</p>
        )}
      </div>
    );
  }

  if (kind === "number") {
    const str = value != null ? String(value) : "";
    return (
      <div>
        <label className="block text-sm font-medium text-white/90 mb-1.5 font-titillium">
          {label}
        </label>
        <input
          type="number"
          value={str}
          onChange={(e) => onValueChange(e.target.value)}
          onBlur={onBlur}
          placeholder={field.type}
          className={`${inputClassName} ${error ? "border-red-400" : ""}`}
        />
        {error && (
          <p className="mt-1 text-xs text-red-400 font-titillium">{error}</p>
        )}
      </div>
    );
  }

  const str = value != null ? String(value) : "";
  const shouldForceUtcIso = kind === "text" && /time|date|timestamp/i.test(field.name);
  const normalized = shouldForceUtcIso ? toUtcIso(str) : str;
  return (
    <div>
      <label className="block text-sm font-medium text-white/90 mb-1.5 font-titillium">
        {label}
      </label>
      <input
        type="text"
        value={normalized}
        onChange={(e) => onValueChange(e.target.value)}
        onBlur={onBlur}
        placeholder={
          field.isArray
            ? "e.g. a, b, c"
            : field.type === "asset"
            ? "e.g. 12.1234 TLM"
            : shouldForceUtcIso
            ? "YYYY-MM-DDTHH:mm:ssZ (UTC)"
            : field.type
        }
        className={`${inputClassName} ${error ? "border-red-400" : ""}`}
      />
      {error && (
        <p className="mt-1 text-xs text-red-400 font-titillium">{error}</p>
      )}
    </div>
  );
}
