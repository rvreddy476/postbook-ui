import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WordsOnColour } from "../WordsOnColour";

test("a text card draws on stage tokens, links its hashtags, and keeps an author's own colour", () => {
  const card = renderToStaticMarkup(<WordsOnColour text="hi #there" rich={{ scale: 1.2 }} />);
  expect(card).toContain("rgb(var(--reel-stage))");
  expect(card).toContain("rgb(var(--reel-on-stage))");
  expect(card).toContain('href="/hashtag/there"');
  const own = renderToStaticMarkup(<WordsOnColour text="hello" rich={{ background: "var(--x)", text_color: "var(--y)" }} />);
  expect(own).toContain("background:var(--x)");
});
