import { Ionicons } from "@expo/vector-icons";
import { IBMPlexSansArabic_400Regular, IBMPlexSansArabic_600SemiBold } from "@expo-google-fonts/ibm-plex-sans-arabic";
import { ReadexPro_600SemiBold, ReadexPro_700Bold } from "@expo-google-fonts/readex-pro";
import { useFonts } from "expo-font";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, BackHandler, I18nManager, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Celebration, { Party } from "./src/Celebration";
import { Cache, DEFAULT_ROADMAP, EMPTY_PROGRESS, Item, loadCache, loadManual, loadSeen, Manual, saveManual, saveSeen, sync } from "./src/data";
import { compute, itemXp } from "./src/game";
import { getToken, verifyToken } from "./src/github";
import { PyProvider } from "./src/PyRunner";
import Editor from "./src/screens/Editor";
import Badges from "./src/screens/Badges";
import Home from "./src/screens/Home";
import MapScreen from "./src/screens/MapScreen";
import Tools from "./src/screens/Tools";
import { C } from "./src/theme";
import { T } from "./src/ui";

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const TABS: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "الرئيسية", icon: "home" },
  { label: "الخريطة", icon: "map" },
  { label: "الشارات", icon: "trophy" },
  { label: "الأدوات", icon: "construct" },
];

