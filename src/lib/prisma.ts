import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

type GlobalWithPrisma = typeof globalThis & {
  hausPrisma?: PrismaClient;
};

export function getPrisma() {
  const globalForPrisma = globalThis as GlobalWithPrisma;

  if (!globalForPrisma.hausPrisma) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is required. Add it to .env.local or connect Vercel Postgres.");
    }

    const adapter = new PrismaPg({ connectionString });
    globalForPrisma.hausPrisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.hausPrisma;
}
