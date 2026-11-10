// Minimal YAML emitter for plain JSON (no dependency). Tailored for rendering an
// OpenShell policy: converts camelCase keys to snake_case and omits proto
// defaults (empty string / [] / {} / false / 0 / null) so the output reads like
// the canonical `openshell policy get --full` YAML rather than a verbose dump.

const snake = (k: string) => k.replace(/([A-Z])/g, "_$1").toLowerCase();

function isEmpty(v: unknown): boolean {
  return (
    v === null || v === undefined || v === "" || v === false || v === 0 ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0)
  );
}

function scalar(v: unknown): string {
  if (typeof v === "string") {
    // Quote if it could be misread as YAML (special chars, leading symbols, etc.)
    if (v === "" || /[:#{}[\],&*?|<>=!%@`"']/.test(v) || /^[\s-]/.test(v) || /^(true|false|null|~|\d)/i.test(v)) {
      return JSON.stringify(v);
    }
    return v;
  }
  return String(v);
}

function emit(value: unknown, indent: number): string[] {
  const pad = "  ".repeat(indent);
  const lines: string[] = [];

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object") {
        const sub = emit(item, indent + 1);
        if (sub.length === 0) continue;
        // hang the first key on the dash
        const first = sub[0].slice((indent + 1) * 2);
        lines.push(`${pad}- ${first}`);
        for (let i = 1; i < sub.length; i++) lines.push(sub[i]);
      } else if (!isEmpty(item)) {
        lines.push(`${pad}- ${scalar(item)}`);
      }
    }
    return lines;
  }

  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (isEmpty(v)) continue;
      const key = snake(k);
      if (Array.isArray(v) || (v && typeof v === "object")) {
        const sub = emit(v, indent + 1);
        if (sub.length === 0) continue;
        lines.push(`${pad}${key}:`);
        lines.push(...sub);
      } else {
        lines.push(`${pad}${key}: ${scalar(v)}`);
      }
    }
    return lines;
  }

  if (!isEmpty(value)) lines.push(`${pad}${scalar(value)}`);
  return lines;
}

export function toYaml(value: unknown): string {
  const out = emit(value, 0).join("\n");
  return out || "# (empty)";
}
