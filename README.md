# mcp-trophy-hunter

MCP server for PlayStation trophy hunting. Gives Claude access to your PSN data — games closest to platinum, full trophy lists with rarity, and personalized next-step suggestions.

## Tools

| Tool | Description |
|------|-------------|
| `setup_psn` | One-time PSN authentication using your NPSSO token |
| `check_psn_auth` | Verify auth status and token expiry |
| `get_my_games` | Top-20 games closest to platinum, sorted by progress |
| `get_trophy_list` | Full trophy list for a game with rarity (Common/Rare/Ultra Rare), sorted easiest first + YouTube guide link |
| `suggest_next_trophy` | Analyze your profile and recommend the best trophies to go for next |

## Installation

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "trophy-hunter": {
      "command": "npx",
      "args": ["-y", "@pavlo-skuibida/mcp-trophy-hunter"]
    }
  }
}
```

Then restart Claude Desktop.

## First-time Setup

You need to authenticate with PSN once:

1. **Open this URL in your browser** (must be logged in to PSN):
   ```
   https://ca.account.sony.com/api/v1/ssocookie
   ```

2. You'll see a JSON response like:
   ```json
   {"npsso":"4ab6c...your-token..."}
   ```

3. Copy the `npsso` value and tell Claude:
   ```
   setup_psn 4ab6c...your-token...
   ```

Tokens are saved locally in `~/.trophy-hunter/credentials.json` and auto-refreshed. You'll need to repeat this roughly every 2 months when the refresh token expires.

## Usage Examples

```
Which of my games is closest to platinum?

Show me the trophy list for God of War Ragnarök

What trophy should I go for next?

Suggest something easy to platinum this weekend
```

## Local Development

```bash
npm install
npm run build
npm run inspector   # opens MCP Inspector at localhost:5173
```

## License

MIT
