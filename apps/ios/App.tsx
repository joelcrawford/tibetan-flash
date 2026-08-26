import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDeck, StorageAdapter } from "../../shared/hooks/useDeck";
import { Card, CardStatus, StatusMap, Text as LangText } from "../../shared/types/types";
import { LANGUAGES, LANGUAGE_BY_CODE, DEFAULT_LANGUAGE } from "../../shared/languages";
import { textTitle } from "../../shared/reader";
import {
  AppSettings, SETTINGS_KEY, LEGACY_LANG_KEY, LEGACY_FILTERS_KEY, parseSettings,
} from "../../shared/hooks/settings";
import { useTTS } from "./src/hooks/useTTS";
import { Reader } from "./src/Reader";

const iosStorage: StorageAdapter = {
  load: async () => {
    try { const raw = await AsyncStorage.getItem("tibetan-flash-status"); return raw ? JSON.parse(raw) : {}; }
    catch { return {} as StatusMap; }
  },
  save: (map: StatusMap) => { AsyncStorage.setItem("tibetan-flash-status", JSON.stringify(map)); },
};

// ── Colours ──────────────────────────────────────────────────────────────────
// Theme A — Monastery (dark): warm charcoal + saffron gold
// Theme F — Paper (light):   aged parchment + russet terracotta

const C = {
  // Paper (light) backgrounds
  bg:         "#faf6ef",
  card:       "#fff9f0",
  raised:     "#f0e8d8",
  sheetBg:    "#f8f2e8",
  // Paper borders
  border:     "#e0ceb8",
  // Paper text
  ink:        "#3a2a18",
  inkMid:     "#5a4a38",
  muted:      "#8a7868",
  faint:      "#b0a888",
  // Paper accent — russet
  accent:     "#993c1d",

  // Monastery (dark) backgrounds
  bgDark:     "#1a1714",
  cardDark:   "#242018",
  raisedDark: "#2a2520",
  sheetDark:  "#1e1a16",
  // Monastery borders
  borderDark: "#3a3530",
  // Monastery text
  inkDark:    "#e8e0d0",
  inkMidDark: "#c0b0a0",
  mutedDark:  "#a09080",
  faintDark:  "#806858",
  // Monastery accent — saffron
  accentDark: "#c47c1a",

  // Semantic status (theme-split)
  knownDark:     "#4a8c2a",
  knownLight:    "#3b6d11",
  familiarDark:  "#c49a00",
  familiarLight: "#8a6000",
  review:        "#888780",  // same in both themes
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_BASE = 320;
const SCREEN_H = Dimensions.get("window").height;
const SHEET_HEIGHT = Math.round(SCREEN_H * 0.45);
const PEEK_HEIGHT = 72;
const W = Dimensions.get("window").width;

const RATING_NEXT: Record<CardStatus, CardStatus> = {
  review: "familiar",
  familiar: "known",
  known: "review",
};

// ── Highlighted Tibetan ───────────────────────────────────────────────────────

function HighlightedTibetan({ text, term, color }: { text: string; term: string; color: string }) {
  const parts = text.split(term);
  if (parts.length === 1 || !term) {
    return <Text style={[s.sheetTibetan, { color }]}>{text}</Text>;
  }
  return (
    <Text style={[s.sheetTibetan, { color }]}>
      {parts.map((part, i) => (
        <Text key={i}>
          {part}
          {i < parts.length - 1 && (
            <Text style={s.sheetTibetanHighlight}>{term}</Text>
          )}
        </Text>
      ))}
    </Text>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // Hydrate settings before rendering the app, so every persisted preference
  // (theme, language, filters, open text) is in place on first paint.
  const [initial, setInitial] = useState<AppSettings | null>(null);
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(SETTINGS_KEY),
      AsyncStorage.getItem(LEGACY_LANG_KEY),
      AsyncStorage.getItem(LEGACY_FILTERS_KEY),
    ]).then(([raw, legacyLang, legacyFilters]) =>
      setInitial(parseSettings(raw, legacyLang, legacyFilters, DEFAULT_LANGUAGE))
    );
  }, []);
  if (!initial) return <View style={{ flex: 1, backgroundColor: C.bgDark }} />;
  return <Main initial={initial} />;
}

