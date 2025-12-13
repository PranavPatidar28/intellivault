/**
 * Markdown to TipTap JSON Converter
 * 
 * Converts markdown content to TipTap-compatible JSON format.
 * This is a simplified converter for AI-generated markdown content.
 */

interface TipTapNode {
    type: string;
    attrs?: Record<string, unknown>;
    content?: TipTapNode[];
    text?: string;
    marks?: { type: string; attrs?: Record<string, unknown> }[];
}

interface TipTapDocument {
    type: "doc";
    content: TipTapNode[];
}

/**
 * Convert markdown to TipTap JSON format
 */
export function markdownToTipTap(markdown: string): TipTapDocument {
    const lines = markdown.split("\n");
    const content: TipTapNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Empty line
        if (!trimmed) {
            i++;
            continue;
        }

        // Headings
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            content.push({
                type: "heading",
                attrs: { level },
                content: parseInlineContent(headingMatch[2]),
            });
            i++;
            continue;
        }

        // Horizontal rule
        if (/^[-*_]{3,}$/.test(trimmed)) {
            content.push({ type: "horizontalRule" });
            i++;
            continue;
        }

        // Code block
        if (trimmed.startsWith("```")) {
            const language = trimmed.slice(3).trim() || null;
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith("```")) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // Skip closing ```
            content.push({
                type: "codeBlock",
                attrs: { language },
                content: [{ type: "text", text: codeLines.join("\n") }],
            });
            continue;
        }

        // Blockquote
        if (trimmed.startsWith(">")) {
            const quoteLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith(">")) {
                quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
                i++;
            }
            content.push({
                type: "blockquote",
                content: [
                    {
                        type: "paragraph",
                        content: parseInlineContent(quoteLines.join(" ")),
                    },
                ],
            });
            continue;
        }

        // Unordered list
        if (/^[-*+]\s+/.test(trimmed)) {
            const listItems: TipTapNode[] = [];
            while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
                const itemText = lines[i].trim().replace(/^[-*+]\s+/, "");
                // Check for task list
                const taskMatch = itemText.match(/^\[([ xX])\]\s*(.+)$/);
                if (taskMatch) {
                    listItems.push({
                        type: "taskItem",
                        attrs: { checked: taskMatch[1].toLowerCase() === "x" },
                        content: [
                            {
                                type: "paragraph",
                                content: parseInlineContent(taskMatch[2]),
                            },
                        ],
                    });
                } else {
                    listItems.push({
                        type: "listItem",
                        content: [
                            {
                                type: "paragraph",
                                content: parseInlineContent(itemText),
                            },
                        ],
                    });
                }
                i++;
            }
            // Check if it's a task list
            const hasTaskItems = listItems.some(item => item.type === "taskItem");
            content.push({
                type: hasTaskItems ? "taskList" : "bulletList",
                content: listItems,
            });
            continue;
        }

        // Ordered list
        if (/^\d+\.\s+/.test(trimmed)) {
            const listItems: TipTapNode[] = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
                const itemText = lines[i].trim().replace(/^\d+\.\s+/, "");
                listItems.push({
                    type: "listItem",
                    content: [
                        {
                            type: "paragraph",
                            content: parseInlineContent(itemText),
                        },
                    ],
                });
                i++;
            }
            content.push({
                type: "orderedList",
                content: listItems,
            });
            continue;
        }

        // Regular paragraph
        content.push({
            type: "paragraph",
            content: parseInlineContent(trimmed),
        });
        i++;
    }

    // Ensure at least one paragraph
    if (content.length === 0) {
        content.push({ type: "paragraph", content: [] });
    }

    return { type: "doc", content };
}

/**
 * Parse inline content (bold, italic, code, links)
 */
function parseInlineContent(text: string): TipTapNode[] {
    if (!text) return [];

    const nodes: TipTapNode[] = [];

    // Pattern for: **bold**, *italic*, `code`, [link](url)
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            const beforeText = text.slice(lastIndex, match.index);
            if (beforeText) {
                nodes.push({ type: "text", text: beforeText });
            }
        }

        const token = match[0];

        // Bold: **text**
        if (token.startsWith("**") && token.endsWith("**")) {
            nodes.push({
                type: "text",
                text: token.slice(2, -2),
                marks: [{ type: "bold" }],
            });
        }
        // Italic: *text*
        else if (token.startsWith("*") && token.endsWith("*")) {
            nodes.push({
                type: "text",
                text: token.slice(1, -1),
                marks: [{ type: "italic" }],
            });
        }
        // Code: `text`
        else if (token.startsWith("`") && token.endsWith("`")) {
            nodes.push({
                type: "text",
                text: token.slice(1, -1),
                marks: [{ type: "code" }],
            });
        }
        // Link: [text](url)
        else if (token.startsWith("[")) {
            const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (linkMatch) {
                nodes.push({
                    type: "text",
                    text: linkMatch[1],
                    marks: [{ type: "link", attrs: { href: linkMatch[2] } }],
                });
            }
        }

        lastIndex = pattern.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        const remaining = text.slice(lastIndex);
        if (remaining) {
            nodes.push({ type: "text", text: remaining });
        }
    }

    // If no nodes, return plain text
    if (nodes.length === 0 && text) {
        nodes.push({ type: "text", text });
    }

    return nodes;
}

/**
 * Strip markdown code fences (same as in MarkdownContent component)
 */
export function stripCodeFences(content: string): string {
    if (!content) return "";

    let processed = content.trim();
    const codeFenceRegex = /^```(?:markdown|md)?\s*\n?([\s\S]*?)\n?```$/;
    const match = processed.match(codeFenceRegex);

    if (match) {
        processed = match[1].trim();
    }

    return processed;
}
