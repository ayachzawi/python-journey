import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Modal, StyleSheet, View } from "react-native";
import { C } from "./theme";
import { Btn, T } from "./ui";

export type Party = { xp: number; titles: string[]; levelName: string | null; badges: string[] };

export default function Celebration({ party, onClose }: { party: Party | null; onClose: () => void }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (party) {
      scale.setValue(0.6);
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }).start();
    }
  }, [party, scale]);
  if (!party) return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose} statusBarTranslucent>
      <View style={st.backdrop}>
        <Animated.View style={[st.card, { transform: [{ scale }] }]}>
          <View style={st.burst}><Ionicons name="star" size={40} color={C.bg} /></View>
          <T size={16} color={C.mut} style={{ textAlign: "center", marginTop: 14 }}>وصل تقدمك من GitHub</T>
          <T size={44} font="title" color={C.gold} style={{ textAlign: "center", lineHeight: 56 }}>+{party.xp} XP</T>
          {party.levelName ? (
            <T size={18} font="semi" style={{ textAlign: "center" }}>مستوى جديد: {party.levelName}</T>
          ) : null}
          <View style={{ marginTop: 14, gap: 6 }}>
            {party.titles.slice(0, 5).map((t) => (
              <View key={t} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                <Ionicons name="checkmark-circle" size={18} color={C.ok} style={{ marginTop: 3 }} />
                <T size={14} style={{ flex: 1 }}>{t}</T>
              </View>
            ))}
            {party.titles.length > 5 ? <T size={13} color={C.mut}>و{party.titles.length - 5} خطوات أخرى</T> : null}
          </View>
          {party.badges.length ? (
            <T size={14} color={C.gold} font="bold" style={{ marginTop: 12 }}>شارة جديدة: {party.badges.join("، ")}</T>
          ) : null}
          <Btn label="يلا نكمل" style={{ marginTop: 20 }} onPress={onClose} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(5,7,15,0.8)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 420, backgroundColor: C.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.acc },
  burst: { alignSelf: "center", width: 80, height: 80, borderRadius: 40, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" },
});
