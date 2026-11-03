let appInstance = null;

async function getApp() {
  if (!appInstance) {
    const { createApp } = await import('../src/app.mjs');
    appInstance = createApp();
  }
  return appInstance;
}

export default async function handler(req, res) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error('API Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: 'Backend Server Error',
      message: err.message,
      stack: err.stack,
    }));
  }
}
