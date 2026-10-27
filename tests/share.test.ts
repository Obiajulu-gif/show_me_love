import { afterEach, expect, test } from "vitest";
import { creatorLink, embedHtml, shareText, whatsappLink, xIntent } from "@/lib/share";

afterEach(() => { delete process.env.PUBLIC_APP_URL; });

test("embedHtml escapes every interpolated value", () => {
  const h = embedHtml({ username: "ada_bakes", displayName: 'A"<b>', treatName: "Zobo <i>'s", accent: "honey" }, "https://sml.test");
  expect(h).toContain("A&quot;&lt;b&gt;");
  expect(h).not.toContain("<b>");
  expect(h).not.toContain("<i>");
  expect(h).toContain("&#39;");
  expect(h).toContain('href="https://sml.test/@ada_bakes"');
  expect(h).toContain('target="_blank"');
  expect(h).toContain('rel="noopener"');
  expect(h).toContain("Send me a Zobo");
});

test("embedHtml guards the url and unknown accents", () => {
  const h = embedHtml({ username: 'x"><script>', displayName: "A", treatName: "T", accent: 'red;"' }, "https://sml.test");
  expect(h).not.toContain("<script>");
  expect(h).not.toContain('red;"');
});

test("xIntent and whatsappLink url-encode the text", () => {
  expect(xIntent("hi & bye")).toBe("https://x.com/intent/post?text=hi%20%26%20bye");
  expect(whatsappLink("a&b\nc")).toBe("https://wa.me/?text=a%26b%0Ac");
});

test("creatorLink and shareText", () => {
  process.env.PUBLIC_APP_URL = "https://sml.test/";
  expect(creatorLink("ada")).toBe("https://sml.test/@ada");
  expect(creatorLink("ada", "https://o.test")).toBe("https://o.test/@ada");
  expect(shareText("hello", "https://l")).toBe("hello\nhttps://l");
});
