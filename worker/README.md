# streaks-sync (Cloudflare Worker)

The cloud half of sync. One endpoint, `POST /sync`: a device sends all its habits with its sync
code, the Worker merges them with the stored copy (same `src/merge.ts` as the app), saves the
result in **Workers KV** and sends it back. Each device then merges that reply into its own data.

- **Worker:** a small function Cloudflare runs in its data centres when a request arrives. No
  server to manage; the free plan allows 100,000 requests a day.
- **KV:** Cloudflare's key-value store. Key = `habits:<SHA-256 of the sync code>`, value = the JSON.
  The code itself is never stored, so a leaked database can't be used to sync.

## Run it locally (no account needed)

```sh
npm run worker:dev        # http://localhost:8787, KV simulated on disk in worker/.wrangler
VITE_SYNC_URL=http://localhost:8787 npm run dev   # web app talking to the local Worker
```

## Deploy (one time, ~5 minutes)

```sh
npx wrangler login                                   # opens the browser; free Cloudflare account
npx wrangler kv namespace create STREAKS -c worker/wrangler.toml
# paste the printed id into worker/wrangler.toml (replace REPLACE_WITH_YOUR_KV_NAMESPACE_ID)
npm run worker:deploy                                # prints https://streaks-sync.<you>.workers.dev
gh variable set SYNC_URL --body https://streaks-sync.<you>.workers.dev
gh workflow run pages.yml                            # rebuild the phone app with sync turned on
```

For the Mac app, build with the same URL: `VITE_SYNC_URL=https://… npm run mac:build`.

## Limits worth knowing

- Anyone with a sync code can read and change that data. Treat it like a password.
- KV is "eventually consistent": two devices writing within the same second can briefly see
  different copies. That's harmless here, because the next sync merges them again and merge
  never loses a change.
- No rate limiting. Fine for personal use; add Cloudflare's rate limiting rules if it's ever shared.
