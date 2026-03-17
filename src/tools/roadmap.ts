import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchUserGame, getTrophiesForGame, getEarnedStatus, TrophyInfo } from "../clients/psn.js";
import { searchYouTube } from "../clients/youtube.js";
import { rarityLabel, rarityOrder } from "../utils/rarity.js";

export function registerRoadmapTool(server: McpServer): void {
  server.tool(
    "get_trophy_list",
    "Get the full trophy list for a PlayStation game with your earned status and rarity. " +
      "Trophies are sorted easiest (Common) first so you know what to do next. " +
      "Use this when the user asks for: trophy list, trophy guide, platinum guide, " +
      "how to get platinum, all trophies for a game, or similar. " +
      "The game must be in the user's PSN library.",
    {
      game: z.string().describe("Game title, e.g. 'God of War Ragnarök' or 'Erica'"),
    },
    async ({ game }) => {
      const gameInfo = await searchUserGame(game);
      if (!gameInfo) {
        return {
          content: [
            {
              type: "text",
              text: `Game "${game}" not found in your PSN library. Make sure you own it and have started it at least once so it appears in your trophy list.`,
            },
          ],
          isError: true,
        };
      }

      const [trophies, { earnedIds, rarityMap }, generalResults] = await Promise.all([
        getTrophiesForGame(gameInfo.npCommunicationId, gameInfo.npServiceName),
        getEarnedStatus(gameInfo.npCommunicationId, gameInfo.npServiceName),
        searchYouTube(`${gameInfo.trophyTitleName} platinum trophy guide`, 1),
      ]);

      const generalVideo = generalResults[0] ?? null;

      const platinum = trophies.find((t) => t.trophyType === "platinum");
      const gold = trophies.filter((t) => t.trophyType === "gold");
      const silver = trophies.filter((t) => t.trophyType === "silver");
      const bronze = trophies.filter((t) => t.trophyType === "bronze");

      // Sort each group: unearned Common first, then Rare, then Ultra Rare, then earned last
      const sortTrophies = (list: TrophyInfo[]): TrophyInfo[] => {
        const unearned = list
          .filter((t) => !earnedIds.has(t.trophyId))
          .sort((a, b) => rarityOrder(rarityMap.get(a.trophyId) ?? null) - rarityOrder(rarityMap.get(b.trophyId) ?? null));
        const earned = list.filter((t) => earnedIds.has(t.trophyId));
        return [...unearned, ...earned];
      };

      const row = (t: TrophyInfo): string => {
        if (earnedIds.has(t.trophyId)) {
          return `| ✅ ~~${t.trophyName}~~ | ~~${t.trophyDetail}~~ | |`;
        }
        const rarity = rarityLabel(rarityMap.get(t.trophyId) ?? null);
        return `| **${t.trophyName}** | ${t.trophyDetail} | ${rarity} |`;
      };

      const section = (title: string, list: TrophyInfo[]): string => {
        if (!list.length) return "";
        const sorted = sortTrophies(list);
        return (
          `\n## ${title}\n` +
          `| Trophy | Description | Difficulty |\n` +
          `|--------|-------------|------------|\n` +
          sorted.map(row).join("\n")
        );
      };

      const remaining =
        (gameInfo.definedTrophies.gold - gameInfo.earnedTrophies.gold) +
        (gameInfo.definedTrophies.silver - gameInfo.earnedTrophies.silver) +
        (gameInfo.definedTrophies.bronze - gameInfo.earnedTrophies.bronze);

      const progressBar = gameInfo.progress > 0 ? ` · Your progress: ${gameInfo.progress}%` : "";
      const platform = gameInfo.npServiceName === "trophy2" ? "PS5" : "PS4/PS3/Vita";

      const lines = [
        `# Trophies: ${gameInfo.trophyTitleName}`,
        `**Platform:** ${platform}${progressBar} · **Remaining:** ${remaining} trophies`,
        "",
        generalVideo
          ? `🎬 [${generalVideo.title}](${generalVideo.url}) — ${generalVideo.channel}`
          : "",
        section("🥇 Gold Trophies", gold),
        section("🥈 Silver Trophies", silver),
        section("🥉 Bronze Trophies", bronze),
        platinum
          ? `\n## 🏆 Platinum\n${platinum.trophyName} — ${platinum.trophyDetail}`
          : "",
      ];

      return {
        content: [{ type: "text", text: lines.filter(Boolean).join("\n") }],
      };
    }
  );
}
