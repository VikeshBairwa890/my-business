import { defineConfig } from 'prisma/config';

export default defineConfig({
  orm: {
    schema: './prisma/schema.prisma',
  },
});
