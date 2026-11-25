import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, TextInput, View } from "react-native";
import { clearToken, GhError, setToken, verifyToken } from "../github";
import { C, F } from "../theme";
import { Btn, Card, T } from "../ui";

const NEW_TOKEN_URL = "https://github.com/settings/personal-access-tokens/new";

const STEPS = [
  "اضغط «أنشئ مفتاحاً على GitHub» بالأسفل.",
  "Token name: اكتب python-journey-app، واختر مدة الصلاحية (مثلاً 90 يوماً).",
  "Repository access: اختر Only select repositories ثم python-journey فقط.",
  "Permissions → Repository permissions → Contents: اختر Read and write.",
  "اضغط Generate token، انسخ المفتاح، ثم الصقه هنا.",
];

export default function Connect({ login, onChange }: { login: string | null; onChange: (token: string | null, login: string | null) => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const connect = async () => {
    const t = value.trim();
    if (!t) return;
    setBusy(true); setErr(null);
    try {
      const who = await verifyToken(t);
      await setToken(t);
      setValue("");
      onChange(t, who);
    } catch (e: any) {
      setErr(e instanceof GhError ? e.message : "تعذّر التحقق من المفتاح");
    } finally {
      setBusy(false);
    }
  };

  if (login) {
    return (
      <Card style={{ marginTop: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ionicons name="checkmark-circle" size={26} color={C.ok} />
          <View style={{ flex: 1 }}>
            <T font="semi" size={16}>مربوط بحساب {login}</T>
            <T size={13} color={C.mut}>ترسل حلولك من المحرر مباشرة إلى python-journey.</T>
          </View>
        </View>
        <Btn kind="ghost" label="فصل الحساب" icon="log-out-outline" style={{ marginTop: 14 }}
          onPress={async () => { await clearToken(); onChange(null, null); }} />
      </Card>
    );
  }

  return (
    <View>
      <T size={14} color={C.mut} style={{ marginTop: 16 }}>
        لكي يرسل المحرر حلولك إلى GitHub، أنشئ مفتاحاً خاصاً بهذا المستودع وحده. تفعل هذا مرة واحدة فقط.
      </T>
      <Card style={{ marginTop: 12 }}>
        {STEPS.map((s, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
            <T font="title" color={C.acc} size={16} style={{ lineHeight: 26 }}>{i + 1}</T>
            <T size={14} style={{ flex: 1, lineHeight: 26 }}>{s}</T>
          </View>
        ))}
        <Btn label="أنشئ مفتاحاً على GitHub" icon="logo-github" style={{ marginTop: 6 }} onPress={() => Linking.openURL(NEW_TOKEN_URL)} />
      </Card>
      <Card style={{ marginTop: 12 }}>
        <T font="semi" size={15}>الصق المفتاح هنا</T>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="github_pat_…"
          placeholderTextColor={C.mut}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={st.input}
        />
        {err ? <T size={13} color={C.danger} style={{ marginTop: 8 }}>{err}</T> : null}
        <View style={{ marginTop: 12 }}>
          {busy ? <ActivityIndicator color={C.acc} /> : <Btn label="ربط" icon="link" onPress={connect} />}
        </View>
        <T size={12} color={C.mut} style={{ marginTop: 12 }}>
          المفتاح يُحفظ مشفّراً على جوالك فقط، ولا يُرسل إلا إلى GitHub. لا تشاركه مع أحد ولا تضعه في أي ملف.
        </T>
      </Card>
    </View>
  );
}

const st = StyleSheet.create({
  input: {
    marginTop: 10, minHeight: 48, borderRadius: 12, backgroundColor: C.bg, color: C.ink, paddingHorizontal: 14,
    borderWidth: 1, borderColor: C.line, fontFamily: F.body, fontSize: 15, direction: "ltr", textAlign: "left",
  },
});
