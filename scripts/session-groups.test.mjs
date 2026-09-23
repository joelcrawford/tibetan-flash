// Unit tests for scripts/lib/session-groups.mjs (issue #15).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSessionGroups, hasSession, addSession } from "./lib/session-groups.mjs";

function makeFile(content) {
  const dir = mkdtempSync(join(tmpdir(), "session-groups-"));
  const path = join(dir, "sessions.ts");
  writeFileSync(path, content);
  return { dir, path };
}

test("readSessionGroups / hasSession reflect the literal", () => {
  const { dir, path } = makeFile(`export const SESSION_GROUPS: Record<string, string[]> = {
  "Foundations": [
    "00 Alphabet",
  ],
};
`);
  try {
    const groups = readSessionGroups(path);
    assert.deepEqual(groups, { Foundations: ["00 Alphabet"] });
    assert.ok(hasSession(groups, "00 Alphabet"));
    assert.ok(!hasSession(groups, "99 New"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("addSession inserts into a normal multi-line group, preserving other groups", () => {
  const { dir, path } = makeFile(`export const SESSION_GROUPS: Record<string, string[]> = {
  "Foundations": [
    "00 Alphabet",
  ],
  "Vocabulary": [
    "01 Vocab",
  ],
};
`);
  try {
    addSession(path, "Foundations", "99 New");
    const groups = readSessionGroups(path);
    assert.deepEqual(groups.Foundations, ["00 Alphabet", "99 New"]);
    assert.deepEqual(groups.Vocabulary, ["01 Vocab"]); // untouched
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("addSession fills an empty inline group without touching a later group", () => {
  // Regression: an unbounded blockRe would previously overshoot past an
  // empty inline `[]` and insert into whichever group's `]` came next.
  const { dir, path } = makeFile(`export const SESSION_GROUPS: Record<string, string[]> = {
  "Empty Group": [],
  "Other": [
    "x",
  ],
};
`);
  try {
    addSession(path, "Empty Group", "99 New");
    const groups = readSessionGroups(path);
    assert.deepEqual(groups["Empty Group"], ["99 New"]);
    assert.deepEqual(groups.Other, ["x"]); // must be untouched
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("addSession fills an empty inline group that IS the last group", () => {
  const { dir, path } = makeFile(`export const SESSION_GROUPS: Record<string, string[]> = {
  "Other": [
    "x",
  ],
  "Empty Group": [],
};
`);
  try {
    addSession(path, "Empty Group", "99 New");
    const groups = readSessionGroups(path);
    assert.deepEqual(groups["Empty Group"], ["99 New"]);
    assert.deepEqual(groups.Other, ["x"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("addSession is a no-op if the session already exists anywhere", () => {
  const { dir, path } = makeFile(`export const SESSION_GROUPS: Record<string, string[]> = {
  "Foundations": [
    "00 Alphabet",
  ],
};
`);
  try {
    const before = readFileSync(path, "utf8");
    const changed = addSession(path, "Foundations", "00 Alphabet");
    assert.equal(changed, false);
    assert.equal(readFileSync(path, "utf8"), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("addSession throws for an unknown group", () => {
  const { dir, path } = makeFile(`export const SESSION_GROUPS: Record<string, string[]> = {
  "Foundations": [
    "00 Alphabet",
  ],
};
`);
  try {
    assert.throws(() => addSession(path, "Nope", "99 New"), /no group named/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
