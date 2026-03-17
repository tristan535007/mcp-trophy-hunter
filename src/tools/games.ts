import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getTopGames, GameInfo } from "../clients/psn.js";

function remaining(g: GameInfo): string {
  const gold = g.definedTrophies.gold - g.earnedTrophies.gold;
  const silver = g.definedTrophies.silver - g.earnedTrophies.silver;
  const bronze = g.definedTrophies.bronze - g.earnedTrophies.bronze;
  const parts: string[] = [];
  if (gold > 0) parts.push(`${gold}G`);
  if (silver > 0) parts.push(`${silver}S`);
  if (bronze > 0) parts.push(`${bronze}B`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function registerGamesTool(server: McpServer): void {
  server.tool(
    "get_my_games",
    "Show your PSN games sorted by closeness to platinum. " +
      "IMPORTANT: Always display the COMPLETE table with ALL returned games — do not summarize or truncate. " +
      "Use this when the user asks: what games do I have, what should I play next, " +
      "which game is closest to platinum, show my library, or similar.",
    {},
    async () => {
      const games = await getTopGames(20);

      if (games.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No games found in your PSN library, or all your games are already 100% complete. Congratulations!",
            },
          ],
        };
      }

      const rows = games.map((g) => {
        const platform = g.npServiceName === "trophy2" ? "PS5" : "PS4";
        const progress = g.progress > 0 ? `${g.progress}%` : "0%";
        return `| ${g.trophyTitleName} | ${platform} | ${progress} | ${remaining(g)} |`;
      });

      const text = [
        "## My Games — Closest to Platinum",
        "",
        "| Game | Platform | Progress | Remaining |",
        "|------|----------|----------|-----------|",
        ...rows,
        "",
        `*${games.length} games shown · sorted by progress*`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );
}
