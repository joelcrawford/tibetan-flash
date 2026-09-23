// Read/update a language's sessions.ts SESSION_GROUPS literal. Edits are
// surgical text insertions (not a full re-serialization) so untouched groups
// and formatting survive byte-for-byte — sessions.ts is hand-maintained and
// its layout (grouping, comments, trailing commas) is meaningful.

import { readFileSync, writeFileSync } from "node:fs";

const MARKER = /export const SESSION_GROUPS: Record<string, string\[\]> = (\{[\s\S]*?\n\});/;

function parse(path) {
  const text = readFileSync(path, "utf8");
  const m = text.match(MARKER);
  if (!m) throw new Error(`${path}: couldn't find a SESSION_GROUPS literal`);
  // sessions.ts is trusted, locally-authored source — safe to evaluate its
  // object literal directly rather than pulling in a TS parser for this.
  const groups = new Function(`return (${m[1]})`)();
  return { text, groups };
}

export function readSessionGroups(path) {
  return parse(path).groups;
}

export function hasSession(groups, session) {
  return Object.values(groups).some((list) => list.includes(session));
}

// Insert `session` into the named group's array in the sessions.ts at `path`.
// No-ops if the session is already present in any group. Throws if the named
// group doesn't exist or its array block can't be located.
export function addSession(path, groupName, session) {
  const { text, groups } = parse(path);
  if (!(groupName in groups)) {
    throw new Error(`${path}: no group named ${JSON.stringify(groupName)} (have: ${Object.keys(groups).join(", ")})`);
  }
  if (hasSession(groups, session)) return false;

  const esc = groupName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // A still-empty group formatted inline (e.g. `"Group": [],`) must be
  // checked FIRST: `\[\s*\]` only matches when there's truly nothing between
  // the brackets, so it can never misfire on a populated array. This ordering
  // matters — the general blockRe below is unbounded (`[\s\S]*?` up to the
  // next `\n(\s*)\]`), so for a bracket pair with no internal newline it
  // would overshoot past this group entirely and match a LATER group's
  // closing bracket instead, silently inserting into the wrong group.
  const inlineRe = new RegExp(`"${esc}":\\s*\\[\\s*\\]`);
  const im = text.match(inlineRe);
  if (im) {
    const groupIndent = text.slice(0, im.index).match(/\n(\s*)$/)?.[1] ?? "  ";
    const itemIndent = `${groupIndent}  `;
    const replacement = `"${groupName}": [\n${itemIndent}${JSON.stringify(session)},\n${groupIndent}]`;
    const updated = text.slice(0, im.index) + replacement + text.slice(im.index + im[0].length);
    writeFileSync(path, updated);
    return true;
  }

  const blockRe = new RegExp(`("${esc}":\\s*\\[)([\\s\\S]*?)(\\n(\\s*)\\])`);
  const m = text.match(blockRe);
  if (m) {
    const [whole, open, body, closeTail, closeIndent] = m;
    const itemIndentMatch = body.match(/\n(\s*)\S/);
    const itemIndent = itemIndentMatch ? itemIndentMatch[1] : `${closeIndent}  `;
    const newBody = `${body}\n${itemIndent}${JSON.stringify(session)},`;
    const updated = text.slice(0, m.index) + open + newBody + closeTail + text.slice(m.index + whole.length);
    writeFileSync(path, updated);
    return true;
  }

  throw new Error(`${path}: couldn't locate the array for group ${JSON.stringify(groupName)}`);
}
