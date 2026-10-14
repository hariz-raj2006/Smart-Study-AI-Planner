import '../styles/rich.css';

const ITEM_RE = /^\s*(?:[-*\u2022]|\d+[.)])\s+(.*)$/;
const NUMBERED_RE = /^\s*\d+[.)]\s+/;

/** **bold** inside a line. Everything is rendered as plain React text, so no HTML can be injected. */
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.length > 4 && part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
  );
}

/** Turns an AI answer into paragraphs and bullet / numbered lists. */
export default function FormattedText({ text }) {
  const blocks = [];
  let list = null;
  const flush = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .forEach((line) => {
      const item = line.match(ITEM_RE);
      if (item) {
        const numbered = NUMBERED_RE.test(line);
        if (!list || list.numbered !== numbered) {
          flush();
          list = { kind: 'list', numbered, items: [] };
        }
        list.items.push(item[1]);
      } else if (line.trim() === '') {
        flush();
      } else {
        flush();
        blocks.push({ kind: 'p', text: line.replace(/^#{1,6}\s+/, '') });
      }
    });
  flush();

  return (
    <div className="rich">
      {blocks.map((b, i) => {
        if (b.kind === 'p') return <p key={i}>{inline(b.text)}</p>;
        const Tag = b.numbered ? 'ol' : 'ul';
        return (
          <Tag key={i}>
            {b.items.map((it, j) => (
              <li key={j}>{inline(it)}</li>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}