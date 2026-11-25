import { ReactElement } from "react";
import { Text, View } from "react-native";
import { C, F } from "./theme";
import { T } from "./ui";

// عارض Markdown بسيط لملفات README: عناوين، فقرات، قوائم، جداول، كود.
function Inline({ text, size = 15, color = C.ink, bold = false }: { text: string; size?: number; color?: string; bold?: boolean }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <T size={size} color={color} font={bold ? "bold" : "body"} style={{ lineHeight: Math.round(size * 1.75) }}>
      {parts.map((p, i) =>
        p.startsWith("`") ? (
          <Text key={i} style={{ fontFamily: "monospace", color: C.acc, fontSize: size - 1 }}>{p.slice(1, -1)}</Text>
        ) : p.startsWith("**") ? (
          <Text key={i} style={{ fontFamily: F.bold }}>{p.slice(2, -2)}</Text>
        ) : (
          p
        )
      )}
    </T>
  );
}

export default function Md({ source }: { source: string }) {
  const out: ReactElement[] = [];
  const lines = source.replace(/\r/g, "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("```")) {
      const code: string[] = [];
      while (++i < lines.length && !lines[i].startsWith("```")) code.push(lines[i]);
      out.push(
        <View key={i} style={{ backgroundColor: C.bg, borderRadius: 10, padding: 12, marginVertical: 8, borderWidth: 1, borderColor: C.line }}>
          <Text style={{ fontFamily: "monospace", color: C.ink, fontSize: 13, lineHeight: 20, writingDirection: "ltr", textAlign: "left" }}>{code.join("\n")}</Text>
        </View>
      );
    } else if (/^\s*</.test(l)) {
      // وسوم HTML مثل <details>: نعرض عنوان <summary> فقط
      const m = l.match(/<summary>(.*?)<\/summary>/);
      if (m) out.push(<T key={i} font="semi" size={15} color={C.mut} style={{ marginTop: 14 }}>{m[1]}</T>);
    } else if (/^#{1,3} /.test(l)) {
      const level = l.indexOf(" ");
      out.push(<T key={i} font="title" size={level === 1 ? 22 : 18} style={{ marginTop: 14, marginBottom: 4 }}>{l.slice(level + 1)}</T>);
    } else if (/^\|/.test(l)) {
      if (/^\|[\s|:-]+\|?$/.test(l)) continue;
      const cells = l.split("|").map((s) => s.trim()).filter(Boolean);
      out.push(
        <View key={i} style={{ flexDirection: "row", gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line }}>
          {cells.map((cell, k) => <View key={k} style={{ flex: 1 }}><Inline text={cell} size={14} /></View>)}
        </View>
      );
    } else if (/^\s*([-*]|\d+\.) /.test(l)) {
      const m = l.match(/^\s*([-*]|\d+\.) (.*)$/)!;
      out.push(
        <View key={i} style={{ flexDirection: "row", gap: 8, marginVertical: 2 }}>
          <T color={C.acc} font="bold">{/\d/.test(m[1]) ? m[1] : "•"}</T>
          <View style={{ flex: 1 }}><Inline text={m[2]} /></View>
        </View>
      );
    } else if (l.trim()) {
      out.push(<View key={i} style={{ marginVertical: 3 }}><Inline text={l} /></View>);
    }
  }
  return <View>{out}</View>;
}
