import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { REPO_URL, Roadmap } from "../data";
import { C, PAD } from "../theme";
import { Btn, Card, SectionTitle, T } from "../ui";

const TABS = ["البرومبتات", "مراجعة الكود", "كيف أرفع حلّي"] as const;

const STEPS: [string, string][] = [
  ["انسخ المستودع مرة واحدة", "git clone https://github.com/ayachzawi/python-journey.git"],
  ["قبل كل جلسة، اسحب آخر تحديث", "git pull"],
  ["اكتب حلك ثم شغّل الاختبار", "pytest exercises/p1/t01-variables"],
  ["ارفع الحل", 'git add .\ngit commit -m "حل تمرين المتغيرات"\ngit push'],
  ["انتظر دقيقة واسحب الشاشة الرئيسية للتحديث", "GitHub يشغّل الاختبارات ويحدّث تقدمك والنقاط تلقائياً"],
];

export default function Tools({ rm }: { rm: Roadmap }) {
  const [tab, setTab] = useState(0);
  const [copied, setCopied] = useState<number | null>(null);

  const copy = async (i: number, text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(i);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: PAD, paddingBottom: 40 }}>
      <T size={30} font="title" style={{ lineHeight: 42 }}>الأدوات</T>
      <View style={st.seg}>
        {TABS.map((t, i) => (
          <Pressable key={t} onPress={() => setTab(i)} style={[st.segBtn, tab === i && st.segOn]}>
            <T size={13} font="bold" color={tab === i ? "#fff" : C.mut}>{t}</T>
          </Pressable>
        ))}
      </View>

      {tab === 0 && rm.prompts.map((p, i) => (
        <View key={p.title}>
          <SectionTitle right={<T size={12} color={C.acc}>{p.when}</T>}>{p.title}</SectionTitle>
          <Card>
            <T size={15} style={{ lineHeight: 27 }} selectable>{p.text}</T>
            <Btn kind="ghost" style={{ marginTop: 14 }} icon={copied === i ? "checkmark" : "copy-outline"}
              label={copied === i ? "تم النسخ" : "نسخ البرومبت"} onPress={() => copy(i, p.text)} />
          </Card>
        </View>
      ))}
      {tab === 0 ? <T size={12} color={C.mut} style={{ marginTop: 16 }}>لا ترسل كلمات مرور أو مفاتيح API أو بيانات خاصة.</T> : null}

      {tab === 1 && (
        <>
          <T size={14} color={C.mut} style={{ marginTop: 16 }}>استخدمها على كل كود تكتبه أو يولّده الـ AI قبل أن تقبله.</T>
          {rm.review_checklist.map((g, i) => (
            <Card key={g.title} style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <T size={22} font="title" color={C.acc} style={{ lineHeight: 28 }}>{i + 1}</T>
                <T size={17} font="semi">{g.title}</T>
              </View>
              {g.items.map((x) => (
                <View key={x} style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <Ionicons name="ellipse" size={6} color={C.mut} style={{ marginTop: 9 }} />
                  <T size={14} color={C.mut} style={{ flex: 1 }}>{x}</T>
                </View>
              ))}
            </Card>
          ))}
        </>
      )}

      {tab === 2 && (
        <>
          {STEPS.map(([title, code], i) => (
            <Card key={title} style={{ marginTop: 12 }}>
              <T size={16} font="semi">{i + 1}. {title}</T>
              <Pressable onPress={() => code.startsWith("git") || code.startsWith("pytest") ? copy(100 + i, code) : null}>
                <View style={st.code}>
                  <T size={13} style={{ fontFamily: "monospace", writingDirection: "ltr", textAlign: "left" }} color={C.ink}>{code}</T>
                </View>
              </Pressable>
              {copied === 100 + i ? <T size={12} color={C.ok}>تم النسخ</T> : null}
            </Card>
          ))}
          <Btn style={{ marginTop: 18 }} icon="logo-github" label="افتح المستودع" onPress={() => Linking.openURL(REPO_URL)} />
          <T size={12} color={C.mut} style={{ marginTop: 10 }}>اضغط على أي أمر لنسخه.</T>
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  seg: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 14, padding: 4, marginTop: 14, gap: 4 },
  segBtn: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: C.cobalt },
  code: { backgroundColor: C.bg, borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: C.line },
});
