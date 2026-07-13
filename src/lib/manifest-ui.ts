// Heuristics for picking a UI shape from a manifest's declared input/output
// JSON Schema, since manifests only declare structure — not how a buyer
// should interact with it. "structured" is the safe fallback (raw JSON)
// for anything that doesn't clearly look like a single text or file field.

type JsonSchemaProperty = {
  type?: string;
  format?: string;
  description?: string;
};

type JsonSchemaObject = {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
};

const FILE_NAME_PATTERN =
  /file|url|image|pdf|docx?|attachment|audio|video|blob|photo|base64|content|data\b/i;
const FILE_FORMAT_PATTERN = /^(uri|url|binary|byte)$/i;
// A field whose own name matches this is a label ("file_name",
// "content_type"), never the file's actual bytes — must be checked before
// the broader FILE_NAME_PATTERN above, which "file_name" also matches.
const FILE_LABEL_PATTERN = /name$|type$|extension$|ext$/i;
// Narrower, higher-confidence signal that a field holds actual file
// content rather than just something file-related.
const FILE_CONTENT_PATTERN = /base64|content|data\b|blob|bytes/i;

function looksLikeFile(name: string, prop: JsonSchemaProperty): boolean {
  return (
    FILE_NAME_PATTERN.test(name) ||
    (!!prop.format && FILE_FORMAT_PATTERN.test(prop.format)) ||
    (!!prop.description && FILE_NAME_PATTERN.test(prop.description))
  );
}

export type InputShape =
  | { kind: "text"; fieldName: string }
  | { kind: "file"; fieldName: string }
  | { kind: "structured" };

export function classifyInput(schema: unknown): InputShape {
  const s = schema as JsonSchemaObject;
  const props = s?.properties ? Object.entries(s.properties) : [];
  if (props.length !== 1) return { kind: "structured" };

  const [name, prop] = props[0];
  if (prop?.type !== "string") return { kind: "structured" };

  return looksLikeFile(name, prop)
    ? { kind: "file", fieldName: name }
    : { kind: "text", fieldName: name };
}

export type OutputShape =
  | { kind: "file"; fileField: string; fileNameField?: string }
  | { kind: "text" };

export function classifyOutput(schema: unknown): OutputShape {
  const s = schema as JsonSchemaObject;
  const props = s?.properties ? Object.entries(s.properties) : [];
  const stringProps = props.filter(([, prop]) => prop?.type === "string");

  // A "*_name" field is always a label, never content, even though it
  // often also matches the broader file-ish pattern (e.g. "file_name").
  // Prefer the narrow content pattern first; only fall back to the broad
  // one (excluding label-shaped names) if nothing matched.
  const fileEntry =
    stringProps.find(([name]) => FILE_CONTENT_PATTERN.test(name)) ??
    stringProps.find(
      ([name, prop]) => looksLikeFile(name, prop) && !FILE_LABEL_PATTERN.test(name),
    );
  if (!fileEntry) return { kind: "text" };

  const nameEntry = stringProps.find(
    ([name]) => FILE_LABEL_PATTERN.test(name) && name !== fileEntry[0],
  );

  return {
    kind: "file",
    fileField: fileEntry[0],
    fileNameField: nameEntry?.[0],
  };
}
