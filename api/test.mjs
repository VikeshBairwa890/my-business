export default async function handler(req, res) {
  try {
    res.status(200).json({
      status: "ok",
      node: process.version,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL || process.env.POSTGRES_URL),
      envKeys: Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY') && !k.includes('PASSWORD'))
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
