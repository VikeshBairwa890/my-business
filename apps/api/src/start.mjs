import prisma from './prisma.mjs';
import { createApp } from './app.mjs';

const port = Number(process.env.PORT || 4000);
const server = createApp().listen(port, () => {
  console.log(`ThekaBook API listening on port ${port}`);
});

async function stop() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', stop);
process.on('SIGINT', stop);
