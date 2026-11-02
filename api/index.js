let app;
let initError = null;

try {
  const { createApp } = await import('../apps/api/src/app.mjs');
  app = createApp();
} catch (err) {
  initError = err;
  console.error('Initialization error in api/index.js:', err);
}

export default async function handler(req, res) {
  if (initError) {
    return res.status(500).json({
      error: 'API Initialization Failed',
      message: initError?.message || String(initError),
      stack: initError?.stack,
    });
  }
  return app(req, res);
}
