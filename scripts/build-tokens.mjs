// Converts the Odevo W3C design tokens (design/tokens.json) into CSS custom
// properties at app/tokens.css. Run: node scripts/build-tokens.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, "design", "tokens.json"), "utf8"));

const varName = (segs) => "--" + segs.join("-");
const aliasToVar = (s) => s.replace(/\{([^}]+)\}/g, (_, ref) => `var(--${ref.split(".").join("-")})`);

const quoteFamily = (arr) => arr.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(", ");

const shadowOne = (o) => `${o.offsetX} ${o.offsetY} ${o.blur} ${o.spread} ${o.color}`.replace(/\s+/g, " ").trim();
const formatShadow = (v) => (Array.isArray(v) ? v.map(shadowOne).join(", ") : shadowOne(v));

function formatValue(v) {
  if (typeof v === "string") return /\{.+\}/.test(v) ? aliasToVar(v) : v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === "object") return formatShadow(v); // shadow list
    return quoteFamily(v); // font family
  }
  if (v && typeof v === "object") return formatShadow(v); // single shadow
  return String(v);
}

const lines = [];
function walk(node, segs) {
  if (node && typeof node === "object" && "$value" in node) {
    lines.push(`  ${varName(segs)}: ${formatValue(node.$value)};`);
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    if (child && typeof child === "object") walk(child, [...segs, key]);
  }
}
walk(tokens, []);

const css = `/* AUTO-GENERATED from design/tokens.json by scripts/build-tokens.mjs. Do not edit by hand. */\n:root {\n${lines.join("\n")}\n}\n`;
fs.writeFileSync(path.join(ROOT, "app", "tokens.css"), css, "utf8");
console.log(`Wrote app/tokens.css with ${lines.length} CSS variables.`);
