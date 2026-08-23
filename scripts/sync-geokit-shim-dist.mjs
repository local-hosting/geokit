#!/usr/bin/env node
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const corePkgPath = join(root, "packages/core/package.json");
const coreDist = join(root, "packages/core/dist");
const shimRoot = join(root, "packages/geokit");
const shimDist = join(shimRoot, "dist");
if (!existsSync(coreDist)) { console.warn("[geokit shim] skip — dist missing"); process.exit(0); }
cpSync(coreDist, shimDist, { recursive: true, force: true });
const corePkg = JSON.parse(readFileSync(corePkgPath, "utf8"));
const shimExports = {};
for (const [key, value] of Object.entries(corePkg.exports ?? {})) {
  if (typeof value === "string") { shimExports[key] = "./" + value.replace(/^.\//, ""); continue; }
  if (!value || typeof value !== "object") continue;
  const e = {};
  if (value.types) e.types = "./" + String(value.types).replace(/^.\//, "");
  if (value.import) e.import = "./" + String(value.import).replace(/^.\//, "");
  if (value.require) e.require = "./" + String(value.require).replace(/^.\//, "");
  if (value.default) e.default = "./" + String(value.default).replace(/^.\//, "");
  shimExports[key] = e;
}
const shimPkgPath = join(shimRoot, "package.json");
const shimPkg = JSON.parse(readFileSync(shimPkgPath, "utf8"));
shimPkg.version = corePkg.version; shimPkg.exports = shimExports;
writeFileSync(shimPkgPath, JSON.stringify(shimPkg, null, 2) + "\n");
console.log("[geokit shim] synced");
