export function errorHandler(err, req, res, _next) {
  if (err.name === 'ZodError') {
    const msg = err.issues ? err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : err.message;
    return res.status(400).json({ error: msg });
  }

  if (err.code === 'P2002' || err.code === '23505') {
    return res.status(409).json({ error: 'Record already exists. Please check and retry.' });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (!err.status) {
    console.error('API Error:', err.message);
  }

  return res.status(err.status || 500).json({
    error: err.status ? err.message : 'Unable to complete request. Please retry.',
  });
}

export default errorHandler;
