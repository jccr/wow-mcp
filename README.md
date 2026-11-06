# wow-mcp

MCP server that wraps the **complete World of Warcraft retail API** (Game Data + Profile) as 208 MCP tools. Supports **OAuth 2.1 authentication** (authorization code + PKCE for ChatGPT, client credentials for CLI tools) and is fully **region-agnostic** — every tool accepts `region` and `locale` as optional parameters, so a single server instance can query any region.

![screenshot](screenshot.png "Screenshot")


## Quick start

```bash
cp .env.example .env
# Fill in BNET_CLIENT_ID and BNET_CLIENT_SECRET

npm install
npm run build
npm start          # HTTP transport on http://localhost:3000/mcp
npm run start:stdio  # stdio transport (for clients that launch the server)
```

### Launching from an MCP client (stdio)

`dist/stdio.js` speaks MCP over stdin/stdout, so clients like Claude Code can start and stop the server themselves. It also starts the HTTP listener (best-effort) so the [Battle.net login](#battlenet-user-login) callback still works. Node doesn't load `.env` on its own, so pass it with `--env-file`.

You can also launch the dedicated **Wowhead Forever MCP server** (`dist/wowheadStdio.js`) for datamined client tooltips, stats, item scaling, and entity search.

Example `.mcp.json`:

```json
{
  "mcpServers": {
    "wow": {
      "type": "stdio",
      "command": "node",
      "args": ["--env-file=/path/to/wow-mcp/.env", "/path/to/wow-mcp/dist/stdio.js"]
    },
    "wowhead-forever": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/wow-mcp/dist/wowheadStdio.js"]
    }
  }
}
```

## Wowhead Forever MCP Server

For personal and experimental use querying [World of Warcraft: Forever client database](https://www.wowhead.com/forever):

- Automated Chrome browser User-Agent & `sec-ch-ua` headers masking
- Queries Wowhead Forever's `dataEnv: 16`
- Built-in TTL response caching
- Tooltip parser that converts raw HTML tooltips into clean Markdown with stats, requirements, damage/speed, and sell price

### Tools available:
- `wowhead_search` — Search entities (items, spells, quests, NPCs, objects, zones, guides, classes) with optional type filtering and limits
- `wowhead_lookup` — Quick one-shot lookup: searches by query and immediately returns formatted stats and tooltips for the top match
- `wowhead_get_item` — Detailed item stats, level, damage, armor, effects, and tooltip by item ID
- `wowhead_get_spell` — Spell description, cast time, mana cost, range, and buff info by spell ID
- `wowhead_get_quest` — Quest objectives, rewards (items with type/DPS/stats/restrictions, XP, money, reputation), level, side, start/end NPCs with map locations, quest chain, and a `rewardsStatus` of `ok`/`none`/`unavailable`
- `wowhead_list_zone_quests` — Quests in one or more zones with levels, sides, rewards, and class/race restrictions; filter by faction, level, and completed quests
- `wowhead_find_quest_rewards` — Quest reward weapons/armor across zones that a character can use (class proficiency, race, level), optionally compared against the equipped item, with quest giver locations
- `wowhead_compare_items` — DPS, speed, armor, item level, and stat deltas of candidate items versus an equipped item, with usability checks
- `wowhead_get_npc` — NPC name, level, classification (Boss, Elite), tooltip, and location (zone, map coordinates, `/way` waypoint) by NPC ID
- `wowhead_get_object` — Interactive game object details by object ID
- `wowhead_get_zone` — Zone territory and recommended level range by zone ID
- `wowhead_get_item_set` — Set pieces and tier bonuses by item set ID
- `wowhead_get_tooltip` — Generic tooltip fetcher for any supported Wowhead Forever entity type

### Development

```bash
npm run dev        # runs via tsx (no build step)
npm run inspect    # opens MCP Inspector UI
npm run lint       # type-check only
npm test           # run auth integration tests
```

## API coverage

All 205 WoW API endpoints are registered as individual MCP tools, plus three custom tools:

- **Game Data API** — 161 tools covering achievements, auctions, azerite essences, connected realms, covenants, creatures, guild crests, heirlooms, items, journals, media, modified crafting, mounts, mythic keystones, mythic raid leaderboards, pets, playable classes, playable races, playable specializations, power types, professions, PvP seasons, PvP tiers, quests, realms, regions, reputations, search endpoints, spells, talents, tech talents, titles, toys, and WoW tokens.
- **Profile API** — 35 tools for character profiles, achievements, appearance, collections, dungeons, encounters, equipment, hunter pets, media, mythic keystone profile, professions, PvP, quests, reputations, soulbinds, specializations, statistics, titles, and guild endpoints.
- **Account Profile API** — 9 tools (`wow_account_*`) for the logged-in Battle.net account: all your characters, protected character data, and account-wide collections (mounts, pets, toys, transmogs, heirlooms, decor). These need [Battle.net user login](#battlenet-user-login).
- **Custom** — `wow_character_achievementsTimeline` builds a chronologically sorted timeline of completed achievements (computed, not a raw Blizzard endpoint), plus `wow_account_login` / `wow_account_logout`.

### Region & locale

Every tool accepts two optional parameters:

- `region` — `"us"` (default), `"eu"`, `"kr"`, or `"tw"`
- `locale` — `"en_US"` (default), or any locale supported by the target region (e.g. `"es_MX"`, `"de_DE"`, `"fr_FR"`, `"ko_KR"`)

No region configuration is needed in the environment. The same Battle.net credentials work across all regions.

### Game version (Retail / Classic / Forever)

Every tool also accepts:

- `game` — `"retail"` (default), `"classic"`, or `"forever"` ([World of Warcraft: Forever](https://worldofwarcraft.blizzard.com/en-us/forever)). This picks the Blizzard namespace:

  | game      | namespace               | example             |
  |-----------|-------------------------|---------------------|
  | `retail`  | `{type}-{region}`         | `static-us`         |
  | `classic` | `{type}-classic-{region}` | `static-classic-us` |
  | `forever` | `{type}-forever-{region}` | `static-forever-us` |

- `namespace` — optional full namespace override, e.g. `"static-1.60.1_70399-forever-us"`. Blizzard has not officially documented the Forever namespaces yet. If the derived namespace returns 403/404, pass the versioned one here.

Retail-only tools (covenants, soulbinds, azerite, Mythic+, housing, heirlooms, etc.) return an error when `game` is not `retail`.

**Forever characters** have a surname instead of a realm, and Blizzard addresses them as `/profile/wow/character/{name}-{surname}` with no realm in the path. For `wow_character_*` tools with `game: "forever"`, leave out `realmSlug` and either pass `characterName: "doja-zap"` or pass `characterName: "Doja"` with `surname: "Zap"`. `wow_account_profileSummary` lists each character's name and surname. `realmSlug` is still required for retail and classic.

> **Forever caveats (as of launch):** `dynamic-forever-*` (auctions, realms) reportedly returns 403. Character lookups work with the `{name}-{surname}` form above, and account-level profile data (`/profile/user/wow`, i.e. the `wow_account_*` tools) works under `profile-forever-{region}` once you log in.

## Battle.net user login

The `wow_account_*` tools read data only the account owner can see, so they need you to log in to Battle.net once (the server keeps one linked account).

**One-time setup** on [develop.battle.net](https://develop.battle.net/access/clients) → your client → **Redirect URLs**, add the URL Battle.net should send you back to. It must match `BNET_REDIRECT_URI` exactly:

- Running locally: `http://localhost:3000/bnet/callback` (the default)
- Deployed: `https://your-host.example.com/bnet/callback`, and set `BNET_REDIRECT_URI` to the same value

**Logging in:** ask your MCP client to run `wow_account_login`. It returns a one-time link (valid 10 minutes). Open it, log in to Battle.net and approve access; the page then says the account is linked. Battle.net logins last about 24 hours and have no refresh token, so run `wow_account_login` again when the tools say the login expired.

With `DATABASE_URL` set, the login survives server restarts; otherwise it is kept in memory.

## Environment variables

See [`.env.example`](.env.example). Only two are required:

- `BNET_CLIENT_ID` — Battle.net OAuth client ID
- `BNET_CLIENT_SECRET` — Battle.net OAuth client secret

Optional Battle.net user login:

- `BNET_REDIRECT_URI` — where Battle.net sends you after login (default: `http://localhost:3000/bnet/callback`). Must match a redirect URL registered for your client.

Optional auth (OAuth 2.1 for the MCP HTTP endpoint):

- `MCP_AUTH_SECRET` — passphrase that enables OAuth. Used as the login on the `/authorize` page (for ChatGPT / browser clients), as the `client_secret` for `client_credentials` grants, and directly as a static `Bearer` token for simple clients (Warp, curl, etc.).
- `MCP_TOKEN_TTL_SECONDS` — access token lifetime (default: `3600`)
- `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://user:pass@host:5432/db`). When set, OAuth tokens, clients, and auth codes are persisted in PostgreSQL so they survive restarts. When absent, in-memory stores are used. The `docker-compose.yml` sets this up automatically.

When `MCP_AUTH_SECRET` is set, the server exposes a full OAuth 2.1 provider:

- `GET /.well-known/oauth-protected-resource` — RFC 9728 metadata
- `GET /.well-known/oauth-authorization-server` — RFC 8414 metadata (includes `code_challenge_methods_supported: ["S256"]`)
- `POST /register` — RFC 7591 dynamic client registration
- `GET|POST /authorize` — authorization code + PKCE flow with passphrase login
- `POST /token` — supports `authorization_code` (with PKCE) and `client_credentials` grants

The `MCP_AUTH_SECRET` value can also be passed directly as a `Bearer` token (e.g. `Authorization: Bearer <your-secret>`) — useful for clients like Warp that don't support OAuth flows.

If `MCP_AUTH_SECRET` is not set, the server runs without auth.

Optional tuning:

- `LOG_LEVEL` — pino log level (default: `info`)
- `HTTP_TIMEOUT_MS` — request timeout (default: `15000`)
- `HTTP_RETRY_LIMIT` — retry count (default: `2`)
- `CACHE_TTL_SECONDS` — response cache TTL (default: `300`)
- `CACHE_SIZE` — max cached entries (default: `500`)

## Testing

```bash
npm test
```

Integration tests use Node's built-in test runner (`node:test`) via `tsx` — no extra test dependencies. The suite spins up the server on a random port with test credentials and verifies OAuth 2.1 auth end-to-end:

- Serves `/.well-known/oauth-protected-resource` metadata
- Serves `/.well-known/oauth-authorization-server` metadata with S256
- Registers a new client via `POST /register`
- Rejects `/mcp` without a token (401 with `resource_metadata` hint)
- Rejects `client_credentials` with wrong secret (401)
- Issues token via `client_credentials` with correct secret (200)
- Completes full authorization_code + PKCE flow (register → authorize → token → /mcp)
- Allows `/mcp` with `MCP_AUTH_SECRET` as a static bearer token (200)
- Rejects `/mcp` with a bogus token (401)

## Docker

```bash
docker compose build
docker compose up -d
```

Secrets are injected via `.env` on the host (not committed). The container runs as a non-root user with production dependencies only.

The compose stack includes a PostgreSQL instance for persistent OAuth token storage. PostgreSQL data is bind-mounted to `./data/postgres/` on the host (maps to `/var/lib/postgresql/data` inside the container), so it persists across container recreates, host reboots, and Docker engine upgrades. `DATABASE_URL` is pre-configured automatically.

> **NAS / self-hosting note:** make sure the `data/postgres/` directory is on a reliable filesystem. Back up this folder to preserve all OAuth state.

## Architecture

```
src/
  index.ts                          # entry point — loads env, starts HTTP server
  stdio.ts                          # stdio entry point for client-launched use
  app.ts                            # HTTP server factory (all routes)
  auth.ts                           # OAuth 2.1 provider (metadata, registration, authorize, token, bearer validation)
  config/
    env.ts                          # zod env parsing (credentials + tuning)
    regions.ts                      # region enum, API hosts, OAuth URL
  store/
    types.ts                        # OAuthStore interface + record types
    memory.ts                       # in-memory store (default)
    postgres.ts                     # PostgreSQL store (when DATABASE_URL set)
    index.ts                        # factory — picks store based on env
  mcp/
    tools.ts                        # auto-registers all endpoints + custom tools
    schemas.ts                      # shared zod input schemas
  wowhead/
    client.ts                       # Wowhead Forever client with Chrome UA & dataEnv 16
    formatter.ts                    # Tooltip HTML to clean Markdown formatter
    tools.ts                        # MCP tools for Wowhead Forever
    server.ts                       # Wowhead McpServer factory
    types.ts                        # Entity, suggestion, and tooltip types
  wowheadStdio.ts                   # stdio entry point for Wowhead Forever MCP server
  blizzard/
    tokenManager.ts                 # OAuth client-credentials + single-flight
    userAuth.ts                     # Battle.net user login (authorization code) + /bnet/callback
    client.ts                       # got wrapper: bearer injection, cache, 401 retry
    endpoints/
      types.ts                      # EndpointDef interface, buildPath(), schema helpers
      gamedata.ts                   # 161 Game Data API endpoint definitions
      profileEndpoints.ts           # 35 Profile API endpoint definitions
      accountEndpoints.ts           # 9 Account Profile API endpoint definitions (user login)
    schemas/
      characterSchemas.ts           # zod response schemas
      achievementSchemas.ts
    dto/
      characterDto.ts               # normalized character DTO
      timeline.ts                   # achievement timeline builder
  util/
    http.ts                         # got defaults
    cache.ts                        # TTL cache
    logger.ts                       # pino (stderr)
test/
  auth.test.ts                      # OAuth2 auth integration tests
  bnetLogin.test.ts                 # Battle.net user login tests
```

Endpoints are defined declaratively in `gamedata.ts` and `profileEndpoints.ts`. Each entry specifies a tool name, path template, namespace type, and zod input schema. The `tools.ts` module iterates over the registry and auto-registers every entry as an MCP tool, injecting `region`, `locale`, `game` and `namespace` parameters automatically.
