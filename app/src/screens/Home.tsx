import { Ionicons } from "@expo/vector-icons";
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { howVerified, itemLink, Progress, Roadmap } from "../data";
import { Game, itemXp, timeAgo } from "../game";
import { C, PAD } from "../theme";
import { Bar, Btn, Card, Chip, SectionTitle, T } from "../ui";

type Props = {
  rm: Roadmap; progress: Progress; game: Game; syncing: boolean; syncedAt: string | null; error: string | null;
  onSync: () => void; onToggle: (id: string) => void; onOpenPhase: (i: number) => void;
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "صباح الخير" : h < 18 ? "مساء النور" : "مساء الخير";
}

export default function Home({ rm, progress, game, syncing, syncedAt, error, onSync, onToggle, onOpenPhase }: Props) {
  const g = game;
  const span = g.nextLevelAt ? g.nextLevelAt - g.levelFloor : 1;
  const into = g.nextLevelAt ? (g.xp - g.levelFloor) / span : 1;
  const next = g.next;
  const status = next ? progress.items[next.id] : undefined;
  const link = next ? itemLink(next) : null;

  return (
    <ScrollView
      contentContainerStyle={{ padding: PAD, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={syncing} onRefresh={onSync} tintColor={C.acc} colors={[C.cobalt]} progressBackgroundColor={C.surface} />}
    >
      <T size={15} color={C.mut}>{greeting()} يا عياش</T>
      <T size={30} font="title" style={{ lineHeight: 42 }}>رحلة البرمجة</T>

      <Card style={{ marginTop: 18, backgroundColor: C.cobalt, borderColor: C.cobalt }}>
        <View style={st.row}>
          <View style={{ flex: 1 }}>
            <T size={13} color="#C9D4FF">المستوى {g.level}</T>
            <T size={26} font="title" color="#fff" style={{ lineHeight: 36 }}>{g.levelName}</T>
          </View>
          <View style={st.xpBox}>
            <T size={24} font="title" color={C.gold} style={{ lineHeight: 30 }}>{g.xp}</T>
            <T size={12} color="#C9D4FF" style={{ lineHeight: 16 }}>XP</T>
          </View>
        </View>
        <View style={{ marginTop: 14 }}>
          <Bar value={into} color={C.gold} track="rgba(255,255,255,0.2)" height={10} />
          <T size={12} color="#C9D4FF" style={{ marginTop: 6 }}>
            {g.nextLevelAt ? `باقي ${g.nextLevelAt - g.xp} XP للمستوى التالي` : "وصلت أعلى مستوى"}
          </T>
        </View>
      </Card>

      <View style={[st.row, { gap: 12, marginTop: 12 }]}>
        <Card style={st.stat}>
          <Ionicons name="flame" size={26} color={g.streak ? C.flame : C.line} />
          <T size={26} font="title" style={{ lineHeight: 34 }}>{g.streak}</T>
          <T size={12} color={C.mut}>{g.streak === 1 ? "يوم متتالي" : "أيام متتالية"}</T>
        </Card>
        <Card style={st.stat}>
          <Ionicons name="pie-chart" size={24} color={C.acc} />
          <T size={26} font="title" style={{ lineHeight: 34 }}>{g.pct}%</T>
          <T size={12} color={C.mut}>من الخريطة</T>
        </Card>
        <Card style={st.stat}>
          <Ionicons name="checkmark-done" size={24} color={C.ok} />
          <T size={26} font="title" style={{ lineHeight: 34 }}>{g.testsPassed}</T>
          <T size={12} color={C.mut}>تمارين ناجحة</T>
        </Card>
      </View>

      <Card style={{ marginTop: 12 }}>
        <View style={[st.row, { justifyContent: "space-between" }]}>
          {g.week.map((d, i) => (
            <View key={i} style={{ alignItems: "center", gap: 6 }}>
              <View style={[st.dot, d.active && st.dotOn, d.today && !d.active && st.dotToday]}>
                {d.active ? <Ionicons name="flame" size={16} color="#fff" /> : null}
              </View>
              <T size={12} color={d.today ? C.ink : C.mut} font={d.today ? "bold" : "body"}>{d.label}</T>
            </View>
          ))}
        </View>
        <T size={13} color={g.activeToday ? C.ok : C.mut} style={{ marginTop: 10 }}>
          {g.activeToday ? "اشتغلت اليوم، السلسلة محفوظة" : g.streak ? "ارفع شيئاً اليوم لتحافظ على السلسلة" : "ابدأ سلسلتك اليوم بأول commit"}
        </T>
      </Card>

      <SectionTitle>مهمتك التالية</SectionTitle>
      {next ? (
        <Card style={{ borderColor: C.acc }}>
          <View style={[st.row, { gap: 8, flexWrap: "wrap" }]}>
            <Chip label={`المرحلة ${next.phaseIndex} · ${next.phase.short}`} />
            <Chip label={`+${itemXp(next, rm)} XP`} color={C.gold} icon="star" />
          </View>
          <T size={19} font="semi" style={{ marginTop: 12, lineHeight: 30 }}>{next.title}</T>
          <T size={13} color={C.mut} style={{ marginTop: 6 }}>{howVerified(next)}</T>
          {status && !status.done && status.detail && next.check.type !== "manual" ? (
            <T size={13} color={C.gold} style={{ marginTop: 4 }}>الحالة: {status.detail}</T>
          ) : null}
          <View style={{ gap: 10, marginTop: 16 }}>
            {next.check.type === "manual" ? (
              <Btn label="أنهيتها" icon="checkmark-circle" onPress={() => onToggle(next.id)} />
            ) : link ? (
              <Btn label={next.check.type === "tests" ? "افتح التمرين على GitHub" : "افتح على GitHub"} icon="logo-github" onPress={() => Linking.openURL(link)} />
            ) : null}
            <Btn kind="ghost" label="عرض المرحلة كاملة" icon="map" onPress={() => onOpenPhase(next.phaseIndex)} />
          </View>
        </Card>
      ) : (
        <Card><T size={17} font="semi">أنهيت الخريطة كلها. أنت مبرمج حقيقي الآن.</T></Card>
      )}

      <View style={[st.row, { marginTop: 24, justifyContent: "space-between" }]}>
        <T size={12} color={error ? C.danger : C.mut} style={{ flex: 1 }}>
          {error ? `تعذّرت المزامنة: ${error}` : `آخر مزامنة مع GitHub: ${timeAgo(syncedAt)}`}
        </T>
        <T size={12} color={C.mut}>{progress.commits} commits</T>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  xpBox: { alignItems: "center", backgroundColor: "rgba(0,0,0,0.22)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  stat: { flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 6 },
  dot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  dotOn: { backgroundColor: C.flame, borderColor: C.flame },
  dotToday: { borderColor: C.acc, borderStyle: "dashed" },
});
