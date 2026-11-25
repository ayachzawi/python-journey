// يعيد توليد src/harness.ts من src/harness.py.txt: npm run gen:harness
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../src/harness.py.txt"), "utf8");
const out =
  "// كود Python الذي يشغّل الحلول والاختبارات داخل Pyodide (Python في المتصفح).\n" +
  "// المصدر المقروء: harness.py.txt بجانب هذا الملف. لا تعدّل هذا الملف يدوياً، بل أعد توليده.\n" +
  "export const HARNESS = " + JSON.stringify(src) + ";\n";
fs.writeFileSync(path.join(__dirname, "../src/harness.ts"), out);
console.log("harness.ts updated");
