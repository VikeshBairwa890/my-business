// Fallback to POSTGRES_URL or PRISMA_DATABASE_URL if DATABASE_URL is not set directly
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.POSTGRES_URL ||
    process.env.PRISMA_DATABASE_URL ||
    process.env.DATABASE_URL_POOLED ||
    "postgres://6b69a46df7fa5f6e47eb4454fd6f02392cda12a05bec460fcd1185f2ced0078f:sk_Vnzjq4DES9leITN8x7sDR@db.prisma.io:5432/postgres?sslmode=require";
}

import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
