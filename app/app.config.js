// رقم الإصدار يزيد تلقائياً مع كل بناء في GitHub Actions، حتى يقبل أندرويد التحديث فوق النسخة القديمة.
module.exports = ({ config }) => {
  const run = Number(process.env.GITHUB_RUN_NUMBER || 1);
  return {
    ...config,
    version: `1.0.${run}`,
    android: { ...config.android, versionCode: run },
  };
};
