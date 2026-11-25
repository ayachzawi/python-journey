import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { howVerified, itemLink, Manual, Progress, Roadmap } from "../data";
import { Game, itemXp } from "../game";
import { C, PAD } from "../theme";
import { Bar, Btn, Card, Chip, SectionTitle, T } from "../ui";

type Props = {
  rm: Roadmap; progress: Progress; manual: Manual; game: Game;
  open: number | null; onOpen: (i: number | null) => void; onToggle: (id: string) => void;
};

export default function MapScreen(props: Props) {
  return props.open === null ? <Overview {...props} /> : <PhaseDetail {...props} index={props.open} />;
}

function Overview({ rm, game, onOpen }: Props) {
  return (
    <ScrollView contentContainerStyle={{ padding: PAD, paddingBottom: 40 }}>
      <T size={30} font="title" style={{ lineHeight: 42 }}>الخريطة</T>
      <T size={14} color={C.mut}>8 مراحل بلغتين فقط: Python وTypeScript، ومعهما SQL.</T>
      <View style={{ marginTop: 22 }}>
        {rm.phases.map((p, i) => {
          const pct = game.phasePct[i] ?? 0;
          const full = pct === 100;
          const current = i === game.currentPhase;
          const later = i > game.currentPhase;
          const last = i === rm.phases.length - 1;
          return (
            <Pressable key={p.id} onPress={() => onOpen(i)} style={st.node}>
              <View style={st.rail}>
                <View style={[st.circle, full && st.circleFull, current && st.circleCur]}>
                  {full ? <Ionicons name="checkmark" size={22} color="#fff" />
                    : later ? <Ionicons name="lock-closed" size={16} color={C.mut} />
                    : <T font="title" size={17} style={{ lineHeight: 22 }}>{i}</T>}
                </View>
                {!last ? <View style={[st.line, full && { backgroundColor: C.acc }]} /> : null}
              </View>
              <Card style={[{ flex: 1, marginBottom: 14 }, current && { borderColor: C.acc }, later && { opacity: 0.6 }]}>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Chip label={`المرحلة ${i}`} color={current ? C.acc : C.mut} />
                  {current ? <Chip label="أنت هنا" color={C.gold} icon="location" /> : null}
                </View>
                <T size={17} font="semi" style={{ marginTop: 8, lineHeight: 26 }}>{p.title}</T>
                <T size={12} color={C.mut} style={{ marginBottom: 10 }}>{p.weeks === 1 ? "أسبوع واحد" : `${p.weeks} أسابيع`} · {p.items.length} خطوة</T>
                <Bar value={pct / 100} color={full ? C.ok : C.acc} />
                <T size={12} color={C.mut} style={{ marginTop: 6 }}>{pct}%</T>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function PhaseDetail({ rm, progress, manual, game, index, onOpen, onToggle }: Props & { index: number }) {
  const p = rm.phases[index];
  if (!p) return null;
  const groups: [string, typeof p.items][] = [
    ["ما ستتعلمه", p.items.filter((i) => i.kind === "topic")],
    ["مشروع المرحلة", p.items.filter((i) => i.kind === "project")],
    ["تمرين مراجعة الكود", p.items.filter((i) => i.kind === "review")],
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: PAD, paddingBottom: 40 }}>
      <Pressable onPress={() => onOpen(null)} style={st.back} hitSlop={10}>
        <Ionicons name="arrow-forward" size={20} color={C.acc} />
        <T color={C.acc} font="bold">كل المراحل</T>
      </Pressable>
      <T size={13} color={C.acc} font="bold" style={{ marginTop: 10 }}>المرحلة {index} · {game.phasePct[index]}%</T>
      <T size={26} font="title" style={{ lineHeight: 36 }}>{p.title}</T>
      <T size={14} color={C.mut} style={{ marginTop: 4 }}>{p.goal}</T>

      {groups.map(([title, list]) => list.length ? (
        <View key={title}>
          <SectionTitle>{title}</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {list.map((it, k) => {
              const status = progress.items[it.id];
              const auto = !!status?.done;
              const done = auto || !!manual[it.id];
              const manualType = it.check.type === "manual";
              const link = itemLink(it);
              return (
                <View key={it.id} style={[st.item, k > 0 && st.itemBorder]}>
                  <Pressable
                    disabled={!manualType}
                    onPress={() => onToggle(it.id)}
                    hitSlop={8}
                    style={[st.check, done && st.checkOn, !manualType && !done && { borderStyle: "dashed" }]}
                  >
                    {done ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <T size={15} font={done ? "body" : "bold"} color={done ? C.mut : C.ink} style={{ lineHeight: 24 }}>{it.title}</T>
                    <T size={12} color={C.mut} style={{ marginTop: 2 }}>
                      {auto ? "تحقق منها GitHub تلقائياً" : done ? "أشّرت عليها بنفسك" : howVerified(it)}
                    </T>
                    {!done && status?.detail && !manualType ? <T size={12} color={C.gold}>{status.detail}</T> : null}
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      <Chip label={`+${itemXp(it, rm)} XP`} color={done ? C.ok : C.gold} icon="star" />
                      {link && !done ? (
                        <Pressable onPress={() => Linking.openURL(link)} hitSlop={6}>
                          <Chip label={it.check.type === "file" ? "اكتبه على GitHub" : "افتح على GitHub"} color={C.acc} icon="logo-github" />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      ) : null)}

      <SectionTitle>المصادر</SectionTitle>
      <Card style={{ paddingVertical: 6 }}>
        {p.resources.map((r, k) => (
          <Pressable key={r.url} onPress={() => Linking.openURL(r.url)} style={[st.res, k > 0 && st.itemBorder]}>
            <T color={C.acc} font="bold" style={{ flex: 1 }}>{r.label}</T>
            <Ionicons name="open-outline" size={16} color={C.acc} />
          </Pressable>
        ))}
        <T size={13} color={C.mut} style={{ paddingVertical: 10 }}>البرومبت الأنسب لهذه المرحلة: {p.prompt}</T>
      </Card>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
        <Btn kind="ghost" label="السابقة" style={{ flex: 1, opacity: index === 0 ? 0.4 : 1 }} onPress={() => index > 0 && onOpen(index - 1)} />
        <Btn label="التالية" style={{ flex: 1, opacity: index === rm.phases.length - 1 ? 0.4 : 1 }} onPress={() => index < rm.phases.length - 1 && onOpen(index + 1)} />
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  node: { flexDirection: "row", gap: 12 },
  rail: { width: 44, alignItems: "center" },
  circle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.line, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  circleFull: { backgroundColor: C.ok, borderColor: C.ok },
  circleCur: { borderColor: C.acc, borderWidth: 3 },
  line: { width: 3, flex: 1, backgroundColor: C.line, marginVertical: 4 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  item: { flexDirection: "row", gap: 12, paddingVertical: 14 },
  itemBorder: { borderTopWidth: 1, borderTopColor: C.line },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: C.acc, alignItems: "center", justifyContent: "center", marginTop: 2 },
  checkOn: { backgroundColor: C.ok, borderColor: C.ok },
  res: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48 },
});
