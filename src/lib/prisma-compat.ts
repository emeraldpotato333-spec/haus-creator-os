export function isPrismaSchemaDriftError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : null;

  return code === "P2021" || code === "P2022";
}

export function getPrismaPageNotice(pageLabel: string, error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    if (error.message.includes("DATABASE_URL")) {
      return `${pageLabel} could not connect to the database. Set DATABASE_URL in Vercel, then redeploy.`;
    }
  }

  if (isPrismaSchemaDriftError(error)) {
    return `${pageLabel} is using an older production schema. Run Prisma migrations so the latest creator fields are available.`;
  }

  return `${pageLabel} data is temporarily unavailable. The page is loading in a safe fallback state.`;
}

export function logPrismaPageError(scope: string, error: unknown) {
  console.error("[HAUS Creator OS page]", {
    scope,
    error: error instanceof Error ? error.message : String(error),
  });
}
