import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getTopGames, getTrophiesForGame, getEarnedStatus, TrophyInfo } from "../clients/psn.js";
import { rarityOrder, rarityTag } from "../utils/rarity.js";

const MISSABLE_KEYWORDS = [
  "missable", "miss", "point of no return", "one time", "chapter",
  "only once", "cannot return", "can't return", "before", "unmissable",
];

function hasMissable(trophies: TrophyInfo[], earnedIds: Set<number>): boolean {
  return trophies
    .filter((t) => !earnedIds.has(t.trophyId) && t.trophyType !== "platinum")
    .some((t) => {
      const text = (t.trophyName + " " + t.trophyDetail).toLowerCase();
      return MISSABLE_KEYWORDS.some((kw) => text.includes(kw));
    });
}

export function registerSuggestTool(server: McpServer): void {
  server.tool(
    "suggest_next_trophy",
    "Analyze your PSN profile and suggest the best trophies to go for next. " +
      "Recommends your top-3 games closest to platinum with specific easy trophies to target. " +
      "Use this when the user asks: what should I do next, what trophy should I get, " +
      "recommend me a trophy, what's my best next step, or similar.",
    {
      limit: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .describe("How many games to analyze (default 5, max 10)"),
    },
    async ({ limit = 5 }) => {
      const games = await getTopGames(limit);

      if (games.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No incomplete games found in your PSN library. All platinums earned — well done!",
            },
          ],
        };
      }

      // Fetch trophies + earned status (with rarity) for all games in parallel
      const results = await Promise.all(
        games.map(async (g) => {
          const [trophies, { earnedIds, rarityMap }] = await Promise.all([
            getTrophiesForGame(g.npCommunicationId, g.npServiceName),
            getEarnedStatus(g.npCommunicationId, g.npServiceName),
          ]);
          return { game: g, trophies, earnedIds, rarityMap };
        })
      );

      // Show top-5 games
      const topGames = results.slice(0, 5);

      const sections = topGames.map(({ game, trophies, earnedIds, rarityMap }, idx) => {
        const remaining =
          (game.definedTrophies.gold - game.earnedTrophies.gold) +
          (game.definedTrophies.silver - game.earnedTrophies.silver) +
          (game.definedTrophies.bronze - game.earnedTrophies.bronze);

        const unearned = trophies
          .filter((t) => !earnedIds.has(t.trophyId) && t.trophyType !== "platinum")
          .sort((a, b) => rarityOrder(rarityMap.get(a.trophyId) ?? null) - rarityOrder(rarityMap.get(b.trophyId) ?? null));

        const top = unearned.slice(0, 3);
        const missable = hasMissable(trophies, earnedIds);

        const emoji = idx === 0 ? "🎯" : "🎮";
        const lines = [
          `### ${idx + 1}. ${emoji} ${game.trophyTitleName} — ${game.progress}% complete (${remaining} trophies left)`,
          ...top.map((t) => `- **${t.trophyName}** — ${t.trophyDetail}${rarityTag(rarityMap.get(t.trophyId) ?? null)}`),
          missable
            ? `\n⚠️ **Heads up:** This game has potentially missable trophies. Ask for the full trophy list to check before progressing.`
            : "",
        ];

        return lines.filter(Boolean).join("\n");
      });

      const text = [
        `## What to Do Next`,
        "",
        `Analyzed your top ${games.length} games. Here are the top ${topGames.length} recommendations:`,
        "",
        sections.join("\n\n"),
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );
}
