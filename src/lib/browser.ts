import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// Where a *working copy* of the Firefox profile lives. We never launch against
// the user's real profile directly (that would risk corrupting it and requires
// their Firefox to be closed) — instead we copy the login-relevant files here.
export const WORK_PROFILE_DIR = path.join(
  process.cwd(),
  "data",
  "firefox-profile",
);

// Candidate locations for the user's real Firefox profiles, in priority order.
const PROFILE_BASES = [
  path.join(os.homedir(), "snap", "firefox", "common", ".mozilla", "firefox"),
  path.join(os.homedir(), ".mozilla", "firefox"),
];

// Files/dirs worth copying (caches, locks and session state are excluded).
const EXCLUDE = new Set([
  "cache2",
  "startupCache",
  "shader-cache",
  "thumbnails",
  "crashes",
  "minidumps",
  "datareporting",
  "saved-telemetry-pings",
  "sessionstore-backups",
  "lock",
  ".parentlock",
  "parent.lock",
  // Removing compatibility.ini avoids Firefox version-mismatch reset prompts
  // when Playwright's Firefox opens a profile written by system Firefox.
  "compatibility.ini",
]);

function excluded(p: string): boolean {
  const base = path.basename(p);
  if (EXCLUDE.has(base)) return true;
  if (base.startsWith("sessionstore")) return true; // don't restore old tabs
  if (base === "cache2" || base.includes("Cache")) return true;
  return false;
}

/** Parse profiles.ini and return the default profile's absolute path. */
async function resolveRealProfile(base: string): Promise<string | undefined> {
  let ini: string;
  try {
    ini = await fs.readFile(path.join(base, "profiles.ini"), "utf8");
  } catch {
    return undefined;
  }

  // Collect [ProfileN] sections and any Install default.
  const sections = ini.split(/\r?\n(?=\[)/);
  let installDefault: string | undefined;
  const profiles: { path: string; isRelative: boolean; isDefault: boolean }[] =
    [];

  for (const section of sections) {
    const header = section.match(/^\[([^\]]+)\]/)?.[1] ?? "";
    const get = (key: string) =>
      section.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();

    if (header.startsWith("Install")) {
      const def = get("Default");
      if (def) installDefault = def;
    } else if (header.startsWith("Profile")) {
      const p = get("Path");
      if (p) {
        profiles.push({
          path: p,
          isRelative: get("IsRelative") !== "0",
          isDefault: get("Default") === "1",
        });
      }
    }
  }

  const abs = (p: string, rel: boolean) =>
    rel ? path.join(base, p) : p;

  if (installDefault) return abs(installDefault, !path.isAbsolute(installDefault));
  const flagged = profiles.find((p) => p.isDefault);
  if (flagged) return abs(flagged.path, flagged.isRelative);
  if (profiles.length) return abs(profiles[0].path, profiles[0].isRelative);
  return undefined;
}

/** Locate the user's default Firefox profile directory, if any. */
export async function findRealFirefoxProfile(): Promise<string | undefined> {
  for (const base of PROFILE_BASES) {
    const profile = await resolveRealProfile(base);
    if (profile) {
      try {
        await fs.access(profile);
        return profile;
      } catch {
        // keep looking
      }
    }
  }
  return undefined;
}

/**
 * Ensure the working profile exists, seeded from the user's real Firefox profile
 * so their existing cookies/logins are available. Only seeds once — delete
 * `data/firefox-profile` to re-sync with the real profile later.
 */
export async function ensureFirefoxProfile(): Promise<{
  profileDir: string;
  seededFrom?: string;
}> {
  try {
    await fs.access(WORK_PROFILE_DIR);
    return { profileDir: WORK_PROFILE_DIR }; // already seeded
  } catch {
    // needs seeding
  }

  const real = await findRealFirefoxProfile();
  await fs.mkdir(WORK_PROFILE_DIR, { recursive: true });

  if (real) {
    await fs.cp(real, WORK_PROFILE_DIR, {
      recursive: true,
      force: true,
      errorOnExist: false,
      filter: (src) => !excluded(src),
    });
  }

  return { profileDir: WORK_PROFILE_DIR, seededFrom: real };
}
