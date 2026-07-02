import { markdownToTipTap, stripCodeFences } from '@/lib/utils/markdown-to-tiptap';

describe('markdownToTipTap', () => {
  it('returns a doc with a single empty paragraph for empty input', () => {
    const doc = markdownToTipTap('');
    expect(doc.type).toBe('doc');
    expect(doc.content).toEqual([{ type: 'paragraph', content: [] }]);
  });

  it('returns a single empty paragraph for whitespace-only input', () => {
    const doc = markdownToTipTap('   \n\n   ');
    expect(doc.content).toEqual([{ type: 'paragraph', content: [] }]);
  });

  it('parses headings of all levels', () => {
    const doc = markdownToTipTap('# H1\n## H2\n###### H6');
    expect(doc.content).toHaveLength(3);
    expect(doc.content[0]).toMatchObject({ type: 'heading', attrs: { level: 1 } });
    expect(doc.content[1]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
    expect(doc.content[2]).toMatchObject({ type: 'heading', attrs: { level: 6 } });
    expect(doc.content[0].content).toEqual([{ type: 'text', text: 'H1' }]);
  });

  it('does not treat 7+ hashes as a heading', () => {
    const doc = markdownToTipTap('####### Not a heading');
    expect(doc.content[0].type).toBe('paragraph');
  });

  it('parses a horizontal rule for ---, ***, ___', () => {
    expect(markdownToTipTap('---').content[0]).toEqual({ type: 'horizontalRule' });
    expect(markdownToTipTap('***').content[0]).toEqual({ type: 'horizontalRule' });
    expect(markdownToTipTap('___').content[0]).toEqual({ type: 'horizontalRule' });
  });

  it('parses a fenced code block with a language', () => {
    const doc = markdownToTipTap('```js\nconst a = 1;\nconst b = 2;\n```');
    expect(doc.content[0]).toEqual({
      type: 'codeBlock',
      attrs: { language: 'js' },
      content: [{ type: 'text', text: 'const a = 1;\nconst b = 2;' }],
    });
  });

  it('parses a fenced code block without a language (language null)', () => {
    const doc = markdownToTipTap('```\nplain code\n```');
    expect(doc.content[0]).toMatchObject({ type: 'codeBlock', attrs: { language: null } });
  });

  it('produces empty content for an empty code fence', () => {
    const doc = markdownToTipTap('```\n```');
    expect(doc.content[0]).toEqual({ type: 'codeBlock', attrs: { language: null }, content: [] });
  });

  it('handles an unterminated code fence by consuming the rest', () => {
    const doc = markdownToTipTap('```\nline1\nline2');
    expect(doc.content[0]).toMatchObject({
      type: 'codeBlock',
      content: [{ type: 'text', text: 'line1\nline2' }],
    });
  });

  it('parses a multi-line blockquote into one paragraph', () => {
    const doc = markdownToTipTap('> first line\n> second line');
    expect(doc.content[0].type).toBe('blockquote');
    const inner = doc.content[0].content![0];
    expect(inner.type).toBe('paragraph');
    expect(inner.content).toEqual([{ type: 'text', text: 'first line second line' }]);
  });

  it('parses an unordered list with -, *, +', () => {
    const doc = markdownToTipTap('- a\n* b\n+ c');
    expect(doc.content[0].type).toBe('bulletList');
    expect(doc.content[0].content).toHaveLength(3);
    expect(doc.content[0].content![0]).toMatchObject({ type: 'listItem' });
  });

  it('parses a task list with checked and unchecked items', () => {
    const doc = markdownToTipTap('- [ ] todo\n- [x] done\n- [X] also done');
    expect(doc.content[0].type).toBe('taskList');
    const items = doc.content[0].content!;
    expect(items[0]).toMatchObject({ type: 'taskItem', attrs: { checked: false } });
    expect(items[1]).toMatchObject({ type: 'taskItem', attrs: { checked: true } });
    expect(items[2]).toMatchObject({ type: 'taskItem', attrs: { checked: true } });
  });

  it('uses taskList type if any item is a task item', () => {
    const doc = markdownToTipTap('- regular\n- [ ] task');
    expect(doc.content[0].type).toBe('taskList');
    const items = doc.content[0].content!;
    expect(items[0].type).toBe('listItem');
    expect(items[1].type).toBe('taskItem');
  });

  it('parses an ordered list', () => {
    const doc = markdownToTipTap('1. first\n2. second');
    expect(doc.content[0].type).toBe('orderedList');
    expect(doc.content[0].content).toHaveLength(2);
    expect(doc.content[0].content![0]).toMatchObject({ type: 'listItem' });
  });

  it('parses a regular paragraph', () => {
    const doc = markdownToTipTap('just some text');
    expect(doc.content[0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'just some text' }],
    });
  });

  it('skips blank lines between blocks', () => {
    const doc = markdownToTipTap('para1\n\n\npara2');
    expect(doc.content).toHaveLength(2);
    expect(doc.content[0].type).toBe('paragraph');
    expect(doc.content[1].type).toBe('paragraph');
  });

  describe('inline content parsing', () => {
    it('parses bold text', () => {
      const doc = markdownToTipTap('**bold**');
      expect(doc.content[0].content).toEqual([
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
      ]);
    });

    it('parses italic text', () => {
      const doc = markdownToTipTap('*italic*');
      expect(doc.content[0].content).toEqual([
        { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
      ]);
    });

    it('parses inline code', () => {
      const doc = markdownToTipTap('`code`');
      expect(doc.content[0].content).toEqual([
        { type: 'text', text: 'code', marks: [{ type: 'code' }] },
      ]);
    });

    it('parses a link', () => {
      const doc = markdownToTipTap('[label](https://example.com)');
      expect(doc.content[0].content).toEqual([
        {
          type: 'text',
          text: 'label',
          marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
        },
      ]);
    });

    it('parses mixed inline content with surrounding text', () => {
      const doc = markdownToTipTap('hello **world** and `code` end');
      expect(doc.content[0].content).toEqual([
        { type: 'text', text: 'hello ' },
        { type: 'text', text: 'world', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' and ' },
        { type: 'text', text: 'code', marks: [{ type: 'code' }] },
        { type: 'text', text: ' end' },
      ]);
    });

    it('treats text with no inline markup as a single plain text node', () => {
      const doc = markdownToTipTap('plain unformatted text');
      expect(doc.content[0].content).toEqual([{ type: 'text', text: 'plain unformatted text' }]);
    });
  });

  describe('table parsing', () => {
    it('parses a simple markdown table correctly', () => {
      const tableMarkdown = 
        '| Header 1 | Header 2 |\n' +
        '| --- | --- |\n' +
        '| Cell 1 | Cell 2 |\n' +
        '| Cell 3 | Cell 4 |';
      
      const doc = markdownToTipTap(tableMarkdown);
      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe('table');
      expect(doc.content[0].content).toHaveLength(3);

      const headerRow = doc.content[0].content![0];
      expect(headerRow.type).toBe('tableRow');
      expect(headerRow.content).toHaveLength(2);
      expect(headerRow.content![0].type).toBe('tableHeader');
      expect(headerRow.content![0].content![0]).toMatchObject({
        type: 'paragraph',
        content: [{ type: 'text', text: 'Header 1' }]
      });

      const bodyRow1 = doc.content[0].content![1];
      expect(bodyRow1.type).toBe('tableRow');
      expect(bodyRow1.content).toHaveLength(2);
      expect(bodyRow1.content![0].type).toBe('tableCell');
      expect(bodyRow1.content![0].content![0]).toMatchObject({
        type: 'paragraph',
        content: [{ type: 'text', text: 'Cell 1' }]
      });
    });

    it('parses a table with inline formatting in cells', () => {
      const tableMarkdown = 
        '| Col A | Col B |\n' +
        '|:---|:---|\n' +
        '| **bold** | `code` |';

      const doc = markdownToTipTap(tableMarkdown);
      const cells = doc.content[0].content![1].content!;
      
      expect(cells[0].content![0].content).toEqual([
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] }
      ]);
      expect(cells[1].content![0].content).toEqual([
        { type: 'text', text: 'code', marks: [{ type: 'code' }] }
      ]);
    });
  });
});

describe('stripCodeFences', () => {
  it('returns empty string for empty input', () => {
    expect(stripCodeFences('')).toBe('');
  });

  it('returns empty string for falsy input', () => {
    expect(stripCodeFences(undefined as unknown as string)).toBe('');
  });

  it('strips a plain ``` fence', () => {
    expect(stripCodeFences('```\nhello world\n```')).toBe('hello world');
  });

  it('strips a markdown-labeled fence', () => {
    expect(stripCodeFences('```markdown\n# Title\n```')).toBe('# Title');
  });

  it('strips an md-labeled fence', () => {
    expect(stripCodeFences('```md\ncontent\n```')).toBe('content');
  });

  it('trims surrounding whitespace before matching', () => {
    expect(stripCodeFences('   ```\ninner\n```   ')).toBe('inner');
  });

  it('returns content unchanged when there is no fence', () => {
    expect(stripCodeFences('just text')).toBe('just text');
  });

  it('strips a generic fence and keeps the language label as part of content', () => {
    // The optional (?:markdown|md)? label does not match "js", so "js" is
    // captured as the first line of the fenced content.
    expect(stripCodeFences('```js\nconst a = 1;\n```')).toBe('js\nconst a = 1;');
  });
});
