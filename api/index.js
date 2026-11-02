let appInstance = null;

module.exports = async (req, res) => {
  try {
    if (!appInstance) {
      const { createApp } = await import('../apps/api/src/app.mjs');
      appInstance = createApp();
    }
    return appInstance(req, res);
  } catch (err) {
    console.error('API Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message, stack: err.stack }));
  }
};
