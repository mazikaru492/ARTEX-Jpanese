package report

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/Autumn-27/artex/db"
)

func TestJapaneseReportsKeepMarkdownAndEvidence(t *testing.T) {
	generated := time.Date(2026, 10, 17, 12, 0, 0, 0, time.UTC)
	findings := FindingsMarkdown(nil, generated)
	if !strings.Contains(findings, "| 深刻度 | 件数 |\n| --- | --- |\n") || !strings.Contains(findings, "## 要約\n") {
		t.Fatalf("missing Markdown summary table: %s", findings)
	}
	proof := "GET /sample?id=1 HTTP/1.1"
	payload, err := json.Marshal(map[string]any{
		"name": "日本語の検出結果", "severity": "high", "summary": "検証内容",
		"evidence": map[string]string{"poc": proof},
	})
	if err != nil {
		t.Fatal(err)
	}
	output := Markdown(Input{Title: "日本語のタスク", GeneratedAt: generated, Findings: []*db.Node{{Payload: payload}}})
	if !strings.Contains(output, "## 検出結果\n") || !strings.Contains(output, "```\n"+proof+"\n```") {
		t.Fatalf("report lost heading or original evidence: %s", output)
	}
}
