// يجعل نسخة release توقَّع بمفتاح ثابت إذا وُجد KEYSTORE_FILE في بيئة البناء،
// وإلا يبقى توقيع debug الافتراضي. المفتاح نفسه لا يُحفظ في المستودع أبداً، بل في GitHub Secrets.
const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE_CONFIG = `
        release {
            if (System.getenv("KEYSTORE_FILE")) {
                storeFile file(System.getenv("KEYSTORE_FILE"))
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias System.getenv("KEY_ALIAS")
                keyPassword System.getenv("KEY_PASSWORD")
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (!g.includes('System.getenv("KEYSTORE_FILE")')) {
      g = g.replace(/signingConfigs\s*\{/, (m) => m + RELEASE_CONFIG);
      g = g.replace(
        /(release\s*\{[^{}]*?)signingConfig\s+signingConfigs\.debug/,
        '$1signingConfig System.getenv("KEYSTORE_FILE") ? signingConfigs.release : signingConfigs.debug'
      );
    }
    cfg.modResults.contents = g;
    return cfg;
  });
};
