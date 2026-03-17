# mcp-trophy-hunter — Claude Rules

## What This Project Is

An MCP server for PlayStation platinum trophy hunting. Solves a real problem:
finding guides on YouTube requires watching hours of video to find one specific step.
This server gives Claude tools to fetch structured trophy data and surface YouTube guides instantly.

**Goal:** personal use first → publish on [mcpize.com](https://mcpize.com/)

Full spec: `specs/v2-redesign.md`

**Language rule: all specs, code comments, commit messages, and documentation must be in English.**

---

## Tech Stack

- **Language:** TypeScript (ESM, Node 18+)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **PSN data:** `psn-api` npm (unofficial but widely used)
- **YouTube search:** `ytsr` v3 (no API key needed)
- **Validation:** `zod`
- **Transport:** stdio

---

## Project Structure

```
src/
├── index.ts              # McpServer entry point
├── clients/
│   ├── psn.ts            # PSN auth + trophy fetching
│   └── youtube.ts        # ytsr wrapper
└── tools/
    ├── setup.ts          # setup_psn + check_psn_auth
    ├── roadmap.ts        # get_platinum_roadmap
    └── easy.ts           # find_easy_platinums
```

---

## MCP Tools (v2)

| Tool | Description |
|------|-------------|
| `setup_psn(npsso)` | One-time auth. Saves tokens to `~/.trophy-hunter/credentials.json` |
| `check_psn_auth` | Verify auth status and token expiry |
| `get_my_games` | Top-20 games closest to platinum with progress and remaining counts |
| `get_trophy_list(game)` | Full trophy list with rarity (Common/Rare/Ultra Rare), sorted easiest first + YouTube link |
| `suggest_next_trophy(limit?)` | Analyzes profile → top-3 game recommendations with specific next trophies |

---

## Auth Flow (important context)

PSN auth uses NPSSO token (browser cookie):
1. User visits `https://ca.account.sony.com/api/v1/ssocookie` while logged in to PSN
2. Copies the `npsso` value
3. Runs `setup_psn <npsso>` once
4. MCP exchanges it for access + refresh tokens → saves to `~/.trophy-hunter/credentials.json`
5. Access tokens auto-refresh silently (expire every ~1 hour)
6. Refresh tokens last ~2 months, then user repeats step 1-3

**No ENV variables needed** — zero-config after first setup.

---

## Key Decisions (don't revisit without reason)

- **ytsr over YouTube Data API** — eliminates API key requirement for users
- **stdio transport** — simpler for mcpize.com npx distribution
- **getUserTitles to find games** — PSN requires game to be in user's trophy list (played at least once)
- **trophyEarnedRate IS available** from `getTitleTrophies` (string "67.4" → parse to float). Rarity: Common >50%, Rare 15–50%, Ultra Rare <15%
- **MCP = data layer only** — no guide scraping. Claude finds guides via web search. YouTube link kept as fallback in `get_trophy_list`.
- **v2 tools:** `get_my_games`, `get_trophy_list`, `suggest_next_trophy` (removed: `get_platinum_roadmap`, `find_easy_platinums`)

---

## Development Commands

```bash
npm run build       # compile TypeScript
npm run dev         # watch mode
npm run inspector   # build + open MCP Inspector at localhost:5173
node dist/index.js  # run server directly
```

## Local Testing

### MCP Inspector (no Claude needed)
```bash
npm run inspector
```

### Claude Code (this CLI)
`.mcp.json` is already configured in project root — just run `claude` here.

### Claude Desktop
```json
{
  "mcpServers": {
    "trophy-hunter": {
      "command": "node",
      "args": ["/Users/pavel/mcp-trophy-hunter/dist/index.js"]
    }
  }
}
```

---

## Publishing Checklist (mcpize.com)

- [ ] Update `name` in `package.json` with real npm username
- [ ] `npm run build && npm publish --access public`
- [ ] Verify `npx -y @username/mcp-trophy-hunter` works
- [ ] Submit to mcpize.com — Category: Gaming

---

## Skills Available

- `/mcp-expert` — MCP SDK patterns, mcpize.com publishing guidance
- `/flow` — auto plan-mode management for complex tasks
- `/spec-interview` — deep feature spec interviews

## MCP Servers Available in Dev

- **context7** — up-to-date docs for any npm library. Use before implementing with a new package:
  ```
  mcp__context7__resolve-library-id → mcp__context7__query-docs
  ```
  Useful for: psn-api, ytsr, youtube-transcript, @modelcontextprotocol/sdk, zod
