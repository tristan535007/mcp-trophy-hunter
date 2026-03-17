# Feature: MCP Trophy Hunter v2 — PSN Data Layer

## Overview

Architecture redesign: the MCP focuses exclusively on personal PSN data (your games, progress, trophies, rarity). Guides are left to Claude via web search or training knowledge — this produces significantly better and more detailed answers than YouTube transcripts ever could. The MCP becomes a personal progress analyst, not a guide scraper.

**Target audience:** published on mcpize.com, Claude Desktop + claude.ai users

---

## Requirements

### Functional

#### `get_my_games`
- Returns top-20 games closest to platinum (sorted by progress % descending, excluding 100%)
- Each game: title, platform (PS4/PS5), progress %, remaining trophies by type (Gold/Silver/Bronze)
- Format: markdown table

#### `get_trophy_list(game)`
- Replaces `get_platinum_roadmap`
- Returns all trophies grouped by type: Gold → Silver → Bronze → Platinum
- Earned trophies: ✅ strikethrough text
- Unearned trophies: name, description, rarity label + earned rate %
- Rarity labels: `Common` (>50%), `Rare` (15–50%), `Ultra Rare` (<15%)
- Sorting of unearned: Common first (easiest), then Rare, then Ultra Rare — optimal completion order
- YouTube link to a general guide (no transcript) — fallback for users without web search
- Format: markdown

#### `suggest_next_trophy(limit?)`
- Analyzes top-N games (default limit=5) closest to platinum
- For each of the top-3 games: fetches trophies + earned status
- Returns structured analysis:
  - Top-3 games with % to platinum and reasoning
  - 2–3 specific unearned Common trophies from each game
  - If missable trophies exist — warning WITHOUT story/plot details

#### `setup_psn(npsso)` — unchanged
#### `check_psn_auth` — unchanged

### Remove
- `get_platinum_roadmap` → replaced by `get_trophy_list`
- `find_easy_platinums` → doesn't fit the new personal profile concept

### Non-Functional
- `get_my_games`: response < 3s (single PSN API call)
- `get_trophy_list`: response < 5s (parallel trophy list + earned requests)
- `suggest_next_trophy`: response < 10s (up to 5 games × 2 requests in parallel)
- Works without web search on the user's end (YouTube links as fallback)

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Guides | Remove from MCP | Claude with web search gives 10x better results than YouTube transcripts |
| YouTube links | Keep in get_trophy_list | Fallback for users without web search |
| PowerPax scraping | Remove | Claude finds guides better on its own |
| YouTube transcripts | Remove | Low-quality fallback that polluted output |
| Rarity | trophyEarnedRate from PSN API | Real data, not heuristics |
| Sorting | Common first | Optimal path to platinum: easy trophies first |
| Output format | Markdown (same as now) | Compatibility with current behavior |
| get_my_games limit | Top-20 by progress % | Balance between completeness and speed |
| suggest limit | N games, parallel fetching | Manageable PSN API load |

---

## Tool Specifications

### `get_my_games`

**Output:**
```markdown
## My Games (Closest to Platinum)

| Game | Platform | Progress | Remaining |
|------|----------|----------|-----------|
| God of War Ragnarök | PS5 | 91% | 0G · 2S · 3B |
| INDIKA | PS5 | 49% | 5G · 5S · 0B |
| Erica | PS4 | 30% | 3G · 4S · 8B |
```

### `get_trophy_list(game)`

**Output:**
```markdown
# Trophies: INDIKA
**Platform:** PS5 · **Progress:** 49% · **Remaining:** 10 trophies

🎬 [Full Guide on YouTube](url) — Channel Name

## 🥇 Gold (4 remaining)

| Trophy | Description | Difficulty |
|--------|-------------|------------|
| **Jeweler** | Never fall in the fish dryer | Common (67%) |
| **Full set** | Find a pair of bast shoes | Rare (23%) |
| ✅ ~~Desire for a kiss~~ | ~~Drown 10 times~~ | — |

## 🥈 Silver ...
## 🥉 Bronze ...
## 🏆 Platinum ...
```

### `suggest_next_trophy(limit?)`

**Output:**
```markdown
## What to Do Next

Analyzed your top-5 games. Here are my recommendations:

### 1. 🎯 God of War Ragnarök — 91% (5 trophies left)
Almost done. All remaining are Common collectibles.
- **Collector** — collect all Relics (Common, 54%)
- **Dragon Slayer** — craft Dragon Scaled Armor (Common, 61%)
- **The Florist** — flower in each of the 9 realms (Common, 58%)

### 2. 🎮 INDIKA — 49% (10 trophies left)
Good base. Some easy trophies available.
- **Jeweler** — never fall in the fish dryer (Common, 67%)
...

### 3. ...

⚠️ **Missable in INDIKA:** some trophies can be permanently missed.
Ask for details on a specific game.
```

---

## Edge Cases

| Scenario | Behavior | Rationale |
|----------|----------|-----------|
| Game not in library | Clear error with instructions | Must play at least once |
| PSN API rate limit | Retry once, then error with explanation | Don't break the session |
| trophyEarnedRate = null | Show "N/A" instead of label | Not all trophies have rarity data |
| suggest: all games 100% | Inform user everything is done, suggest get_my_games | Rare but real case |
| suggest: game at 0% (not started) | Exclude from analysis | No earned data for ranking |
| Missable trophy | Warn without story details | Respect first playthroughs |

---

## Out of Scope

- PowerPax / PSNProfiles scraping — Claude does this better on its own
- YouTube transcripts — polluted output, Claude finds better guides independently
- `find_easy_platinums` — generic lists, not personalized
- Time-to-earn estimates (no reliable data source)
- Auto-detecting "first playthrough" — user specifies this in the prompt
- Filtering PSN trophy descriptions for spoilers (MCP uses PSN descriptions as-is)

---

## Implementation Notes

### Files to change
- `src/tools/roadmap.ts` → refactor into `get_trophy_list` (remove YouTube transcripts + PowerPax, add rarity)
- `src/tools/easy.ts` → delete
- `src/tools/suggest.ts` → NEW: `suggest_next_trophy`
- `src/tools/games.ts` → NEW: `get_my_games`
- `src/clients/youtube.ts` → remove `getVideoTranscript`, `getFullTranscript` (keep only `searchYouTube` for YouTube links)
- `src/clients/powerpyx.ts` → delete
- `src/index.ts` → update tool registration

### PSN API for rarity
`getTitleTrophies` returns `trophyEarnedRate` (string "67.4") — convert to number and rarity category.

### Parallelism in suggest_next_trophy
```ts
// Get top-N games from getUserTitles
// For each, in parallel: getTitleTrophies + getUserTrophiesEarnedForTitle
// Rank by: progress % DESC, count of Common unearned DESC
```

### Migration
1. Rename `get_platinum_roadmap` → `get_trophy_list` (breaking change — ok for v2)
2. Delete `find_easy_platinums`
3. Add `get_my_games` and `suggest_next_trophy`
4. Update README and CLAUDE.md

---

## Open Questions

- Should `get_trophy_list` have a `spoiler_free: boolean` param for explicit spoiler control?
- How to handle games without a platinum (some PS3/Vita titles)?
- Should `get_my_games` support a platform filter (e.g. PS5 only)?
