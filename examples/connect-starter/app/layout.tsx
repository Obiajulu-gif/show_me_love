export const metadata = { title: "Connect starter" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body style={{ fontFamily: "system-ui", maxWidth: 520, margin: "40px auto", padding: "0 16px" }}>{children}</body></html>;
}
