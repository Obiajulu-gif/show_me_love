# Connect starter

A tiny, standalone Next.js app that shows the whole show-me-love Connect flow: Connect button, callback with a state check, showing the support link, and Disconnect. It uses plain `fetch` against the HTTP API, with no SDK.

The login here is a fake, **demo only**: it sets a cookie with a made-up user id. In your own app, take `user_ref` from your real session on the server.

## Run it

1. In the show-me-love app, open Developers, create a **Sandbox** app with the redirect link `http://localhost:3001/api/sml/callback`, and create a key.
2. Copy `.env.example` to `.env.local` and paste your values (`SML_ORIGIN` is where show-me-love runs, for example `http://localhost:3000`).
3. Run:

   ```
   npm i && npm run dev -- -p 3001
   ```

4. Open http://localhost:3001, log in as the demo user, and click **Connect show-me-love**. Allow on the next screen and you will land back here with your support link.
5. To test the other paths: press Deny, or revoke the app from the Share page in show-me-love and reload (it shows "Not connected").

Keys are read only in server code (`lib/sml.ts` and the route handlers). Never expose `SML_API_KEY` to the browser.
