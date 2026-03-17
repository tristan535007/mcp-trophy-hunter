import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,
  getUserTitles,
  getTitleTrophies,
  getUserTrophiesEarnedForTitle,
} from "psn-api";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CREDENTIALS_DIR = join(homedir(), ".trophy-hunter");
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, "credentials.json");

interface Credentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

// In-memory cache for multi-user cloud isolation.
// Each mcp-proxy process is per-user, so this is safe.
let sessionCredentials: Credentials | null = null;

export function saveCredentials(creds: Credentials): void {
  if (!existsSync(CREDENTIALS_DIR)) {
    mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2));
}

export function loadCredentials(): Credentials | null {
  if (!existsSync(CREDENTIALS_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CREDENTIALS_FILE, "utf-8")) as Credentials;
  } catch {
    return null;
  }
}

export async function setupFromNpsso(npsso: string): Promise<void> {
  const accessCode = await exchangeNpssoForAccessCode(npsso);
  const tokens = await exchangeAccessCodeForAuthTokens(accessCode);
  const creds: Credentials = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
  sessionCredentials = creds;
  saveCredentials(creds);
}

// Returns in-memory session credentials first, then falls back to file.
export function getStoredCredentials(): Credentials | null {
  return sessionCredentials ?? loadCredentials();
}

export async function getAccessToken(): Promise<string> {
  const creds = sessionCredentials ?? loadCredentials();
  if (!creds) {
    throw new Error(
      "Not authenticated. Run setup_psn first:\n" +
        "1. Open https://ca.account.sony.com/api/v1/ssocookie in your browser (must be logged in to PSN)\n" +
        "2. Copy the npsso value\n" +
        '3. Tell Claude: "setup_psn <your-npsso-value>"'
    );
  }

  // Refresh 5 minutes before expiry
  if (Date.now() > creds.expiresAt - 5 * 60 * 1000) {
    const refreshed = await exchangeRefreshTokenForAuthTokens(creds.refreshToken);
    const updated: Credentials = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: Date.now() + refreshed.expiresIn * 1000,
    };
    sessionCredentials = updated;
    saveCredentials(updated);
    return updated.accessToken;
  }

  sessionCredentials = creds; // cache after first file read
  return creds.accessToken;
}

export interface TrophyInfo {
  trophyId: number;
  trophyName: string;
  trophyDetail: string;
  trophyType: "bronze" | "silver" | "gold" | "platinum";
  trophyIconUrl: string | null;
}

export interface EarnedStatus {
  earnedIds: Set<number>;
  // trophyEarnedRate from UserThinTrophy (available in getUserTrophiesEarnedForTitle)
  rarityMap: Map<number, number | null>; // trophyId → % of players who earned it
}

export async function getTrophiesForGame(
  npCommunicationId: string,
  npServiceName: "trophy" | "trophy2"
): Promise<TrophyInfo[]> {
  const accessToken = await getAccessToken();
  const auth = { accessToken };

  const response = await getTitleTrophies(auth, npCommunicationId, "all", {
    npServiceName,
  });

  return (response.trophies ?? []).map((t) => ({
    trophyId: t.trophyId ?? 0,
    trophyName: t.trophyName ?? "Unknown",
    trophyDetail: t.trophyDetail ?? "",
    trophyType: (t.trophyType ?? "bronze") as TrophyInfo["trophyType"],
    trophyIconUrl: t.trophyIconUrl ?? null,
  }));
}

// Returns both earned status and rarity from a single API call.
// trophyEarnedRate is on UserThinTrophy (getUserTrophiesEarnedForTitle),
// NOT on TitleThinTrophy (getTitleTrophies).
export async function getEarnedStatus(
  npCommunicationId: string,
  npServiceName: "trophy" | "trophy2"
): Promise<EarnedStatus> {
  const accessToken = await getAccessToken();
  const auth = { accessToken };

  const response = await getUserTrophiesEarnedForTitle(
    auth,
    "me",
    npCommunicationId,
    "all",
    { npServiceName }
  );

  const earnedIds = new Set<number>();
  const rarityMap = new Map<number, number | null>();

  for (const t of response.trophies ?? []) {
    if (t.trophyId === undefined) continue;
    if (t.earned) earnedIds.add(t.trophyId);
    const raw = t.trophyEarnedRate;
    const rate = raw != null ? parseFloat(raw) : NaN;
    rarityMap.set(t.trophyId, !isNaN(rate) ? rate : null);
  }

  return { earnedIds, rarityMap };
}

export interface GameInfo {
  npCommunicationId: string;
  trophyTitleName: string;
  npServiceName: "trophy" | "trophy2";
  progress: number;
  definedTrophies: { bronze: number; silver: number; gold: number; platinum: number };
  earnedTrophies: { bronze: number; silver: number; gold: number; platinum: number };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGameInfo(t: any): GameInfo {
  return {
    npCommunicationId: t.npCommunicationId,
    trophyTitleName: t.trophyTitleName,
    npServiceName: t.npServiceName as "trophy" | "trophy2",
    progress: t.progress,
    definedTrophies: {
      bronze: t.definedTrophies.bronze ?? 0,
      silver: t.definedTrophies.silver ?? 0,
      gold: t.definedTrophies.gold ?? 0,
      platinum: t.definedTrophies.platinum ?? 0,
    },
    earnedTrophies: {
      bronze: t.earnedTrophies?.bronze ?? 0,
      silver: t.earnedTrophies?.silver ?? 0,
      gold: t.earnedTrophies?.gold ?? 0,
      platinum: t.earnedTrophies?.platinum ?? 0,
    },
  };
}

export async function searchUserGame(title: string): Promise<GameInfo | null> {
  const accessToken = await getAccessToken();
  const auth = { accessToken };

  const response = await getUserTitles(auth, "me", { limit: 800 });
  const found = response.trophyTitles?.find((t) =>
    t.trophyTitleName?.toLowerCase().includes(title.toLowerCase())
  );

  return found ? toGameInfo(found) : null;
}

export async function getTopGames(limit: number): Promise<GameInfo[]> {
  const accessToken = await getAccessToken();
  const auth = { accessToken };

  const response = await getUserTitles(auth, "me", { limit: 800 });
  return (response.trophyTitles ?? [])
    .filter((t) => t.progress < 100)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, limit)
    .map(toGameInfo);
}
