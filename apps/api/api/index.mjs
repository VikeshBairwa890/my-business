let appPromise = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const { createApp } = await import('../src/app.mjs');
      return createApp();
    })();
  }
  return appPromise;
}

export default async function handler(req, res) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    console.error('API Boot Error:', error);
    res.status(500).json({
      error: 'API Boot Error',
      message: error?.message || String(error),
      code: error?.code,
      stack: error?.stack,
    });
  }
}
