"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
    content: string;
    className?: string;
    isStreaming?: boolean;
}

/**
 * Strip markdown code fences that wrap the entire content.
 * The AI sometimes returns: ```markdown\n...content...\n```
 */
function preprocessMarkdown(content: string): string {
    if (!content) return "";

    // Strip leading/trailing markdown code fences
    let processed = content.trim();

    // Match ```markdown or ```md at the start and ``` at the end
    const codeFenceRegex = /^```(?:markdown|md)?\s*\n?([\s\S]*?)\n?```$/;
    const match = processed.match(codeFenceRegex);

    if (match) {
        processed = match[1].trim();
    }

    return processed;
}

/**
 * MarkdownContent - A reusable component for rendering markdown with proper styling.
 * Uses ReactMarkdown with custom component overrides for consistent styling.
 */
export function MarkdownContent({ content, className, isStreaming }: MarkdownContentProps) {
    const processedContent = preprocessMarkdown(content);

    if (!processedContent) {
        return null;
    }

    return (
        <div className={cn("markdown-content", className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Headings
                    h1: ({ children }) => (
                        <h1 className="text-2xl font-bold mt-0 mb-4 leading-tight text-foreground">{children}</h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-xl font-semibold mt-6 mb-3 leading-snug border-b border-border pb-2 text-foreground">{children}</h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h3>
                    ),
                    h4: ({ children }) => (
                        <h4 className="text-base font-semibold mt-3 mb-1 text-foreground">{children}</h4>
                    ),

                    // Paragraphs
                    p: ({ children }) => (
                        <p className="my-3 leading-relaxed text-foreground">{children}</p>
                    ),

                    // Lists
                    ul: ({ children }) => (
                        <ul className="my-3 pl-6 list-disc space-y-1 text-foreground">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="my-3 pl-6 list-decimal space-y-1 text-foreground">{children}</ol>
                    ),
                    li: ({ children }) => (
                        <li className="leading-relaxed">{children}</li>
                    ),

                    // Code
                    code: ({ className: codeClassName, children, ...props }) => {
                        const isInlineCode = !codeClassName;
                        if (isInlineCode) {
                            return (
                                <code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-foreground" {...props}>
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code className={cn("block font-mono", codeClassName)} {...props}>
                                {children}
                            </code>
                        );
                    },
                    pre: ({ children }) => (
                        <pre className="my-4 p-4 bg-muted rounded-lg overflow-x-auto text-sm font-mono">{children}</pre>
                    ),

                    // Blockquote
                    blockquote: ({ children }) => (
                        <blockquote className="my-4 pl-4 border-l-4 border-primary/50 italic text-muted-foreground">
                            {children}
                        </blockquote>
                    ),

                    // Links
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            className="text-primary underline hover:no-underline"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {children}
                        </a>
                    ),

                    // Strong and Emphasis
                    strong: ({ children }) => (
                        <strong className="font-bold text-foreground">{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic">{children}</em>
                    ),

                    // Horizontal Rule
                    hr: () => (
                        <hr className="my-6 border-t border-border" />
                    ),

                    // Table
                    table: ({ children }) => (
                        <div className="my-4 overflow-x-auto">
                            <table className="w-full border-collapse border border-border text-sm">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-muted">{children}</thead>
                    ),
                    th: ({ children }) => (
                        <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>
                    ),
                    td: ({ children }) => (
                        <td className="border border-border px-3 py-2">{children}</td>
                    ),
                }}
            >
                {processedContent}
            </ReactMarkdown>
            {isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
            )}
        </div>
    );
}
