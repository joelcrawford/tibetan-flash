import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
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
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { useDeck } from "../../shared/hooks/useDeck";
import { Card, CardStatus } from "../../shared/types/types";
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

// ── Rating config ─────────────────────────────────────────────────────────────

const CARD_BASE = 320;
const SCREEN_H = Dimensions.get("window").height;
const CARD_EXPANDED = Math.round(SCREEN_H * 0.72);
const W = Dimensions.get("window").width;

const RATING_NEXT: Record<CardStatus, CardStatus> = {
  review: "familiar",
  familiar: "known",
  known: "review",
};

const RATING_CONFIG: Record<CardStatus, { icon: string; label: string; color: string }> = {
  review:   { icon: "↺", label: "review",   color: C.muted },
  familiar: { icon: "〜", label: "familiar", color: "#c49a00" },
  known:    { icon: "✓",  label: "known",    color: "#4a8c2a" },
};

// ── Highlighted Tibetan ───────────────────────────────────────────────────────

function HighlightedTibetan({ text, term }: { text: string; term: string }) {
  const parts = text.split(term);
  if (parts.length === 1 || !term) {
    return <Text style={s.ctxTibetan}>{text}</Text>;
  }
  return (
    <Text style={s.ctxTibetan}>
      {parts.map((part, i) => (
        <Text key={i}>
          {part}
          {i < parts.length - 1 && (
            <Text style={s.ctxTibetanHighlight}>{term}</Text>
          )}
        </Text>
      ))}
    </Text>
  );
}

// ── Card preview (adjacent cards during swipe) ────────────────────────────────
// Must mirror the front face layout exactly so Tibetan text sits at the same vertical position.
// The current card front face has: flex-1 Pressable (Tibetan + invisible ACIP) + speakBtn below.
// Without these ghost elements the Tibetan would center at a different Y and jump on transition.

