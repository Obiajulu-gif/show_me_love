import { getCreatorByUser } from "@/lib/creators";
import { currentUserId } from "@/lib/session";

// Placeholder: Task 12 builds the real overview.
export default async function Overview() {
  const c = await getCreatorByUser((await currentUserId())!);
  return <h1 className="font-serif text-3xl italic">Welcome back, {c?.displayName || c?.username}.</h1>;
}
