import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Pressable, StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle } from "react-native";
import { C, F } from "./theme";

type TProps = TextProps & { size?: number; color?: string; font?: keyof typeof F; style?: StyleProp<TextStyle> };

export function T({ size = 15, color = C.ink, font = "body", style, ...rest }: TProps) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: F[font], fontSize: size, color, lineHeight: Math.round(size * 1.55), writingDirection: "rtl" }, style]}
    />
  );
}

export function Card({ children, style, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: string }) {
  return <View style={[s.card, tint ? { backgroundColor: tint, borderColor: tint } : null, style]}>{children}</View>;
}

export function Bar({ value, color = C.acc, height = 8, track = C.line }: { value: number; color?: string; height?: number; track?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, backgroundColor: track, borderRadius: height, overflow: "hidden" }}>
      <View style={{ width: `${v * 100}%`, height: "100%", backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export function Chip({ label, color = C.acc, icon }: { label: string; color?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={[s.chip, { borderColor: color }]}>
      {icon ? <Ionicons name={icon} size={12} color={color} /> : null}
      <T size={12} font="bold" color={color} style={{ lineHeight: 16 }}>{label}</T>
    </View>
  );
}

export function Btn({ label, onPress, icon, kind = "primary", style }: {
  label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap;
  kind?: "primary" | "ghost"; style?: StyleProp<ViewStyle>;
}) {
  const primary = kind === "primary";
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(255,255,255,0.15)" }}
      style={({ pressed }) => [s.btn, primary ? s.btnPrimary : s.btnGhost, pressed && { opacity: 0.8 }, style]}
    >
      {icon ? <Ionicons name={icon} size={18} color={primary ? "#fff" : C.ink} /> : null}
      <T font="bold" size={15} color={primary ? "#fff" : C.ink}>{label}</T>
    </Pressable>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={s.section}>
      <T font="semi" size={18}>{children}</T>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.line },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 2, alignSelf: "flex-start" },
  btn: { minHeight: 48, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18 },
  btnPrimary: { backgroundColor: C.cobalt },
  btnGhost: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line },
  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28, marginBottom: 12 },
});
