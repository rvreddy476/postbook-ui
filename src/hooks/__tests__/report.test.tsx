import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { REPORTS_PATH, reportRequestBody } from "@/hooks/useReport";
import { ToastProvider } from "@/contexts/ToastContext";
import { ReelReportDialog } from "@/features/reels/components/ReelReportDialog";

/*
  Audit T-02: a report from a feed card or /post/<id> must reach
  trust-safety. PostCard used to prompt() for free text and POST it to
  /v1/posts/:id/report, a route post-service does not have, so every report
  was lost. It now opens the shared report dialog, which files through
  useSubmitReport.
*/

describe("useSubmitReport wire shape", () => {
  test("files to trust-safety's POST /v1/reports", () => {
    expect(REPORTS_PATH).toBe("/v1/reports");
  });

  test("a post report is entity_type post with the post id, reason and details", () => {
    expect(reportRequestBody({ targetType: "post", targetId: "p-1", reason: "spam", description: "bot" })).toEqual({
      entity_type: "post",
      entity_id: "p-1",
      reason: "spam",
      details: "bot",
    });
  });

  test("reels and videos are posts; details is never undefined", () => {
    expect(reportRequestBody({ targetType: "reel", targetId: "r-1", reason: "nudity" })).toEqual({
      entity_type: "post",
      entity_id: "r-1",
      reason: "nudity",
      details: "",
    });
    expect(reportRequestBody({ targetType: "video", targetId: "v-1", reason: "other" }).entity_type).toBe("post");
    expect(reportRequestBody({ targetType: "comment", targetId: "c-1", reason: "other" }).entity_type).toBe("comment");
  });
});

function renderDialog(targetType?: "reel" | "post") {
  const client = new QueryClient();
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ReelReportDialog open targetId="p-1" targetType={targetType} onClose={() => {}} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("the shared report dialog", () => {
  test("speaks of a post when reporting a post", () => {
    const html = renderDialog("post");
    expect(html).toContain('aria-label="Report post"');
    expect(html).toContain("Report this post");
    expect(html).toContain("Send report");
    expect(html).not.toContain("this reel");
  });

  test("still speaks of a reel by default (the reels stage)", () => {
    const html = renderDialog();
    expect(html).toContain('aria-label="Report reel"');
    expect(html).toContain("Report this reel");
  });
});

describe("PostCard report wiring", () => {
  const source = readFileSync(resolve(import.meta.dir, "../../components/PostCard.tsx"), "utf8");

  test("no prompt() and no call to the non-existent /v1/posts/:id/report", () => {
    expect(source).not.toMatch(/\bprompt\(/);
    expect(source).not.toContain("/report`");
    expect(source).not.toContain("from '@/lib/api'");
  });

  test("Report a concern opens the shared dialog on this post", () => {
    expect(source).toContain("import { ReelReportDialog } from '@/features/reels/components/ReelReportDialog';");
    expect(source).toMatch(/<ReelReportDialog\s+open=\{showReportDialog\}\s+targetId=\{post\.id\}/);
    expect(source).toMatch(/const handleReport = \(\) => \{\s+closeMenu\(\);\s+setShowReportDialog\(true\);/);
  });
});
