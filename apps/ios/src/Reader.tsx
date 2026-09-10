import { useState, useRef, useEffect, useMemo, ReactNode } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DictEntry, Language, Text as LangText } from "../../../shared/types/types";
import {
  roman, pageLabelMap, displayLines, isHardBreak,
  flatten, hasSegmentation, lineOffsets, entriesAt, entryFor,
} from "../../../shared/reader";
import { READER_PREFS_KEY, parseTextPrefs } from "../../../shared/hooks/settings";

type Colors = {
  bg: string; card: string; border: string; ink: string; inkMid: string;
  muted: string; faint: string; accent: string; raised?: string; lapis?: string;
};

const MIN_PX = 24, MAX_PX = 52;
const BM_KEY = "tibetan-flash-bookmarks";

function FolioChip({ label, c }: { label: string; c: Colors }) {
  // Full-width wrapper so the folio marker takes its own centered line in the
  // flex-wrap clause row, even when the page turn falls mid-clause.
  return (
    <View style={fc.chipRow}>
      <View style={[fc.chip, { borderColor: c.accent }]}>
        <Text style={[fc.chipText, { color: c.accent }]}>❁ {label}</Text>
      </View>
    </View>
  );
}

export function Reader({ text, lang, scheme, c }: { text: LangText; lang: Language; scheme: string; c: Colors }) {
  const [sound, setSound] = useState(false);
  const [layout, setLayout] = useState<"under" | "line">("under");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [fontPx, setFontPx] = useState(33);
  const [bookmark, setBookmark] = useState<number | null>(null);
  const [words, setWords] = useState(false);
  // peek: `a` = tapped anchor word, `s` = selected span (row taps move it)
  const [peek, setPeek] = useState<{ a: [number, number]; s: [number, number] } | null>(null);
  const romPx = Math.max(9, Math.round(fontPx * 0.36));
  const lapis = c.lapis ?? "#2f5e96";

  // Per-token wash model. Nesting shows through COMPOUNDED transparency: each
  // covering box (matched word + every phrase level) adds one 15% lapis layer,
  // precomputed here as a flat depth per syllable — pixel-identical to stacked
  // translucent boxes, and it survives flex-wrap (nested Views would not).
  const seg = useMemo(() => {
    if (!hasSegmentation(text)) return null;
    const offs = lineOffsets(text);
    const flat = flatten(text);
    const wordAt = new Map<number, [number, number]>();
    for (const [ws, we] of text.words ?? []) {
      if (!entryFor(text, ws, we)?.meaning) continue; // unmatched: no wash, no tap
      for (let i = ws; i <= we; i++) wordAt.set(i, [ws, we]);
    }
    const depth: number[] = new Array(flat.length).fill(0);
    for (const i of wordAt.keys()) depth[i] += 1;
    for (const [ps, pe] of text.phrases ?? [])
      for (let i = ps; i <= pe; i++) depth[i] += 1;
    return { offs, flat, wordAt, depth };
  }, [text]);
  const alphaHex = (d: number) =>
    Math.round(255 * (1 - Math.pow(0.85, d))).toString(16).padStart(2, "0");
  useEffect(() => { if (!words) setPeek(null); }, [words]);

  const pressWord = (w: [number, number]) => {
    move(0, false); // tapping a word is intent — never open the peek hidden
    setPeek((p) => (p && p.a[0] === w[0] && p.a[1] === w[1] ? null : { a: w, s: w }));
  };
  const peekRows: DictEntry[] = peek
    ? entriesAt(text, peek.a[0]).filter((d) => d.start <= peek.a[0] && d.end >= peek.a[1]).slice(0, 3)
    : [];

  // ── per-text prefs load / persist ── (the Reader is keyed by text id, so
  // each text mounts fresh; saves wait for the load to avoid clobbering)
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(READER_PREFS_KEY).then((raw) => {
      const p = parseTextPrefs(raw)[text.id];
      if (p) {
        if (typeof p.fontPx === "number") setFontPx(Math.min(MAX_PX, Math.max(MIN_PX, p.fontPx)));
        if (typeof p.rom === "boolean") setSound(p.rom);
        if (p.layout === "under" || p.layout === "line") setLayout(p.layout);
        if (typeof p.words === "boolean") setWords(p.words && hasSegmentation(text));
      }
      setPrefsLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!prefsLoaded) return;
    AsyncStorage.getItem(READER_PREFS_KEY).then((raw) => {
      const m = parseTextPrefs(raw);
      m[text.id] = { rom: sound, layout, fontPx, words };
      AsyncStorage.setItem(READER_PREFS_KEY, JSON.stringify(m));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound, layout, fontPx, words, prefsLoaded]);

  const pages = pageLabelMap(text);
  const under = sound && layout === "under";
  const tappable = sound && layout === "line";
  const onAccent = c.bg;
  const groups = displayLines(text);

  // ── bookmark load / persist / auto-scroll ──
  const scrollRef = useRef<ScrollView>(null);
  const groupY = useRef<Record<number, number>>({});
  const didScroll = useRef(false);
  const maybeScroll = (bm: number | null) => {
    if (didScroll.current || bm == null) return;
    const gi = groups.findIndex((g) => g[0] === bm);
    const y = gi >= 0 ? groupY.current[gi] : undefined;
    if (y != null) { didScroll.current = true; scrollRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: false }); }
  };
  useEffect(() => {
    AsyncStorage.getItem(BM_KEY).then((raw) => {
      try { const m = raw ? JSON.parse(raw) : {}; if (typeof m[text.id] === "number") { setBookmark(m[text.id]); maybeScroll(m[text.id]); } } catch { /* ignore */ }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toggleBookmark = (li: number) => {
    const next = bookmark === li ? null : li;
    setBookmark(next);
    AsyncStorage.getItem(BM_KEY).then((raw) => {
      let m: Record<string, number> = {};
      try { m = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }
      if (next == null) delete m[text.id]; else m[text.id] = next;
      AsyncStorage.setItem(BM_KEY, JSON.stringify(m));
    });
  };

  // ── auto-hide pill on scroll ──
  const pillY = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);
  const hidden = useRef(false);
  const move = (to: number, h: boolean) => { hidden.current = h; Animated.timing(pillY, { toValue: to, duration: 200, useNativeDriver: true }).start(); };
  const onScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y < 48 && hidden.current) move(0, false);
    else if (y > lastY.current + 6 && !hidden.current) move(130, true);
    else if (y < lastY.current - 6 && hidden.current) move(0, false);
    lastY.current = y;
  };

  const toggle = (gi: number) =>
    setRevealed((prev) => {
      const n = new Set(prev);
      n.has(gi) ? n.delete(gi) : n.add(gi);
      return n;
    });

  const BarBtn = ({ on, disabled, onPress, label }: { on: boolean; disabled?: boolean; onPress: () => void; label: string }) => (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={[rs.barBtn, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accent : "transparent", opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={[rs.barBtnText, { color: on ? onAccent : c.muted }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScroll={onScroll}>
        <Text style={[rs.eyebrow, { color: c.faint }]}>{lang.name.toUpperCase()} · TEXT</Text>
        <View style={[rs.frameOuter, { borderColor: c.border }]}>
          <View style={[rs.frameInner, { borderColor: c.border, backgroundColor: c.card }]}>
            {groups.map((group, gi) => {
              const li0 = group[0];
              const marked = bookmark === li0;
              const showRom = under || (tappable && revealed.has(gi));
              const items: ReactNode[] = [];
              group.forEach((li) => {
                const line = text.lines[li];
                line.forEach((tk, ti) => {
                  const lbl = pages.get(`${li}:${ti}`);
                  if (lbl) items.push(<FolioChip key={`p${li}-${ti}`} label={lbl} c={c} />);
                  items.push(
                    <View key={`s${li}-${ti}`} style={rs.scol}>
                      <Text style={{ fontSize: fontPx, lineHeight: fontPx * 1.55, color: c.ink }}>{tk.script}</Text>
                      {/* always rendered so the row reserves space; visibility toggles, not layout */}
                      <Text style={{ fontSize: romPx, marginTop: -romPx * 0.4, fontFamily: "Menlo", color: c.accent, opacity: showRom ? 1 : 0 }}>{roman(tk, lang, scheme) || " "}</Text>
                    </View>
                  );
                });
                const endLbl = pages.get(`${li}:${line.length}`);
                if (endLbl) items.push(<FolioChip key={`pe${li}`} label={endLbl} c={c} />);
                items.push(<Text key={`sh${li}`} style={{ fontSize: fontPx, lineHeight: fontPx * 1.55, paddingHorizontal: 1, color: c.accent }}>{lang.clauseMark}</Text>);
              });
              const row = <View style={rs.clauseRow}>{items}</View>;
              const paraEnd = isHardBreak(text, group[group.length - 1]);
              return (
                <View
                  key={gi}
                  onLayout={(e) => { groupY.current[gi] = e.nativeEvent.layout.y; maybeScroll(bookmark); }}
                  style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: paraEnd ? 20 : 6 }}
                >
                  <TouchableOpacity onPress={() => toggleBookmark(li0)} hitSlop={8} style={{ width: 24, alignItems: "center", paddingTop: 8 }}>
                    <Ionicons name={marked ? "bookmark" : "bookmark-outline"} size={15} color={marked ? c.accent : c.border} />
                  </TouchableOpacity>
                  <View style={[{ flex: 1, borderRadius: 6 }, marked ? { backgroundColor: c.accent + "14" } : null]}>
                    {tappable ? <TouchableOpacity activeOpacity={0.7} onPress={() => toggle(gi)}>{row}</TouchableOpacity> : row}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
        <Text style={[rs.meta, { color: c.faint }]}>
          {text.pageBreaks.length ? `${text.pageBreaks.length} folio sides · ` : ""}{groups.length} lines
        </Text>
      </ScrollView>

      {/* floating pill — auto-hides on scroll down */}
      <Animated.View style={[rs.bar, { backgroundColor: c.card, borderColor: c.border, transform: [{ translateY: pillY }] }]}>
        <View style={[rs.sizer, { borderColor: c.border }]}>
          <TouchableOpacity disabled={fontPx <= MIN_PX} onPress={() => setFontPx((p) => Math.max(MIN_PX, p - 3))} style={rs.sizerBtn}>
            <Text style={{ fontSize: 15, color: fontPx <= MIN_PX ? c.faint : c.muted }}>A−</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={fontPx >= MAX_PX} onPress={() => setFontPx((p) => Math.min(MAX_PX, p + 3))} style={[rs.sizerBtn, { borderLeftWidth: 0.5, borderLeftColor: c.border }]}>
            <Text style={{ fontSize: 18, color: fontPx >= MAX_PX ? c.faint : c.muted }}>A＋</Text>
          </TouchableOpacity>
        </View>
        <BarBtn on={sound} onPress={() => setSound((v) => !v)} label="Aa Romanization" />
        <BarBtn on={layout === "under"} disabled={!sound} onPress={() => sound && setLayout("under")} label="Under" />
        <BarBtn on={layout === "line"} disabled={!sound} onPress={() => sound && setLayout("line")} label="By line" />
        <BarBtn on={words} disabled={!hasSegmentation(text)} onPress={() => setWords((v) => !v)} label="Words" />
      </Animated.View>

      {/* peek — the tapped word's dict spans, widest first; a row tap moves the
          selection border onto that span in the text */}
      {peek && peekRows.length > 0 && (
        <Animated.View style={[rs.peek, { backgroundColor: c.card, borderColor: c.border, transform: [{ translateY: pillY }] }]}>
          <TouchableOpacity onPress={() => setPeek(null)} hitSlop={8} style={rs.peekClose}>
            <Ionicons name="close" size={16} color={c.faint} />
          </TouchableOpacity>
          {peekRows.map((dd, ri) => {
            const isSel = peek.s[0] === dd.start && peek.s[1] === dd.end;
            return (
              <TouchableOpacity
                key={`${dd.start}-${dd.end}`}
                activeOpacity={0.7}
                onPress={() => setPeek((p) => p && { ...p, s: [dd.start, dd.end] })}
                style={[
                  ri > 0 ? { marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: c.border } : null,
                  { marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 6, backgroundColor: isSel ? lapis + "1a" : "transparent" },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
                  <Text style={{ fontSize: 20, color: c.ink }}>
                    {seg!.flat.slice(dd.start, dd.end + 1).map((t) => t.script).join("")}
                  </Text>
                  <Text style={{ fontSize: 11, fontFamily: "Menlo", color: c.accent }}>
                    {seg!.flat.slice(dd.start, dd.end + 1).map((t) => roman(t, lang, scheme)).join(" ")}
                  </Text>
                  {dd.end > dd.start && <Text style={{ fontSize: 10, letterSpacing: 1, color: c.faint, fontFamily: "Georgia" }}>{dd.pos.toUpperCase()}</Text>}
                </View>
                <Text style={{ fontSize: 15, color: c.inkMid, marginTop: 2, fontFamily: "Georgia" }}>
                  {dd.meaning}
                  {dd.lemma ? <Text style={{ fontSize: 12, color: c.faint }}>  · from {lang.toScheme(dd.lemma, scheme)}</Text> : null}
                </Text>
                {dd.notes ? <Text style={{ fontSize: 12, color: c.faint, marginTop: 2, fontFamily: "Georgia" }}>{dd.notes}</Text> : null}
              </TouchableOpacity>
            );
          })}
          <Text style={{ fontSize: 9, letterSpacing: 1, color: c.faint, marginTop: 8, fontFamily: "Georgia" }}>
            MACHINE-MATCHED · UNREVIEWED
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const fc = StyleSheet.create({
  chipRow: { width: "100%", alignItems: "flex-start", marginVertical: 8 },
  chip: { borderWidth: 0.5, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 3, alignSelf: "flex-start" },
  chipText: { fontSize: 22, fontFamily: "Georgia" },
});

const rs = StyleSheet.create({
  eyebrow: { fontSize: 10, letterSpacing: 1.6, fontFamily: "Georgia", marginBottom: 8 },
  frameOuter: { borderWidth: 0.5, borderRadius: 3, padding: 3 },
  frameInner: { borderWidth: 0.5, borderRadius: 2, paddingHorizontal: 10, paddingVertical: 16 },
  clauseRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" },
  scol: { alignItems: "center" },
  meta: { textAlign: "center", fontSize: 11, marginTop: 12, fontFamily: "Menlo" },
  bar: { position: "absolute", left: 14, right: 14, bottom: 28, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 0.5, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8 },
  peek: { position: "absolute", left: 14, right: 14, bottom: 92, borderWidth: 0.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  peekClose: { position: "absolute", top: 8, right: 8, zIndex: 1 },
  sizer: { flexDirection: "row", borderWidth: 0.5, borderRadius: 10, overflow: "hidden" },
  sizerBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  barBtn: { flex: 1, borderWidth: 0.5, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  barBtnText: { fontSize: 13, fontFamily: "Georgia" },
});
