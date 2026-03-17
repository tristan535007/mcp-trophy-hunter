import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { setupFromNpsso, getStoredCredentials } from "../clients/psn.js";

export function registerSetupTool(server: McpServer): void {
  server.tool(
    "setup_psn",
    "One-time PSN authentication setup. Provide your NPSSO token to enable trophy data access. " +
      "IMPORTANT: You must be logged in to PlayStation Network at playstation.com FIRST, " +
      "then visit https://ca.account.sony.com/api/v1/ssocookie and copy the npsso value. " +
      "Only needs to be done once every ~2 months.",
    {
      npsso: z
        .string()
        .min(10)
        .describe("Your PSN NPSSO token from https://ca.account.sony.com/api/v1/ssocookie"),
    },
    async ({ npsso }) => {
      try {
        await setupFromNpsso(npsso);
        return {
          content: [
            {
              type: "text",
              text: "PSN authentication successful. You can now use get_my_games, get_trophy_list, and suggest_next_trophy.",
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: "text",
              text:
                "Authentication failed. Make sure you are logged in to PlayStation Network at playstation.com first, " +
                "then visit https://ca.account.sony.com/api/v1/ssocookie again to get a fresh npsso token.",
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "check_psn_auth",
    "Check if PSN authentication is set up and working.",
    {},
    async () => {
      const creds = getStoredCredentials();
      if (!creds) {
        return {
          content: [
            {
              type: "text",
              text: "Not authenticated. Run setup_psn with your NPSSO token first.",
            },
          ],
        };
      }
      const expiresIn = Math.round((creds.expiresAt - Date.now()) / 1000 / 60);
      return {
        content: [
          {
            type: "text",
            text:
              expiresIn > 0
                ? `Authenticated. Access token expires in ${expiresIn} minutes (auto-refresh enabled).`
                : "Access token expired but refresh token available — will auto-refresh on next request.",
          },
        ],
      };
    }
  );
}
