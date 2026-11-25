import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, View } from "react-native";
import { Game } from "../game";
import { C, PAD } from "../theme";
import { Card, T } from "../ui";

export default function Badges({ game }: { game: Game }) {
  const earned = game.badges.filter((b) => b.earned).length;
  return (
    <ScrollView contentContainerStyle={{ padding: PAD, paddingBottom: 40 }}>
      <T size={30} font="title" style={{ lineHeight: 42 }}>الشارات</T>
      <T size={14} color={C.mut}>حصلت على {earned} من {game.badges.length} · أفضل سلسلة: {game.bestStreak} أيام</T>
      <View style={st.grid}>
        {game.badges.map((b) => (
          <Card key={b.id} style={[st.cell, !b.earned && { opacity: 0.45 }]}>
            <View style={[st.icon, b.earned && { backgroundColor: C.gold }]}>
              <Ionicons name={(b.earned ? b.icon : "lock-closed") as any} size={26} color={b.earned ? C.bg : C.mut} />
            </View>
            <T size={15} font="semi" style={{ marginTop: 10, textAlign: "center" }}>{b.title}</T>
            <T size={12} color={C.mut} style={{ textAlign: "center" }}>{b.desc}</T>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 20 },
  cell: { width: "47.5%", alignItems: "center", paddingVertical: 20 },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center" },
});
