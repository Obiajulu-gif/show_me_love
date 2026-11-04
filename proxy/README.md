# RAS relay (fixed outbound IP)

Roqqu's Cloudflare edge answers calls from cloud hosts such as Vercel with a
"Just a moment..." challenge (HTTP 403). This relay runs on a host with a
static outbound IP. Roqqu allowlists that IP, and the app sends its Roqqu calls
through the relay.

The relay forwards only `/v1/*` to `https://service.roqqu.com`. It passes the
RAS key headers through and stores no Roqqu key. It refuses any request
without the shared `x-proxy-token`, so it is not an open relay.

## Deploy on Fly.io

You need a Fly.io account, and a card on file for the static egress IP.

```bash
cd proxy
fly launch --copy-config --no-deploy        # keeps fly.toml, creates the app
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # save this token
fly secrets set PROXY_TOKEN=<the token>
fly deploy
fly machine list                            # note the machine id
fly machine egress-ip allocate <machine-id> # gives the static outbound IPv4
```

Then:

1. Send Roqqu the IPv4 from the last command, and ask them to allowlist it for
   API traffic to `service.roqqu.com`.
2. In Vercel, under show-me-love → Settings → Environment Variables (Production), set:
   - `ROQQU_BASE_URL` = `https://show-me-love-ras-relay.fly.dev/v1`
   - `RAS_PROXY_TOKEN` = the same token
3. Redeploy Vercel.

## Check it

```bash
curl https://show-me-love-ras-relay.fly.dev/healthz
```

That should return `{"ok":true}`.

Remove the two Vercel variables to go back to calling Roqqu directly.

## Run locally

```bash
PROXY_TOKEN=<24+ chars> node proxy/server.mjs
```

The relay listens on `:8080`.
