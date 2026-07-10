// Centralised, typed access to environment configuration. Reading env vars in
// exactly one place keeps the rest of the codebase free of `process.env`.
//
// Nothing here throws at import time: throwing would break `next build` on
// platforms that only inject secrets at runtime. Missing production secrets are
// warned about instead, and fall back to a clearly-insecure default.

const DEV_SECRET = "dev-insecure-secret-change-me";

function readJwtSecret(): string {
  const v = process.env.JWT_SECRET;
  if (v) return v;
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[config] JWT_SECRET is not set — using an insecure fallback. " +
        "Set JWT_SECRET before serving production traffic.",
    );
  }
  return DEV_SECRET;
}

function readGeminiApiKey(): string {
  const v = process.env.GEMINI_API_KEY;
  if (v) return v;
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[config] GEMINI_API_KEY is not set — Chat Assist / AI suggestions will " +
        "return a 502 until it is configured.",
    );
  }
  return "";
}

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: readJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  // Longer-lived token baked into the downloadable browser extension.
  extensionTokenExpiresIn: process.env.EXTENSION_TOKEN_EXPIRES_IN ?? "30d",
  bcryptRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? "12"),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  // AI (Google Gemini) for Chat Assist / suggestions.
  geminiApiKey: readGeminiApiKey(),
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest",
  aiRateLimitPerMin: Number(process.env.AI_RATE_LIMIT_PER_MIN ?? "20"),
} as const;