function Main({ initial }: { initial: AppSettings }) {
  const [settings, setSettings] = useState(initial);
  useEffect(() => { AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);

  const dark = settings.dark;
  const langCode = settings.lang;
  const lang = LANGUAGE_BY_CODE[langCode] ?? LANGUAGE_BY_CODE[DEFAULT_LANGUAGE];

  // Romanization scheme is remembered per language; unset falls back to the default.
  const storedScheme = settings.schemeByLang[langCode];
  const activeScheme = lang.schemes.some((x) => x.id === storedScheme) ? storedScheme : lang.defaultScheme;
  const setScheme = (id: string) =>
    setSettings((s) => ({ ...s, schemeByLang: { ...s.schemeByLang, [s.lang]: id } }));

  const c = {
    bg:     dark ? C.bgDark     : C.bg,
    card:   dark ? C.cardDark   : C.card,
    raised: dark ? C.raisedDark : C.raised,
    sheet:  dark ? C.sheetDark  : C.sheetBg,
    border: dark ? C.borderDark : C.border,
    ink:    dark ? C.inkDark    : C.ink,
    inkMid: dark ? C.inkMidDark : C.inkMid,
    muted:  dark ? C.mutedDark  : C.muted,
    faint:  dark ? C.faintDark  : C.faint,
    accent: dark ? C.accentDark : C.accent,
  };

  // Rating config is theme-dependent for known/familiar colors
  const RATING_CONFIG: Record<CardStatus, { icon: string; label: string; color: string }> = {
    review:   { icon: "↺", label: "review",   color: C.review },
    familiar: { icon: "〜", label: "familiar", color: dark ? C.familiarDark : C.familiarLight },
    known:    { icon: "✓",  label: "known",    color: dark ? C.knownDark    : C.knownLight },
  };

  const {
    deck, card, idx, total, flipped, acipVisible,
    sessionFilters, sessions, knownCount, familiarCount, reviewCount, totalFiltered, pct,
    goImmediate, rateCard, getCardStatus, handleCardClick,
    toggleAcip, resetSession, setShuffled, setSessionFilters,
  } = useDeck(lang.glossary, iosStorage, settings.filtersByLang[settings.lang] ?? []);

  // Keep the per-language filter map in sync with the live filter selection.
  useEffect(() => {
    setSettings((s) => {
      const cur = s.filtersByLang[s.lang] ?? [];
      if (cur.length === sessionFilters.length && cur.every((v, i) => v === sessionFilters[i])) return s;
      return { ...s, filtersByLang: { ...s.filtersByLang, [s.lang]: sessionFilters } };
    });
  }, [sessionFilters]);

  const { speak, speaking } = useTTS();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const readingText: LangText | null = settings.readingId
    ? lang.texts.find((t) => t.id === settings.readingId) ?? null
    : null;
  const setReadingText = (t: LangText | null) =>
    setSettings((s) => ({ ...s, readingId: t?.id ?? null }));
  const [contextOpen, setContextOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [pendingReset, setPendingReset] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingReset) return;
    const t = setTimeout(() => setPendingReset(null), 3000);
    return () => clearTimeout(t);
  }, [pendingReset]);

  const groupState = (groupSessions: string[]): "all" | "some" | "none" => {
    const active = groupSessions.filter((s) => sessionFilters.includes(s)).length;
    if (active === groupSessions.length) return "all";
    if (active === 0) return "none";
    return "some";
  };

  const toggleGroupSessions = (groupSessions: string[]) => {
    const state = groupState(groupSessions);
    setSessionFilters((prev) =>
      state === "none"
        ? [...new Set([...prev, ...groupSessions])]
        : prev.filter((s) => !groupSessions.includes(s))
    );
  };

  const toggleGroupExpand = (name: string) => {
    setExpandedGroups((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]
    );
  };

  useEffect(() => { setShuffled(true); }, [setShuffled]);

  // Switching language swaps in that language's remembered filters and closes
  // any open text; the scheme falls back per-language via schemeByLang.
  const selectLanguage = (code: string) => {
    if (code === langCode) return;
    setSessionFilters(settings.filtersByLang[code] ?? []);
    setExpandedGroups([]);
    setSettings((s) => ({ ...s, lang: code, readingId: null }));
  };

  // ── Sheet animation ───────────────────────────────────────────────────────
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const openSheet = useCallback(() => {
    setContextOpen(true);
    Animated.timing(sheetAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [sheetAnim]);

  const closeSheet = useCallback(() => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
      setContextOpen(false)
    );
  }, [sheetAnim]);

  useEffect(() => { sheetAnim.setValue(0); }, []); // eslint-disable-line

  useEffect(() => { if (contextOpen) closeSheet(); }, [idx]); // eslint-disable-line

  // ── Sidebar slide animation ───────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: sidebarOpen ? 0 : 300,  // matches sidebar width
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [sidebarOpen]); // eslint-disable-line

  // ── 3D flip animation ─────────────────────────────────────────────────────
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: flipped ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  }, [flipped, flipAnim]);

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });

  // ── FlatList carousel ─────────────────────────────────────────────────────
  const flatListRef = useRef<FlatList<Card>>(null);

  const wrappedData = deck.length > 0
    ? [deck[deck.length - 1], ...deck, deck[0]]
    : [];

  useEffect(() => {
    flatListRef.current?.scrollToOffset({ offset: (idx + 1) * W, animated: false });
  }, [deck]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMomentumScrollEnd = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const rawIdx = Math.round(e.nativeEvent.contentOffset.x / W);
    const len = deck.length;

    flipAnim.setValue(0);

    if (rawIdx === 0) {
      flatListRef.current?.scrollToOffset({ offset: len * W, animated: false });
      goImmediate(-1);
    } else if (rawIdx === len + 1) {
      flatListRef.current?.scrollToOffset({ offset: W, animated: false });
      goImmediate(1);
    } else {
      const newRealIdx = rawIdx - 1;
      const delta = newRealIdx - idx;
      if (delta !== 0) goImmediate(delta);
    }
  }, [deck.length, idx, goImmediate, flipAnim]);

  const extraData = useMemo(
    () => ({ idx, flipped, acipVisible, dark, speaking }),
    [idx, flipped, acipVisible, dark, speaking]
  );

  const renderItem = ({ item, index: wrappedIdx }: { item: Card; index: number }) => {
    const isCurrent = wrappedIdx === idx + 1;
    const itemStatus = getCardStatus(item);
    const itemRating = RATING_CONFIG[itemStatus];

    return (
      <View style={{ width: W, paddingHorizontal: 24, height: CARD_BASE }}>
      <View style={{ flex: 1 }}>

        {/* Front */}
        <Animated.View
          style={[
            s.face,
            { backgroundColor: c.card, borderColor: c.border },
            { transform: [{ perspective: 1200 }, { rotateY: frontRotate }] },
          ]}
          pointerEvents={isCurrent && !flipped ? "auto" : "none"}
        >
          <Text style={[s.sessionBadge, { color: c.faint }]}>{item.session}</Text>
          <Pressable
            style={s.cardPressable}
            onPress={() => isCurrent && handleCardClick()}
          >
            {item.prompt ? (
              <>
                <Text style={[s.promptText, { color: c.ink }]}>{item.prompt}</Text>
                {item.subcategory ? (
                  <Text style={[s.contextLabel, { color: c.muted }]}>{item.subcategory}</Text>
                ) : null}
                <Text style={[s.tibetanToggle, { color: c.ink, opacity: acipVisible ? 1 : 0 }]}>
                  {item.script}
                </Text>
              </>
            ) : (
              <>
                <Text style={[s.tibetan, { color: c.ink }]}>{item.script}</Text>
                {item.subcategory ? (
                  <Text style={[s.contextLabel, { color: c.muted }]}>{item.subcategory}</Text>
                ) : null}
                <Text style={[s.acipInline, { color: c.ink, opacity: acipVisible ? 1 : 0 }]}>
                  {item.translit}
                </Text>
              </>
            )}
          </Pressable>
          <TouchableOpacity
            style={[s.speakBtn, { backgroundColor: c.raised, borderColor: c.border }]}
            onPress={() => speak(item.script)}
            disabled={!isCurrent || speaking}
          >
            <Text style={[s.speakBtnText, { color: c.muted, opacity: speaking ? 0.5 : 1 }]}>
              {speaking ? "…" : "♪"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.acipIconBtn, { backgroundColor: c.raised, borderColor: c.border }]}
            onPress={toggleAcip}
            disabled={!isCurrent}
          >
            <Ionicons name="language" size={17} color={acipVisible ? c.ink : c.muted} />
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
          pointerEvents={isCurrent && flipped ? "auto" : "none"}
        >
          <Text style={[s.sessionBadge, { color: c.faint }]}>{item.session}</Text>
          <TouchableOpacity
            activeOpacity={1}
            style={s.cardPressable}
            onPress={() => isCurrent && handleCardClick()}
          >
            <View style={s.backCenter}>
              {item.translit ? (
                <Text style={[s.acipBack, { color: c.ink }]}>{item.translit}</Text>
              ) : null}
              <Text style={[s.meaning, { color: c.ink }]}>{item.meaning}</Text>
            </View>
            <TouchableOpacity
              style={[s.ratingCornerBtn, { backgroundColor: c.raised, borderColor: c.border }]}
              onPress={() => rateCard(RATING_NEXT[itemStatus])}
              disabled={!isCurrent}
            >
              <Text style={s.ratingIcon}>{itemRating.icon}</Text>
              <Text style={[s.ratingLabel, { color: itemRating.color }]}>{itemRating.label}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>

      </View>
      </View>
    );
  };

  // ── Context ───────────────────────────────────────────────────────────────
  const hasContext = card && (card.notes || card.context || card.context_script);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />

      {/* Header — shows the text title + back arrow while reading */}
      <View style={s.header}>
        {readingText ? (
          <Text style={{ fontSize: 20, color: c.ink, flex: 1 }} numberOfLines={1}>{readingText.title}</Text>
        ) : (
          <Text style={[s.logo, { color: c.ink }]}>༄༅།</Text>
        )}
        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.gearBtn}
            onPress={() => setSidebarOpen((o) => !o)}
          >
            <Ionicons name={sidebarOpen ? "close-outline" : "settings-outline"} size={22} color={c.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main — a text is its own screen; otherwise the deck */}
      {readingText ? (
        <Reader key={readingText.id} text={readingText} lang={LANGUAGE_BY_CODE[readingText.language] ?? lang} scheme={activeScheme} c={c} />
      ) : (
      <View style={s.cardArea}>
        {total === 0 && (
          <Text style={[s.empty, { color: c.muted }]}>No cards match this filter.</Text>
        )}
        {total > 0 && (
          <View style={{ height: CARD_BASE }}>
            <FlatList
              ref={flatListRef}
              data={wrappedData}
              keyExtractor={(item, index) => `${index}-${item.translit}`}
              renderItem={renderItem}
              extraData={extraData}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onMomentumScrollEnd={onMomentumScrollEnd}
              getItemLayout={(_, index) => ({ length: W, offset: index * W, index })}
              initialScrollIndex={1}
              style={{ flex: 1 }}
            />
          </View>
        )}
      </View>
      )}

      {/* Sidebar overlay */}
      <Animated.View
        style={[s.overlay, { opacity: slideAnim.interpolate({ inputRange: [0, 300], outputRange: [1, 0] }) }]}
        pointerEvents={sidebarOpen ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSidebarOpen(false)} />
      </Animated.View>

      {/* Sidebar */}
      <Animated.View
        style={[s.sidebar, { backgroundColor: c.sheet, borderLeftColor: c.border }, { transform: [{ translateX: slideAnim }] }]}
        pointerEvents={sidebarOpen ? "auto" : "none"}
      >
          <ScrollView showsVerticalScrollIndicator={false}>

            <Text style={[s.sidebarTitle, { color: c.ink }]}>Flashcards</Text>

            <Text style={[s.sidebarLabel, { color: c.faint }]}>Language</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              {LANGUAGES.map((l) => {
                const on = l.code === langCode;
                return (
                  <TouchableOpacity
                    key={l.code}
                    onPress={() => selectLanguage(l.code)}
                    style={[s.btn, s.sessionBtn, { backgroundColor: c.card, borderColor: on ? c.accent : c.border }]}
                  >
                    <Text style={[s.btnText, { color: on ? c.accent : c.ink }]}>{l.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {lang.schemes.length > 1 && (
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                <Text style={{ fontSize: 12, color: c.faint }}>Romanization</Text>
                {lang.schemes.map((sc) => {
                  const on = sc.id === activeScheme;
                  return (
                    <TouchableOpacity
                      key={sc.id}
                      onPress={() => setScheme(sc.id)}
                      style={[s.btn, s.sessionBtn, { paddingVertical: 5, backgroundColor: c.card, borderColor: on ? c.accent : c.border }]}
                    >
                      <Text style={{ fontSize: 12, fontFamily: "Menlo", color: on ? c.accent : c.muted }}>{sc.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={[s.sidebarLabel, { color: c.faint, marginTop: 24 }]}>Studying</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
              <TouchableOpacity
                onPress={() => setReadingText(null)}
                style={[s.btn, { flex: 1, alignItems: "center", backgroundColor: c.card, borderColor: !readingText ? c.accent : c.border }]}
              >
                <Text style={[s.btnText, { color: !readingText ? c.accent : c.ink }]}>Cards</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={lang.texts.length === 0}
                onPress={() => { if (!readingText && lang.texts.length) setReadingText(lang.texts[0]); }}
                style={[s.btn, { flex: 1, alignItems: "center", backgroundColor: c.card, borderColor: readingText ? c.accent : c.border, opacity: lang.texts.length === 0 ? 0.4 : 1 }]}
              >
                <Text style={[s.btnText, { color: readingText ? c.accent : (lang.texts.length === 0 ? c.faint : c.ink) }]}>Text</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.sidebarLabel, { color: c.faint, marginTop: 24 }]}>Cards</Text>
            {Object.entries(lang.sessionGroups).map(([groupName, groupSessions]) => {
              const state = groupState(groupSessions);
              const expanded = expandedGroups.includes(groupName);
              const checkIcon = state === "all" ? "checkbox" : state === "some" ? "remove-circle" : "square-outline";
              const checkColor = state === "none" ? c.border : c.accent;
              return (
                <View key={groupName} style={{ marginBottom: 4 }}>
                  <View style={[s.groupRow, { borderColor: c.border }]}>
                    <TouchableOpacity onPress={() => toggleGroupSessions(groupSessions)} hitSlop={8}>
                      <Ionicons name={checkIcon as any} size={18} color={checkColor} />
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }} onPress={() => toggleGroupExpand(groupName)}>
                      <Text style={[s.groupLabel, { color: c.ink }]}>{groupName}</Text>
                      <Ionicons name={expanded ? "chevron-down" : "chevron-forward"} size={12} color={c.faint} />
                    </TouchableOpacity>
                  </View>
                  {expanded && groupSessions.map((sess) => {
                    const active = sessionFilters.includes(sess);
                    return (
                      <View key={sess} style={s.subSessionRow}>
                        <TouchableOpacity onPress={() => setSessionFilters((prev) =>
                          prev.includes(sess) ? prev.filter((x) => x !== sess) : [...prev, sess]
                        )} style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                          <Ionicons name={active ? "checkbox-outline" : "square-outline"} size={15} color={active ? c.accent : c.border} />
                          <Text style={[s.subSessionText, { color: c.inkMid }]}>{sess}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          hitSlop={10}
                          onPress={() => {
                            if (pendingReset === sess) { resetSession(sess); setPendingReset(null); }
                            else setPendingReset(sess);
                          }}
                        >
                          <Ionicons name="refresh-outline" size={13} color={pendingReset === sess ? "#f87171" : c.border} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {totalFiltered > 0 && (
              <>
                <View style={[s.progressWrap, { marginTop: 8 }]}>
                  <View style={{ flex: knownCount,    backgroundColor: "#639922" }} />
                  <View style={{ flex: familiarCount, backgroundColor: "#d97706" }} />
                  <View style={{ flex: reviewCount,   backgroundColor: c.border }} />
                </View>
                <Text style={[s.progressLabel, { color: c.muted }]}>
                  <Text style={{ color: "#4a7a19" }}>{knownCount} known</Text>
                  {" · "}
                  <Text style={{ color: "#b45309" }}>{familiarCount} familiar</Text>
                  {" · "}
                  {reviewCount} review
                </Text>
              </>
            )}

            {lang.texts.length > 0 && (<>
              <Text style={[s.sidebarLabel, { color: c.faint, marginTop: 24 }]}>Texts</Text>
              {lang.texts.map((t) => {
                const active = readingText?.id === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}
                    onPress={() => { setReadingText(t); setSidebarOpen(false); }}
                  >
                    <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={14} color={active ? c.accent : c.border} />
                    <Text style={{ fontSize: 14, fontFamily: "Menlo", color: active ? c.accent : c.ink, flex: 1 }}>{textTitle(t, lang, activeScheme)}</Text>
                  </TouchableOpacity>
                );
              })}
            </>)}

            <Text style={[s.sidebarLabel, { color: c.faint, marginTop: 24 }]}>Appearance</Text>
            <TouchableOpacity
              style={[s.btn, s.sessionBtn, { backgroundColor: c.card, borderColor: c.border }]}
              onPress={() => setSettings((s) => ({ ...s, dark: !s.dark }))}
            >
              <Text style={[s.btnText, { color: c.ink }]}>{dark ? "Light mode" : "Dark mode"}</Text>
            </TouchableOpacity>
          </ScrollView>
      </Animated.View>

      {!readingText && (<>
      {/* Sheet overlay */}
      <Animated.View
        style={[s.sheetOverlay, { opacity: sheetAnim }]}
        pointerEvents={contextOpen ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={closeSheet} />
      </Animated.View>

      {/* Context bottom sheet */}
      <Animated.View
        style={[
          s.sheet,
          { backgroundColor: c.sheet, borderColor: c.border },
          { transform: [{ translateY: sheetAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [SHEET_HEIGHT - PEEK_HEIGHT, 0],
          }) }] },
        ]}
      >
        <TouchableOpacity
          style={s.sheetHeader}
          onPress={hasContext ? (contextOpen ? closeSheet : openSheet) : undefined}
          disabled={!hasContext}
          activeOpacity={0.7}
        >
          <Text style={[s.sheetHeaderLabel, { color: hasContext ? c.faint : c.border }]}>
            {hasContext ? "notes" : "no notes"}
          </Text>
        </TouchableOpacity>
        <ScrollView style={s.sheetScroll} showsVerticalScrollIndicator={false}>
          <TouchableOpacity activeOpacity={1} onPress={contextOpen ? closeSheet : undefined}>
            {card?.notes && (
              <View style={[s.sheetBar, { borderLeftColor: c.border }]}>
                <Text style={[s.sheetText, { color: c.inkMid }]}>{card.notes}</Text>
              </View>
            )}
            {card?.context && (
              <View style={[s.sheetBar, { borderLeftColor: c.border,
                                           marginTop: card?.notes ? 16 : 0 }]}>
                <Text style={[s.sheetText, { color: c.inkMid }]}>{card.context}</Text>
              </View>
            )}
            {card?.context_script && (
              <View style={[s.sheetBar, { borderLeftColor: c.border,
                                           marginTop: (card?.notes || card?.context) ? 12 : 0 }]}>
                <HighlightedTibetan text={card.context_script} term={card?.translit ?? ""} color={c.faint} />
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
      </>)}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:               { flex: 1 },
  header:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  logo:               { fontSize: 36, lineHeight: 44 },
  title:              { fontFamily: "Georgia", fontSize: 18, letterSpacing: 0.3 },
  headerRight:        { flexDirection: "row", alignItems: "center", gap: 10 },
  gearBtn:            { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  cardArea:           { flex: 1, justifyContent: "center", paddingBottom: PEEK_HEIGHT },
  empty:              { textAlign: "center", fontStyle: "italic", fontSize: 15, paddingHorizontal: 16 },
  face:               { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, borderWidth: 0.5, padding: 20, alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden", overflow: "hidden" },
  cardPressable:      { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  sessionBadge:       { position: "absolute", top: 14, right: 16, fontSize: 11, letterSpacing: 0.6 },
  tibetan:            { fontSize: 52, lineHeight: 78, letterSpacing: 1, textAlign: "center" },
  promptText:         { fontFamily: "Georgia", fontSize: 20, fontStyle: "italic", textAlign: "center", lineHeight: 28, marginBottom: 8 },
  tibetanToggle:      { fontSize: 36, lineHeight: 54, letterSpacing: 1, textAlign: "center", marginTop: 4 },
  contextLabel:       { fontFamily: "Georgia", fontSize: 12, fontStyle: "italic", textAlign: "center", marginTop: 2, marginBottom: 2 },
  acipInline:         { fontFamily: "Courier New", fontSize: 16, letterSpacing: 1, marginTop: 6, textAlign: "center" },
  acipIconBtn:        { position: "absolute", bottom: 12, right: 12, width: 30, height: 30, borderRadius: 8, borderWidth: 0.5, alignItems: "center", justifyContent: "center" },
  speakBtn:           { borderWidth: 0.5, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginTop: 8 },
  speakBtnText:       { fontSize: 13 },
  // Back face
  backCenter:         { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  acipBack:           { fontFamily: "Courier New", fontSize: 13, letterSpacing: 1, marginBottom: 10, textAlign: "center" },
  meaning:            { fontSize: 20, fontStyle: "italic", textAlign: "center", marginBottom: 8, lineHeight: 28 },
  notes:              { fontSize: 14, fontStyle: "italic", textAlign: "center", lineHeight: 22 },
  // Rating corner button
  ratingCornerBtn:    { position: "absolute", top: 0, left: 0, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 0.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  ratingIcon:         { fontSize: 14 },
  ratingLabel:        { fontSize: 12 },
  // Bottom sheet
  sheetOverlay:       { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)", zIndex: 150 },
  sheet:              { position: "absolute", bottom: 0, left: 0, right: 0, height: SHEET_HEIGHT, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5, paddingHorizontal: 20, paddingBottom: 32, zIndex: 160 },
  sheetHeader:        { height: PEEK_HEIGHT, justifyContent: "center", alignItems: "center" },
  sheetHeaderLabel:   { fontSize: 15, fontStyle: "italic", fontFamily: "Georgia" },
  sheetScroll:        { flex: 1 },
  sheetBar:           { borderLeftWidth: 2, paddingLeft: 12, marginBottom: 4 },
  sheetText:          { fontSize: 15, fontStyle: "italic", lineHeight: 22 },
  sheetTibetan:       { fontFamily: "Courier New", fontSize: 13, lineHeight: 20, letterSpacing: 0.6 },
  sheetTibetanHighlight: { backgroundColor: "#f5e97a", color: "#1a1a18" },
  // Sidebar
  overlay:            { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.2)", zIndex: 100 },
  sidebar:            { position: "absolute", top: 0, right: 0, bottom: 0, width: 300, borderLeftWidth: 0.5, padding: 24, paddingTop: 56, zIndex: 200 },
  sidebarTitle:       { fontFamily: "Georgia", fontSize: 20, letterSpacing: 0.3, marginBottom: 20 },
  sidebarLabel:       { fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  btn:                { borderWidth: 0.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 5 },
  sessionBtn:         { alignSelf: "stretch", marginBottom: 6 },
  btnText:            { fontSize: 15 },
  progressWrap:       { height: 4, borderRadius: 2, overflow: "hidden", marginBottom: 8, flexDirection: "row" },
  progressLabel:      { fontSize: 13, fontStyle: "italic" },
  groupRow:           { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  groupLabel:         { fontSize: 15, fontFamily: "Georgia", fontWeight: "500", flex: 1 },
  subSessionRow:      { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, paddingLeft: 28 },
  subSessionText:     { fontSize: 13, lineHeight: 18, flex: 1 },
});
