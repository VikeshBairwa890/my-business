export default function handler(req, res) {
  res.status(200).json({ ok: true, message: 'pong', time: new Date().toISOString() });
}
