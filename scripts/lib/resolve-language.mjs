// Resolve a language `code` (e.g. "ja", as stored in Card.language/Text.language
// and used in ids) to its directory name under `root` (e.g. "japanese" — the
// shared/languages/ subdirectories are named after the language, not its code;
// see each module's module.ts `code` field). The module.ts scan is authoritative;
// a directory literally named after the code is only trusted directly when it
// has no module.ts to check against (fixture convenience — real language
// modules always have one).

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function codeOf(root, dirName) {
  const modulePath = join(root, dirName, "module.ts");
  if (!existsSync(modulePath)) return undefined;
  return readFileSync(modulePath, "utf8").match(/code:\s*"([^"]+)"/)?.[1];
}

export function resolveLanguageDir(root, code) {
  if (existsSync(join(root, code)) && codeOf(root, code) === undefined) return code;

  const dirs = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  for (const name of dirs) {
    if (codeOf(root, name) === code) return name;
  }
  throw new Error(`no language module under ${root} with code "${code}"`);
}
