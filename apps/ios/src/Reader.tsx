import { useState, useRef, useEffect, ReactNode } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Language, Text as LangText } from "../../../shared/types/types";
import { roman, pageLabelMap, displayLines, isHardBreak } from "../../../shared/reader";

type Colors = {
  bg: string; card: string; border: string; ink: string; inkMid: string;
  muted: string; faint: string; accent: string; raised?: string;
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
  const romPx = Math.max(9, Math.round(fontPx * 0.36));

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
      </Animated.View>
    </View>
  );
}

const fc = StyleSheet.create({
  chipRow: { width: "100%", alignItems: "center", marginVertical: 6 },
  chip: { borderWidth: 0.5, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 1, alignSelf: "center" },
  chipText: { fontSize: 11, fontFamily: "Georgia" },
});

const rs = StyleSheet.create({
  eyebrow: { fontSize: 10, letterSpacing: 1.6, fontFamily: "Georgia", marginBottom: 8 },
  frameOuter: { borderWidth: 0.5, borderRadius: 3, padding: 3 },
  frameInner: { borderWidth: 0.5, borderRadius: 2, paddingHorizontal: 10, paddingVertical: 16 },
  clauseRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" },
  scol: { alignItems: "center" },
  meta: { textAlign: "center", fontSize: 11, marginTop: 12, fontFamily: "Menlo" },
  bar: { position: "absolute", left: 14, right: 14, bottom: 28, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 0.5, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8 },
  sizer: { flexDirection: "row", borderWidth: 0.5, borderRadius: 10, overflow: "hidden" },
  sizerBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  barBtn: { flex: 1, borderWidth: 0.5, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  barBtnText: { fontSize: 13, fontFamily: "Georgia" },
});
