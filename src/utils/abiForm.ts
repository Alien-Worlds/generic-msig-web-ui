/**
 * ABI form helpers: get action parameter fields from contract ABI.
 */

export interface ActionField {
  name: string;
  type: string;
  isArray: boolean;
}

interface AbiAction {
  name?: unknown;
  type?: string;
}

interface AbiField {
  name?: string;
  type?: string;
}

interface AbiStruct {
  name?: string;
  base?: string;
  fields?: AbiField[];
}

interface AbiTypeDef {
  new_type_name?: string;
  type?: string;
}

interface AbiLike {
  actions?: AbiAction[];
  structs?: AbiStruct[];
  types?: AbiTypeDef[];
}

function actionNameToString(a: AbiAction): string {
  const n = a.name;
  if (typeof n === "string") return n;
  if (n != null && typeof (n as { toString?: () => string }).toString === "function")
    return (n as { toString: () => string }).toString();
  return String(n);
}

function resolveTypeAlias(
  typeName: string,
  typeMap: Map<string, string>,
  visited: Set<string>
): string {
  if (visited.has(typeName)) return typeName;
  const resolved = typeMap.get(typeName);
  if (!resolved) return typeName;
  visited.add(typeName);
  return resolveTypeAlias(resolved, typeMap, visited);
}

/**
 * Build type alias map: new_type_name -> resolved type (primitive or another alias).
 */
function buildTypeMap(abi: AbiLike): Map<string, string> {
  const map = new Map<string, string>();
  const types = abi.types;
  if (!Array.isArray(types)) return map;
  for (const t of types) {
    const name = t.new_type_name;
    const target = t.type;
    if (name && target) map.set(name, target);
  }
  return map;
}

/**
 * Resolve a field type through aliases. Returns base type and whether it's an array.
 */
function resolveFieldType(
  rawType: string,
  typeMap: Map<string, string>
): { baseType: string; isArray: boolean } {
  let t = (rawType ?? "").trim();
  const isArray = t.endsWith("[]");
  if (isArray) t = t.slice(0, -2);
  if (t.endsWith("?")) t = t.slice(0, -1);
  const resolved = resolveTypeAlias(t, typeMap, new Set());
  return { baseType: resolved, isArray };
}

/**
 * Get all fields for a struct, including from base struct(s). Returns flattened list.
 */
function getStructFields(
  structName: string,
  abi: AbiLike,
  visited: Set<string>
): AbiField[] {
  if (visited.has(structName)) return [];
  visited.add(structName);
  const structs = abi.structs;
  if (!Array.isArray(structs)) return [];
  const struct = structs.find(
    (s) => (s.name ?? "").toString() === structName
  );
  if (!struct) return [];
  const fields: AbiField[] = [];
  const base = (struct.base ?? "").trim();
  if (base && base !== structName) {
    const baseFields = getStructFields(base, abi, visited);
    fields.push(...baseFields);
  }
  const ownFields = struct.fields ?? [];
  fields.push(...ownFields);
  return fields;
}

/**
 * Get the list of parameter fields for a contract action.
 * Resolves the action's struct and type aliases.
 */
export function getActionFields(
  abi: AbiLike | null | undefined,
  actionName: string
): ActionField[] {
  if (!abi) return [];
  const actions = abi.actions;
  if (!Array.isArray(actions)) return [];

  const action = actions.find(
    (a) => actionNameToString(a).toLowerCase() === actionName.toLowerCase()
  );
  if (!action?.type) return [];

  const structName = (action.type ?? "").trim();
  const typeMap = buildTypeMap(abi);
  const rawFields = getStructFields(structName, abi, new Set());
  if (rawFields.length === 0) return [];

  return rawFields.map((f) => {
    const name = (f.name ?? "").trim() || "field";
    const rawType = (f.type ?? "string").trim();
    const { baseType, isArray } = resolveFieldType(rawType, typeMap);
    return { name, type: baseType, isArray };
  });
}
