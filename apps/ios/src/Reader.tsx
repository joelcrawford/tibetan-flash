import { useState, ReactNode } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Language, Text as LangText } from "../../../shared/types/types";
import { roman, pageLabelMap, displayLines } from "../../../shared/reader";

type Colors = {
  bg: string; card: string; border: string; ink: string; inkMid: string;
  muted: string; faint: string; accent: string; raised?: string;
};

const MIN_PX = 24, MAX_PX = 52;

function FolioChip({ label, c }: { label: string; c: Colors }) {
  return (
    <View style={[fc.chip, { borderColor: c.accent }]}>
      <Text style={[fc.chipText, { color: c.accent }]}>❁ {label}</Text>
    </View>
  );
}

export function Reader({ text, lang, scheme, c, onClose }: { text: LangText; lang: Language; scheme: string; c: Colors; onClose: () => void }) {
  const [sound, setSound] = useState(false);
  const [layout, setLayout] = useState<"under" | "line">("under");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [fontPx, setFontPx] = useState(33);
  const romPx = Math.max(9, Math.round(fontPx * 0.36));

  const pages = pageLabelMap(text);
  const under = sound && layout === "under";
  const tappable = sound && layout === "line";
  const onAccent = c.bg;

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
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, zIndex: 100 }]}>
      {/* header */}
      <View style={[rs.header, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[rs.eyebrow, { color: c.faint }]}>{lang.name.toUpperCase()} · TEXT</Text>
          <Text style={[rs.title, { color: c.ink }]} numberOfLines={1}>{text.title}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Ionicons name="close-outline" size={26} color={c.muted} />
        </TouchableOpacity>
      </View>

      {/* canvas */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={[rs.frameOuter, { borderColor: c.border }]}>
          <View style={[rs.frameInner, { borderColor: c.border, backgroundColor: c.card }]}>
            {displayLines(text).map((group, gi) => {
              const showRom = under || (tappable && revealed.has(gi)); // per-token romanization (aligned)
              const items: ReactNode[] = [];
              group.forEach((li) => {
                const line = text.lines[li];
                line.forEach((tk, ti) => {
                  const lbl = pages.get(`${li}:${ti}`);
                  if (lbl) items.push(<FolioChip key={`p${li}-${ti}`} label={lbl} c={c} />);
                  items.push(
                    <View key={`s${li}-${ti}`} style={rs.scol}>
                      <Text style={{ fontSize: fontPx, lineHeight: fontPx * 1.55, color: c.ink }}>{tk.script}</Text>
                      {showRom ? <Text style={{ fontSize: romPx, marginTop: -romPx * 0.4, fontFamily: "Menlo", color: c.accent }}>{roman(tk, lang, scheme)}</Text> : null}
                    </View>
                  );
                });
                const endLbl = pages.get(`${li}:${line.length}`);
                if (endLbl) items.push(<FolioChip key={`pe${li}`} label={endLbl} c={c} />);
                items.push(<Text key={`sh${li}`} style={{ fontSize: fontPx, lineHeight: fontPx * 1.55, paddingHorizontal: 1, color: c.accent }}>{lang.clauseMark}</Text>);
              });
              const row = <View style={rs.clauseRow}>{items}</View>;
              return (
                <View key={gi} style={rs.clauseBlock}>
                  {tappable ? <TouchableOpacity activeOpacity={0.7} onPress={() => toggle(gi)}>{row}</TouchableOpacity> : row}
                </View>
              );
            })}
          </View>
        </View>
        <Text style={[rs.meta, { color: c.faint }]}>
          {text.pageBreaks.length ? `${text.pageBreaks.length} folio sides · ` : ""}{displayLines(text).length} lines
        </Text>
      </ScrollView>

      {/* bottom bar */}
      <View style={[rs.bar, { backgroundColor: c.card, borderColor: c.border }]}>
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
      </View>
    </View>
  );
}

const fc = StyleSheet.create({
  chip: { borderWidth: 0.5, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 1, marginHorizontal: 4, alignSelf: "center" },
  chipText: { fontSize: 11, fontFamily: "Georgia" },
});

const rs = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 0.5 },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, fontFamily: "Georgia" },
  title: { fontSize: 20, marginTop: 1 },
  frameOuter: { borderWidth: 0.5, borderRadius: 3, padding: 3 },
  frameInner: { borderWidth: 0.5, borderRadius: 2, paddingHorizontal: 14, paddingVertical: 16 },
  clauseBlock: { marginBottom: 6 },
  clauseRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" },
  scol: { alignItems: "center" },
  meta: { textAlign: "center", fontSize: 11, marginTop: 12, fontFamily: "Menlo" },
  bar: { position: "absolute", left: 14, right: 14, bottom: 28, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 0.5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  sizer: { flexDirection: "row", borderWidth: 0.5, borderRadius: 10, overflow: "hidden" },
  sizerBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  barBtn: { flex: 1, borderWidth: 0.5, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  barBtnText: { fontSize: 13, fontFamily: "Georgia" },
});
