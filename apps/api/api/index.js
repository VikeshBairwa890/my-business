let appInstance = null;

export default async function handler(req, res) {
  try {
    if (!appInstance) {
      const { createApp } = await import('../src/app.mjs');
      appInstance = createApp();
    }
    return appInstance(req, res);
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({
      error: 'API Handler Failed',
      message: err?.message || String(err),
      stack: err?.stack,
    });
  }
}
