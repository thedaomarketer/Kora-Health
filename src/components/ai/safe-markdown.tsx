import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * Minimal, safe Markdown for AI and system text: paragraphs, **bold**,
 * *italic*, bullet/numbered lists, "---" rules, [links](/internal) and
 * [[specialty:slug]] markers. Never uses dangerouslySetInnerHTML; only
 * internal links and https links (opened safely) are rendered as anchors.
 */
export function SafeMarkdown({ text, specialties }: { text: string; specialties?: Record<string, string> }) {
  const withMarkers = text.replace(/\[\[specialty:([a-z0-9-]+)\]\]/g, (_m, slug: string) =>
    specialties?.[slug] ? `[${specialties[slug]}](/providers?specialty=${slug})` : "",
  );
  const blocks = withMarkers.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <Fragment key={i}>{renderBlock(block)}</Fragment>
      ))}
    </div>
  );
}

type Segment = { kind: "ul" | "ol" | "p" | "hr"; lines: string[] };

/** Split a block into runs of paragraph lines, bullet items and numbered items. */
function renderBlock(block: string): ReactNode {
  const segments: Segment[] = [];
  for (const raw of block.split("\n")) {
    if (!raw.trim()) continue;
    const kind: Segment["kind"] = /^\s*---+\s*$/.test(raw) ? "hr" : /^\s*[-*•]\s+/.test(raw) ? "ul" : /^\s*\d+[.)]\s+/.test(raw) ? "ol" : "p";
    const last = segments[segments.length - 1];
    if (last && last.kind === kind && kind !== "hr") last.lines.push(raw);
    else segments.push({ kind, lines: [raw] });
  }
  return segments.map((seg, i) => {
    if (seg.kind === "hr") return <hr key={i} className="border-line" />;
    if (seg.kind === "ul")
      return (
        <ul key={i} className="list-disc space-y-1 pl-5">
          {seg.lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>)}
        </ul>
      );
    if (seg.kind === "ol")
      return (
        <ol key={i} className="list-decimal space-y-1 pl-5">
          {seg.lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>)}
        </ol>
      );
    return (
      <p key={i}>
        {seg.lines.map((l, j) => (
          <Fragment key={j}>
            {j > 0 ? <br /> : null}
            {inline(l.replace(/^#+\s*/, ""))}
          </Fragment>
        ))}
      </p>
    );
  });
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const href = m[2];
      if (href.startsWith("/") && !href.startsWith("//")) {
        out.push(<Link key={key++} href={href} className="font-semibold underline underline-offset-2">{m[1]}</Link>);
      } else if (/^https:\/\//.test(href)) {
        out.push(<a key={key++} href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold underline underline-offset-2">{m[1]}</a>);
      } else {
        out.push(m[1]);
      }
    } else if (m[3] !== undefined) {
      out.push(<strong key={key++}>{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      out.push(<em key={key++}>{m[4]}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
