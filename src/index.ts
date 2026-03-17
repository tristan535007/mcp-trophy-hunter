#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSetupTool } from "./tools/setup.js";
import { registerGamesTool } from "./tools/games.js";
import { registerRoadmapTool } from "./tools/roadmap.js";
import { registerSuggestTool } from "./tools/suggest.js";

const server = new McpServer({
  name: "mcp-trophy-hunter",
  version: "2.0.0",
});

registerSetupTool(server);
registerGamesTool(server);
registerRoadmapTool(server);
registerSuggestTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
