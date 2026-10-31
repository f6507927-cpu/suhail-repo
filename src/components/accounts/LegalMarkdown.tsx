import Markdown from "react-markdown";

// The supplied provider table is text only. No raw HTML or extra Markdown plugins.
export function LegalMarkdown({ markdown }: { markdown: string }) {
  return markdown.split(/(\|[^\n]+\|\n(?:\|[^\n]+\|\n?)+)/g).map((part, index) => {
    if (!part.startsWith("|")) return <Markdown key={index} skipHtml>{part}</Markdown>;
    const rows = part.trim().split("\n").map(line => line.slice(1, -1).split("|").map(cell => cell.trim()));
    return (
      <div key={index} className="overflow-x-auto">
        <table className="w-full border-collapse text-start">
          <thead><tr>{rows[0].map((cell, i) => <th key={i} scope="col" className="border border-current p-2 text-start">{cell}</th>)}</tr></thead>
          <tbody>{rows.slice(2).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="border border-current p-2">{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  });
}
