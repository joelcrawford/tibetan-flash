// Tests for scripts/lib/resolve-language.mjs (issue #15). Exercises the
// module.ts-scan branch directly — the one actually used against the real
// shared/languages/ tree, where directory names don't match language codes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveLanguageDir } from "./lib/resolve-language.mjs";

function makeModule(root, dirName, code) {
  mkdirSync(join(root, dirName), { recursive: true });
  writeFileSync(join(root, dirName, "module.ts"), `export const x = {\n  code: "${code}",\n};\n`);
}

test("resolves a code to a differently-named directory via module.ts", () => {
  const root = mkdtempSync(join(tmpdir(), "resolve-language-"));
  try {
    makeModule(root, "japanese", "ja");
    makeModule(root, "tibetan", "bo");
    assert.equal(resolveLanguageDir(root, "ja"), "japanese");
    assert.equal(resolveLanguageDir(root, "bo"), "tibetan");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("trusts a directory named after the code only when it has no module.ts (fixture convenience)", () => {
  const root = mkdtempSync(join(tmpdir(), "resolve-language-"));
  try {
    mkdirSync(join(root, "ja"), { recursive: true });
    assert.equal(resolveLanguageDir(root, "ja"), "ja");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a directory named after the code with a conflicting module.ts is not trusted — falls through to the real match", () => {
  const root = mkdtempSync(join(tmpdir(), "resolve-language-"));
  try {
    // pathological: a dir literally named "ja" whose own module.ts claims a
    // different code, while the true "ja" module lives elsewhere
    makeModule(root, "ja", "xx");
    makeModule(root, "japanese", "ja");
    assert.equal(resolveLanguageDir(root, "ja"), "japanese");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("throws a clear error for an unknown code", () => {
  const root = mkdtempSync(join(tmpdir(), "resolve-language-"));
  try {
    makeModule(root, "japanese", "ja");
    assert.throws(() => resolveLanguageDir(root, "zz"), /no language module/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolves against the real repo's shared/languages directory", () => {
  const realRoot = join(import.meta.dirname, "..", "shared", "languages");
  assert.equal(resolveLanguageDir(realRoot, "ja"), "japanese");
  assert.equal(resolveLanguageDir(realRoot, "bo"), "tibetan");
});
