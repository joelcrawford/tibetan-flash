import { useEffect, useRef, useState } from "react";
import {
  Animated,
  GestureResponderEvent,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  useColorScheme,
  View,
} from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useDeck } from "../../shared/hooks/useDeck";
import { Card } from "../../shared/types/types";
import { useTTS } from "./src/hooks/useTTS";
import GLOSSARY from "../../shared/data/glossary.json";

// ── Colours ──────────────────────────────────────────────────────────────────

const C = {
  bg:          "#f5f3ee",
  bgDark:      "#1c1c1a",
  ink:         "#1a1a18",
  inkDark:     "#e8e6e0",
  muted:       "#888780",
  faint:       "#b4b2a9",
  mid:         "#5f5e5a",
  stone:       "#d3d1c7",
  stoneLt:     "#ece9e3",
  card:        "#ffffff",
  cardDark:    "#2c2c2a",
  cardMid:     "#3a3a38",
  border:      "#d3d1c7",
  borderDark:  "#444441",
  sidebarBg:   "#faf8f4",
  sidebarDark: "#242422",
  stoneCard:   "#f1efe8",
};

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const c = {
    bg:      dark ? C.bgDark      : C.bg,
    ink:     dark ? C.inkDark     : C.ink,
    card:    dark ? C.cardDark    : C.card,
    border:  dark ? C.borderDark  : C.border,
    sidebar: dark ? C.sidebarDark : C.sidebarBg,
    cardMid: dark ? C.cardMid     : C.stoneLt,
  };

  const {
    card, idx, total, flipped, acipVisible, shuffled,
    sessionFilter, sessions, knownCount, pct,
    go, goImmediate, markKnown, handleCardClick,
    toggleAcip,
    setShuffled, setSessionFilter,
  } = useDeck(GLOSSARY as Card[]);

  const { speak, speaking } = useTTS();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);

  useEffect(() => { setContextOpen(false); }, [idx]);

  // ── 3D flip animation ─────────────────────────────────────────────────────
  const flipAnim = useRef(new Animated.Value(0)).current;
  const isFlipped = useRef(false);

  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: flipped ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
    isFlipped.current = flipped;
  }, [flipped, flipAnim]);

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });

  // ── Swipe gesture ─────────────────────────────────────────────────────────
  const swipeX = useRef(new Animated.Value(0)).current;
  const startX = useRef(0);
  const swiping = useRef(false);
  const didSwipe = useRef(false);

  const THRESHOLD = 80;
  const W = 360; // approximate card width

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 8,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        startX.current = e.nativeEvent.pageX;
        swiping.current = false;
        didSwipe.current = false;
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 8) {
          swiping.current = true;
          swipeX.setValue(g.dx * 0.85);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (!swiping.current || Math.abs(g.dx) < THRESHOLD) {
          Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
          return;
        }
        const dir = g.dx < 0 ? 1 : -1;
        didSwipe.current = true;
        Animated.timing(swipeX, {
          toValue: g.dx < 0 ? -W : W,
          duration: 220,
          useNativeDriver: true,
        }).start(() => {
          goImmediate(dir);
          swipeX.setValue(dir < 0 ? W : -W);
          Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start(() => {
            didSwipe.current = false;
          });
        });
      },
    })
  ).current;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={s.header}>
        <Text style={[s.title, { color: c.ink }]}>
          ༄༅། Tibetan Flash{"  "}
          <Text style={[s.titleSub, { color: C.muted }]}>{total} cards</Text>
        </Text>
        <TouchableOpacity
          style={[s.gearBtn, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => setSidebarOpen((o) => !o)}
        >
          <Text style={{ color: C.muted, fontSize: 16 }}>{sidebarOpen ? "✕" : "⚙"}</Text>
        </TouchableOpacity>
      </View>

      {/* Card area */}
      <View style={s.cardArea}>
        {total === 0 && (
          <Text style={[s.empty, { color: C.muted }]}>No cards match this filter.</Text>
        )}

        {card && (
          <Animated.View
            style={[s.cardWrap, { transform: [{ translateX: swipeX }] }]}
            {...panResponder.panHandlers}
          >
            {/* Front */}
            <Animated.View
              style={[
                s.face,
                s.faceFront,
                { backgroundColor: c.card, borderColor: c.border },
                { transform: [{ perspective: 1200 }, { rotateY: frontRotate }] },
              ]}
              pointerEvents={flipped ? "none" : "auto"}
            >
              <Text style={[s.sessionBadge, { color: C.faint }]}>{card.session}</Text>
              <Pressable
                style={s.cardPressable}
                onPress={() => { if (!didSwipe.current) handleCardClick(); }}
              >
                <Text style={[s.tibetan, { color: c.ink }]}>{card.tibetan}</Text>
              </Pressable>
              <TouchableOpacity
                style={[s.speakBtn, { backgroundColor: c.card, borderColor: c.border }]}
                onPress={() => speak(card.tibetan)}
                disabled={speaking}
              >
                <Text style={[s.speakBtnText, { color: C.muted, opacity: speaking ? 0.5 : 1 }]}>
                  {speaking ? "…" : "♪"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.acip,
                  acipVisible
                    ? { backgroundColor: dark ? C.cardMid : C.stoneCard, borderColor: c.border }
                    : { backgroundColor: C.stone, borderColor: C.stone },
                ]}
                onPress={toggleAcip}
              >
                <Text
                  style={[
                    s.acipText,
                    { color: acipVisible ? (dark ? C.faint : C.mid) : "transparent" },
                  ]}
                >
                  {card.acip}
                </Text>
                {!acipVisible && (
                  <Text style={s.acipHint}>show ACIP</Text>
                )}
              </TouchableOpacity>
              <Text style={[s.tapHint, { color: C.faint }]}>
                {acipVisible ? "tap card to flip" : "tap ACIP to reveal · tap to flip"}
              </Text>
            </Animated.View>

            {/* Back */}
            <Animated.View
              style={[
                s.face,
                s.faceBack,
                { backgroundColor: c.card, borderColor: c.border },
                { transform: [{ perspective: 1200 }, { rotateY: backRotate }] },
              ]}
              pointerEvents={flipped ? "auto" : "none"}
            >
              <Text style={[s.sessionBadge, { color: C.faint }]}>{card.session}</Text>
              <Pressable
                style={s.cardPressable}
                onPress={() => { if (!didSwipe.current) handleCardClick(); }}
              >
                <View style={s.backContent}>
                  <Text style={[s.acipBack, { color: dark ? C.faint : C.mid }]}>{card.acip}</Text>
                  <Text style={[s.meaning, { color: c.ink }]}>{card.meaning}</Text>
                  {card.notes ? (
                    <Text style={[s.notes, { color: C.muted }]}>{card.notes}</Text>
                  ) : null}
                </View>
              </Pressable>
            </Animated.View>
          </Animated.View>
        )}
      </View>

      {/* Context drawer */}
      {card && flipped && (card.context || card.context_tibetan) && (
        <View style={s.ctxDrawer}>
          <TouchableOpacity
            style={s.ctxToggle}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setContextOpen((o) => !o);
            }}
          >
            <Text style={[s.ctxToggleArrow, { color: C.faint }]}>{contextOpen ? "▾" : "▶"}</Text>
            <Text style={[s.ctxToggleLabel, { color: C.faint }]}>context</Text>
          </TouchableOpacity>
          {contextOpen && (
            <View style={s.ctxBody}>
              {card.context ? (
                <View style={[s.ctxBar, { borderLeftColor: C.stone }]}>
                  <Text style={[s.ctxText, { color: dark ? C.faint : C.mid }]}>{card.context}</Text>
                </View>
              ) : null}
              {card.context_tibetan ? (
                <View style={[s.ctxBar, { borderLeftColor: C.stone, marginTop: 8 }]}>
                  <Text style={[s.ctxTibetan, { color: C.faint }]}>{card.context_tibetan}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      )}

      {/* Known / Review */}
      {card && flipped && (
        <View style={s.knownRow}>
          <TouchableOpacity
            style={[s.knownBtn, { backgroundColor: c.card, borderColor: c.border }]}
            onPress={() => markKnown(true)}
          >
            <Text style={[s.knownBtnText, { color: c.ink }]}>✓ Known</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.knownBtn, { backgroundColor: c.card, borderColor: c.border }]}
            onPress={() => markKnown(false)}
          >
            <Text style={[s.knownBtnText, { color: c.ink }]}>✗ Review again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Counter */}
      {card && (
        <Text style={[s.counter, { color: C.muted }]}>{idx + 1} / {total}</Text>
      )}

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <Pressable style={s.overlay} onPress={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      {sidebarOpen && (
        <View style={[s.sidebar, { backgroundColor: c.sidebar, borderLeftColor: c.border }]}>
          <ScrollView showsVerticalScrollIndicator={false}>

            <Text style={[s.sidebarLabel, { color: C.faint }]}>Options</Text>
            <View style={s.sidebarBtns}>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: shuffled ? c.cardMid : c.card, borderColor: c.border }]}
                onPress={() => setShuffled((v) => !v)}
              >
                <Text style={[s.btnText, { color: c.ink }]}>⇌ Shuffle</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.sidebarLabel, { color: C.faint, marginTop: 24 }]}>Session</Text>
            {sessions.map((sess) => (
              <TouchableOpacity
                key={sess}
                style={[
                  s.btn,
                  s.sessionBtn,
                  { backgroundColor: sessionFilter === sess ? c.cardMid : c.card, borderColor: c.border },
                ]}
                onPress={() => { setSessionFilter(sess); setSidebarOpen(false); }}
              >
                <Text style={[s.btnText, { color: c.ink }]}>{sess}</Text>
              </TouchableOpacity>
            ))}

            <Text style={[s.sidebarLabel, { color: C.faint, marginTop: 24 }]}>Progress</Text>
            {total > 0 && (
              <>
                <View style={[s.progressWrap, { backgroundColor: dark ? C.borderDark : C.stone }]}>
                  <View style={[s.progressBar, { width: `${pct}%` as `${number}%` }]} />
                </View>
                <Text style={[s.progressLabel, { color: C.muted }]}>
                  {knownCount} known · {total - knownCount} remaining
                </Text>
              </>
            )}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title:         { fontFamily: "Georgia", fontSize: 18, letterSpacing: 0.3 },
  titleSub:      { fontSize: 13, fontStyle: "italic" },
  gearBtn:       { width: 32, height: 32, borderRadius: 8, borderWidth: 0.5, alignItems: "center", justifyContent: "center" },
  cardArea:      { flex: 1, paddingHorizontal: 16, justifyContent: "center" },
  empty:         { textAlign: "center", fontStyle: "italic", fontSize: 15 },
  cardWrap:      { height: 320 },
  face:          { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, borderWidth: 0.5, padding: 24, alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden" },
  faceFront:     {},
  faceBack:      {},
  cardPressable: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  sessionBadge:  { position: "absolute", top: 14, right: 16, fontSize: 11, letterSpacing: 0.6 },
  tibetan:       { fontSize: 52, lineHeight: 78, letterSpacing: 1, textAlign: "center" },
  speakBtn:      { borderWidth: 0.5, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginTop: 8, marginBottom: 4 },
  speakBtnText:  { fontSize: 13 },
  acip:          { borderWidth: 0.5, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 4, marginTop: 4, minWidth: 80, alignItems: "center" },
  acipText:      { fontFamily: "Courier New", fontSize: 13, letterSpacing: 1 },
  acipHint:      { position: "absolute", fontSize: 11, color: C.muted, fontStyle: "italic" },
  tapHint:       { position: "absolute", bottom: 14, fontSize: 12, fontStyle: "italic" },
  backContent:   { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  acipBack:      { fontFamily: "Courier New", fontSize: 13, letterSpacing: 1, marginBottom: 10, textAlign: "center" },
  meaning:       { fontFamily: "Georgia", fontSize: 20, fontStyle: "italic", textAlign: "center", marginBottom: 12, lineHeight: 28 },
  notes:         { fontSize: 13, fontStyle: "italic", textAlign: "center", lineHeight: 20, marginBottom: 12 },
  ctxDrawer:     { paddingHorizontal: 16, marginBottom: 4 },
  ctxToggle:     { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  ctxToggleArrow: { fontSize: 9 },
  ctxToggleLabel: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Georgia" },
  ctxBody:       { paddingBottom: 8 },
  ctxBar:        { borderLeftWidth: 2, paddingLeft: 10, alignSelf: "stretch" },
  ctxText:       { fontSize: 13, fontStyle: "italic", lineHeight: 20 },
  ctxTibetan:    { fontFamily: "Courier New", fontSize: 11, lineHeight: 18, letterSpacing: 0.6 },
  knownRow:      { flexDirection: "row", justifyContent: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  knownBtn:      { borderWidth: 0.5, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 7 },
  knownBtnText:  { fontSize: 13 },
  counter:       { textAlign: "center", fontSize: 14, fontStyle: "italic", paddingBottom: 16 },
  overlay:       { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.2)", zIndex: 100 },
  sidebar:       { position: "absolute", top: 0, right: 0, bottom: 0, width: 260, borderLeftWidth: 0.5, padding: 24, paddingTop: 56, zIndex: 200 },
  sidebarLabel:  { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  sidebarBtns:   { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  btn:           { borderWidth: 0.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 5 },
  sessionBtn:    { alignSelf: "stretch", marginBottom: 6 },
  btnText:       { fontSize: 13 },
  progressWrap:  { height: 3, borderRadius: 2, overflow: "hidden", marginBottom: 8 },
  progressBar:   { height: "100%", backgroundColor: C.muted, borderRadius: 2 },
  progressLabel: { fontSize: 13, fontStyle: "italic" },
});