export default function App() {
  const [fontsLoaded] = useFonts({
    ReadexPro_600SemiBold, ReadexPro_700Bold, IBMPlexSansArabic_400Regular, IBMPlexSansArabic_600SemiBold,
    ...Ionicons.font,
  });
  const [cache, setCache] = useState<Cache>({ roadmap: DEFAULT_ROADMAP, progress: EMPTY_PROGRESS, syncedAt: null });
  const [manual, setManual] = useState<Manual>({});
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const [openPhase, setOpenPhase] = useState<number | null>(null);
  const [party, setParty] = useState<Party | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [toolsTab, setToolsTab] = useState(0);
  const seenRef = useRef<string[] | null>(null);
  const manualRef = useRef<Manual>({});
  const lastSync = useRef(0);

  const game = useMemo(() => compute(cache.roadmap, cache.progress, manual), [cache, manual]);

  const doSync = useCallback(async () => {
    if (Date.now() - lastSync.current < 5000) return;
    lastSync.current = Date.now();
    setSyncing(true);
    try {
      const fresh = await sync();
      setError(null);
      const auto = Object.entries(fresh.progress.items).filter(([, v]) => v.done).map(([k]) => k);
      const seen = seenRef.current;
      if (seen !== null) {
        const fresh_ids = auto.filter((id) => !seen.includes(id) && !manualRef.current[id]);
        if (fresh_ids.length) {
          const before = { ...fresh.progress, items: { ...fresh.progress.items } };
          fresh_ids.forEach((id) => { before.items[id] = { ...before.items[id], done: false }; });
          const oldG = compute(fresh.roadmap, before, manualRef.current);
          const newG = compute(fresh.roadmap, fresh.progress, manualRef.current);
          const titles = newG.items.filter((i) => fresh_ids.includes(i.id)).map((i) => i.title);
          setParty({
            xp: newG.xp - oldG.xp,
            titles,
            levelName: newG.level > oldG.level ? newG.levelName : null,
            badges: newG.badges.filter((b) => b.earned && !oldG.badges.find((o) => o.id === b.id)?.earned).map((b) => b.title),
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
      seenRef.current = auto;
      saveSeen(auto);
      setCache(fresh);
    } catch (e: any) {
      setError(e?.name === "AbortError" ? "انتهت المهلة، تحقق من الإنترنت" : "تحقق من الإنترنت ثم اسحب للتحديث");
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [c, m, seen, t] = await Promise.all([loadCache(), loadManual(), loadSeen(), getToken()]);
      if (t) {
        setTokenState(t);
        setLogin("ayachzawi");
        verifyToken(t).then(setLogin).catch(() => {});
      }
      setCache(c);
      setManual(m);
      manualRef.current = m;
      seenRef.current = seen;
      setReady(true);
      doSync();
    })();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") doSync(); });
    return () => sub.remove();
  }, [doSync]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (editing) { setEditing(null); return true; }
      if (party) { setParty(null); return true; }
      if (tab === 1 && openPhase !== null) { setOpenPhase(null); return true; }
      if (tab !== 0) { setTab(0); return true; }
      return false;
    });
    return () => sub.remove();
  }, [tab, openPhase, party, editing]);

  const toggle = useCallback((id: string) => {
    setManual((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else {
        next[id] = new Date().toISOString();
        const item = cache.roadmap.phases.flatMap((p) => p.items).find((i) => i.id === id);
        if (item) {
          setToast(`+${itemXp(item, cache.roadmap)} XP`);
          setTimeout(() => setToast(null), 1500);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      manualRef.current = next;
      saveManual(next);
      return next;
    });
  }, [cache.roadmap]);

  if (!fontsLoaded || !ready) {
    return (
      <View style={[st.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={C.acc} size="large" />
      </View>
    );
  }

  const openPhaseFromHome = (i: number) => { setOpenPhase(i); setTab(1); };
  const afterSubmit = () => {
    // GitHub يحتاج قرابة دقيقة ليصحّح ويحدّث progress.json
    [50000, 90000, 150000].forEach((ms) => setTimeout(() => { lastSync.current = 0; doSync(); }, ms));
  };
  const needToken = () => { setEditing(null); setToolsTab(2); setTab(3); };

  return (
    <SafeAreaProvider>
      <PyProvider>
      <StatusBar style="light" />
      <SafeAreaView style={st.root} edges={["top", "left", "right"]}>
        <View style={{ flex: 1 }}>
          {tab === 0 && (
            <Home rm={cache.roadmap} progress={cache.progress} game={game} syncing={syncing} syncedAt={cache.syncedAt}
              error={error} onSync={() => { lastSync.current = 0; doSync(); }} onToggle={toggle} onOpenPhase={openPhaseFromHome} onEdit={setEditing} />
          )}
          {tab === 1 && (
            <MapScreen rm={cache.roadmap} progress={cache.progress} manual={manual} game={game}
              open={openPhase} onOpen={setOpenPhase} onToggle={toggle} onEdit={setEditing} />
          )}
          {tab === 2 && <Badges game={game} />}
          {tab === 3 && (
            <Tools key={toolsTab} rm={cache.roadmap} login={login} initialTab={toolsTab}
              onTokenChange={(t, who) => { setTokenState(t); setLogin(who); }} />
          )}
        </View>
        {toast ? (
          <View style={st.toast} pointerEvents="none"><T font="title" size={18} color={C.bg}>{toast}</T></View>
        ) : null}
      </SafeAreaView>
      <SafeAreaView edges={["bottom"]} style={st.tabbar}>
        <View style={{ flexDirection: "row" }}>
          {TABS.map((t, i) => (
            <Pressable key={t.label} style={st.tab} onPress={() => { if (i === 3) setToolsTab(0); setTab(i); if (i === 1 && tab === 1) setOpenPhase(null); }}
              android_ripple={{ color: "rgba(255,255,255,0.08)", borderless: true }}>
              <Ionicons name={(tab === i ? t.icon : `${t.icon}-outline`) as any} size={24} color={tab === i ? C.acc : C.mut} />
              <T size={11} font={tab === i ? "bold" : "body"} color={tab === i ? C.acc : C.mut} style={{ lineHeight: 16 }}>{t.label}</T>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
      <Celebration party={party} onClose={() => setParty(null)} />
      {editing ? (
        <Editor item={editing} status={cache.progress.items[editing.id]} token={token}
          onClose={() => setEditing(null)} onSubmitted={afterSubmit} onNeedToken={needToken} />
      ) : null}
      </PyProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  tabbar: { backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8, gap: 2, minHeight: 58 },
  toast: { position: "absolute", bottom: 20, alignSelf: "center", backgroundColor: C.gold, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 99 },
});
