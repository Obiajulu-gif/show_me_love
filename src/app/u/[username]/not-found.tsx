import { NotFoundPage } from "@/components/NotFoundPage";

export default function NotFound() {
  return (
    <NotFoundPage
      title="No page lives here yet."
      body="This link is free. Claim the name before someone else does, and put your treat in your bio."
      primaryHref="/signup"
      primaryLabel="Claim this name"
      secondaryHref="/"
      secondaryLabel="Back to show-me-love"
    />
  );
}
