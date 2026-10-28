import { cookies } from "next/headers";

import { DEMO_USER_ID } from "../lib/demo";
import { sml } from "../lib/sml";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ denied?: string; error?: string }> }) {
  const q = await searchParams;
  const loggedIn = !!(await cookies()).get("demo_user");
  const conn = loggedIn ? await sml("/connection?user_ref=" + encodeURIComponent(DEMO_USER_ID)) : null;

  return (
    <main>
      <h1>Connect starter</h1>
      {q.denied && <p>You pressed Deny, so nothing was connected.</p>}
      {q.error && <p role="alert">Something went wrong: {q.error}</p>}
      {!loggedIn ? (
        <form method="post" action="/api/demo/login">
          <p><strong>Demo only:</strong> this fake login sets a cookie with a made-up user id. Use your real sign-in in your own app.</p>
          <button>Log in as the demo user</button>
        </form>
      ) : conn?.status === 200 ? (
        <>
          <p>Connected to <strong>{String(conn.data.display_name)}</strong>.</p>
          <p>Support link: <a href={String(conn.data.support_url)}>{String(conn.data.support_url)}</a></p>
          <form method="post" action="/api/sml/disconnect"><button>Disconnect</button></form>
        </>
      ) : (
        <>
          <p>Not connected.</p>
          <form method="post" action="/api/sml/connect"><button>Connect show-me-love</button></form>
        </>
      )}
    </main>
  );
}