function CardPreview({ card, c, dark }: { card: Card; c: { card: string; border: string; ink: string }; dark: boolean }) {
  return (
    <View style={[s.face, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[s.sessionBadge, { color: C.faint }]}>{card.session}</Text>
      <View style={s.cardPressable}>
        <Text style={[s.tibetan, { color: c.ink }]}>{card.tibetan}</Text>
        {/* Ghost ACIP — always reserves space, matching the current front face */}
        <Text style={[s.acipInline, { opacity: 0 }]}>{card.acip}</Text>
      </View>
      {/* Ghost speak button — keeps Pressable at same height as current front face */}
      <View style={s.speakBtn} />
    </View>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(true);
  const c = {
    bg:      dark ? C.bgDark      : C.bg,
    ink:     dark ? C.inkDark     : C.ink,
    card:    dark ? C.cardDark    : C.card,
    border:  dark ? C.borderDark  : C.border,
    sidebar: dark ? C.sidebarDark : C.sidebarBg,
    cardMid: dark ? C.cardMid     : C.stoneLt,
  };

  const {
    deck, card, idx, total, flipped, acipVisible,
    sessionFilter, sessions, knownCount, pct,
    go, goImmediate, markStatus, getCardStatus, handleCardClick,
    toggleAcip, setShuffled, setSessionFilter,
  } = useDeck(GLOSSARY as Card[]);

  const { speak, speaking } = useTTS();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [cardHeight, setCardHeight] = useState(CARD_BASE);

  // Refs so panResponder closure (created once) always sees current values
  const deckRef = useRef(deck);
  const idxRef = useRef(idx);
  const goImmediateRef = useRef(goImmediate);
  useEffect(() => { deckRef.current = deck; }, [deck]);
  useEffect(() => { idxRef.current = idx; }, [idx]);
  useEffect(() => { goImmediateRef.current = goImmediate; }, [goImmediate]);


  // Always shuffle
  useEffect(() => { setShuffled(true); }, [setShuffled]);

  // Reset context + card height on card change
  useEffect(() => { setContextOpen(false); setCardHeight(CARD_BASE); }, [idx]);

  const toggleContext = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const opening = !contextOpen;
    setContextOpen(opening);
    setCardHeight(opening ? CARD_EXPANDED : CARD_BASE);
  };

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
  // positionPixels: absolute scroll position in px (card N rests at N*W)
  // anchor: tracks idx*W — updated synchronously before re-render on card change
  // Card translateX = anchor - positionPixels (± W for adjacent cards)
  // After swipe to newIdx*W: anchor=newIdx*W, positionPixels=newIdx*W → currCardX=0, no reset needed
  const positionPixels = useRef(new Animated.Value(0)).current;
  const anchor = useRef(new Animated.Value(0)).current;
  const anchorMinusPos = useRef(Animated.subtract(anchor, positionPixels)).current;
  const prevCardX = useRef(Animated.subtract(anchorMinusPos, new Animated.Value(W))).current;
  const currCardX = anchorMinusPos;
  const nextCardX = useRef(Animated.add(anchorMinusPos, new Animated.Value(W))).current;

  // Reset position only when deck rebuilds (session/shuffle change) — not on every swipe.
  // For swipes, anchor is set synchronously in the animation callback before goImmediate fires.
  useEffect(() => {
    anchor.setValue(0);
    positionPixels.setValue(0);
  }, [deck]); // eslint-disable-line react-hooks/exhaustive-deps

  const startX = useRef(0);
  const swiping = useRef(false);
  const didSwipe = useRef(false);

  const THRESHOLD = 80;

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
          // positionPixels = idx*W minus drag offset (drag left → positionPixels increases → cards shift left)
          positionPixels.setValue(idxRef.current * W - g.dx * 0.85);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (!swiping.current || Math.abs(g.dx) < THRESHOLD) {
          Animated.spring(positionPixels, { toValue: idxRef.current * W, useNativeDriver: true }).start();
          return;
        }
        const dir = g.dx < 0 ? 1 : -1;
        const newIdx = Math.max(0, Math.min(deckRef.current.length - 1, idxRef.current + dir));

        if (newIdx === idxRef.current) {
          Animated.spring(positionPixels, { toValue: idxRef.current * W, useNativeDriver: true }).start();
          return;
        }

        didSwipe.current = true;
        Animated.timing(positionPixels, {
          toValue: newIdx * W,
          duration: 220,
          useNativeDriver: true,
        }).start(() => {
          // anchor must be set BEFORE goImmediateRef so re-render sees correct positions immediately
          anchor.setValue(newIdx * W);
          // reset flip so a flipped card doesn't spring back visibly on the incoming card
          flipAnim.setValue(0);
          goImmediateRef.current(dir);
          didSwipe.current = false;
        });
      },
    })
  ).current;

  // ── Adjacent cards ────────────────────────────────────────────────────────
  const prevCard = deck[idx - 1] ?? null;
  const nextCard = deck[idx + 1] ?? null;

  // ── Rating ────────────────────────────────────────────────────────────────
  const currentStatus = card ? getCardStatus(card.acip) : "review";
  const rating = RATING_CONFIG[currentStatus];
  const handleRate = () => card && markStatus(RATING_NEXT[currentStatus]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={s.header}>
        <Text style={[s.title, { color: c.ink }]}>༄༅། Tibetan Flash</Text>
        <View style={s.headerRight}>
          {card && (
            <Text style={[s.headerCounter, { color: C.muted }]}>{idx + 1} / {total}</Text>
          )}
          <TouchableOpacity
            style={[s.gearBtn, { backgroundColor: c.card, borderColor: c.border }]}
            onPress={() => setSidebarOpen((o) => !o)}
          >
            <Text style={{ color: C.muted, fontSize: 16 }}>{sidebarOpen ? "✕" : "⚙"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Card area */}
      <View style={s.cardArea}>
        {total === 0 && (
          <Text style={[s.empty, { color: C.muted }]}>No cards match this filter.</Text>
        )}

        {card && (
          <View style={{ height: cardHeight }}>

          {/* Prev card — one screen-width left, peeks in as you swipe right */}
          {prevCard && (
            <Animated.View
              pointerEvents="none"
              style={[
                s.cardWrap,
                { height: cardHeight, position: "absolute", top: 0, left: 0, right: 0 },
                { transform: [{ translateX: prevCardX }] },
              ]}
            >
              <CardPreview card={prevCard} c={c} dark={dark} />
            </Animated.View>
          )}

          {/* Next card — one screen-width right, peeks in as you swipe left */}
          {nextCard && (
            <Animated.View
              pointerEvents="none"
              style={[
                s.cardWrap,
                { height: cardHeight, position: "absolute", top: 0, left: 0, right: 0 },
                { transform: [{ translateX: nextCardX }] },
              ]}
            >
              <CardPreview card={nextCard} c={c} dark={dark} />
            </Animated.View>
          )}

          <Animated.View
            style={[s.cardWrap, { height: cardHeight }, { transform: [{ translateX: currCardX }] }]}
            {...panResponder.panHandlers}
          >
            {/* Front */}
            <Animated.View
              style={[
                s.face,
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
                <Text style={[s.acipInline, { color: dark ? C.faint : C.mid, opacity: acipVisible ? 1 : 0 }]}>
                  {card.acip}
                </Text>
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
              {/* ACIP toggle — bottom-right corner */}
              <TouchableOpacity
                style={[s.acipIconBtn, { backgroundColor: c.card, borderColor: c.border }]}
                onPress={toggleAcip}
              >
                <Ionicons name="language" size={17} color={acipVisible ? c.ink : C.muted} />
              </TouchableOpacity>
            </Animated.View>

            {/* Back */}
            <Animated.View
              style={[
                s.face,
                { backgroundColor: c.card, borderColor: c.border },
                { transform: [{ perspective: 1200 }, { rotateY: backRotate }] },
                { justifyContent: "flex-start", alignItems: "stretch" },
              ]}
              pointerEvents={flipped ? "auto" : "none"}
            >
              <Text style={[s.sessionBadge, { color: C.faint }]}>{card.session}</Text>
              {/* TouchableOpacity (not Pressable) so nested rating TouchableOpacity captures first */}
              <TouchableOpacity
                activeOpacity={1}
                style={s.cardPressable}
                onPress={() => { if (!didSwipe.current) handleCardClick(); }}
              >
                <View style={s.backCenter}>
                  <Text style={[s.acipBack, { color: dark ? C.faint : C.mid }]}>{card.acip}</Text>
                  <Text style={[s.meaning, { color: c.ink }]}>{card.meaning}</Text>
                  {card.notes ? (
                    <Text style={[s.notes, { color: C.muted }]}>{card.notes}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[s.ratingCornerBtn, { backgroundColor: c.card, borderColor: c.border }]}
                  onPress={handleRate}
                >
                  <Text style={s.ratingIcon}>{rating.icon}</Text>
                  <Text style={[s.ratingLabel, { color: rating.color }]}>{rating.label}</Text>
                </TouchableOpacity>
              </TouchableOpacity>

              {/* Context — inside card, anchored at bottom, sibling of Pressable */}
              {(card.context || card.context_tibetan) && (
                <View style={[s.ctxSection, { borderTopColor: dark ? C.borderDark : C.stone }]}>
                  <TouchableOpacity style={s.ctxToggle} onPress={toggleContext}>
                    <Text style={[s.ctxToggleArrow, { color: C.faint }]}>{contextOpen ? "▾" : "▶"}</Text>
                    <Text style={[s.ctxToggleLabel, { color: C.faint }]}>context</Text>
                  </TouchableOpacity>
                  {contextOpen && (
                    <ScrollView style={s.ctxScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                      <TouchableOpacity activeOpacity={1} onPress={toggleContext}>
                        {card.context ? (
                          <View style={[s.ctxBar, { borderLeftColor: dark ? C.borderDark : C.stone }]}>
                            <Text style={[s.ctxText, { color: dark ? C.faint : C.mid }]}>{card.context}</Text>
                          </View>
                        ) : null}
                        {card.context_tibetan ? (
                          <View style={[s.ctxBar, { borderLeftColor: dark ? C.borderDark : C.stone, marginTop: card.context ? 8 : 0 }]}>
                            <HighlightedTibetan text={card.context_tibetan} term={card.tibetan} />
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    </ScrollView>
                  )}
                </View>
              )}
            </Animated.View>
          </Animated.View>
          </View>
        )}
      </View>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <Pressable style={s.overlay} onPress={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      {sidebarOpen && (
        <View style={[s.sidebar, { backgroundColor: c.sidebar, borderLeftColor: c.border }]}>
          <ScrollView showsVerticalScrollIndicator={false}>

            <Text style={[s.sidebarLabel, { color: C.faint }]}>Session</Text>
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

            <Text style={[s.sidebarLabel, { color: C.faint, marginTop: 24 }]}>Appearance</Text>
            <TouchableOpacity
              style={[s.btn, s.sessionBtn, { backgroundColor: c.card, borderColor: c.border }]}
              onPress={() => setDark(d => !d)}
            >
              <Text style={[s.btnText, { color: c.ink }]}>{dark ? "Light mode" : "Dark mode"}</Text>
            </TouchableOpacity>

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
  root:               { flex: 1 },
  header:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title:              { fontFamily: "Georgia", fontSize: 18, letterSpacing: 0.3 },
  headerRight:        { flexDirection: "row", alignItems: "center", gap: 10 },
  headerCounter:      { fontSize: 13, fontStyle: "italic" },
  gearBtn:            { width: 32, height: 32, borderRadius: 8, borderWidth: 0.5, alignItems: "center", justifyContent: "center" },
  cardArea:           { flex: 1, paddingHorizontal: 16, justifyContent: "center" },
  empty:              { textAlign: "center", fontStyle: "italic", fontSize: 15 },
  cardWrap:           { height: CARD_BASE },  // overridden inline with dynamic cardHeight
  face:               { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, borderWidth: 0.5, padding: 20, alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden", overflow: "hidden" },
  cardPressable:      { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  sessionBadge:       { position: "absolute", top: 14, right: 16, fontSize: 11, letterSpacing: 0.6 },
  tibetan:            { fontSize: 52, lineHeight: 78, letterSpacing: 1, textAlign: "center" },
  acipInline:         { fontFamily: "Courier New", fontSize: 16, letterSpacing: 1, marginTop: 6, textAlign: "center" },
  acipIconBtn:        { position: "absolute", bottom: 12, right: 12, width: 30, height: 30, borderRadius: 8, borderWidth: 0.5, alignItems: "center", justifyContent: "center" },
  speakBtn:           { borderWidth: 0.5, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginTop: 8 },
  speakBtnText:       { fontSize: 13 },
  // Back face
  backCenter:         { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  acipBack:           { fontFamily: "Courier New", fontSize: 13, letterSpacing: 1, marginBottom: 10, textAlign: "center" },
  meaning:            { fontFamily: "Georgia", fontSize: 20, fontStyle: "italic", textAlign: "center", marginBottom: 8, lineHeight: 28 },
  notes:              { fontSize: 13, fontStyle: "italic", textAlign: "center", lineHeight: 20 },
  // Rating corner button — inside Pressable so it captures touch without triggering flip
  ratingCornerBtn:    { position: "absolute", top: 0, left: 0, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 0.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  ratingIcon:         { fontSize: 14 },
  ratingLabel:        { fontSize: 12 },
  // Context section — inside card, anchored at bottom
  ctxSection:         { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4, paddingBottom: 4 },
  ctxToggle:          { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  ctxToggleArrow:     { fontSize: 9 },
  ctxToggleLabel:     { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Georgia" },
  ctxScroll:          { maxHeight: 200 },
  ctxBar:             { borderLeftWidth: 2, paddingLeft: 10 },
  ctxText:            { fontSize: 12, fontStyle: "italic", lineHeight: 18 },
  ctxTibetan:         { fontFamily: "Courier New", fontSize: 11, lineHeight: 18, letterSpacing: 0.6, color: C.faint },
  ctxTibetanHighlight:{ backgroundColor: "#f5e97a", color: "#1a1a18" },
  // Sidebar
  overlay:            { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.2)", zIndex: 100 },
  sidebar:            { position: "absolute", top: 0, right: 0, bottom: 0, width: 260, borderLeftWidth: 0.5, padding: 24, paddingTop: 56, zIndex: 200 },
  sidebarLabel:       { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  btn:                { borderWidth: 0.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 5 },
  sessionBtn:         { alignSelf: "stretch", marginBottom: 6 },
  btnText:            { fontSize: 13 },
  progressWrap:       { height: 3, borderRadius: 2, overflow: "hidden", marginBottom: 8 },
  progressBar:        { height: "100%", backgroundColor: C.muted, borderRadius: 2 },
  progressLabel:      { fontSize: 13, fontStyle: "italic" },
});
