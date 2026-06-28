"use client";

/**
 * MarkdownRenderer - Production-ready markdown rendering component
 * 
 * Features:
 * - GitHub Flavored Markdown (GFM) support
 * - Syntax highlighting for code blocks
 * - Dark/light mode theming
 * - Streaming support with cursor indicator
 * - Code fence stripping for AI responses
 * - Task lists, tables, strikethrough
 * - Memoized for performance
 * 
 * Usage:
 * <MarkdownRenderer content={markdown} />
 * <MarkdownRenderer content={streamingContent} isStreaming />
 * <MarkdownRenderer content={aiContent} variant="compact" />
 */

import { memo, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

export interface MarkdownRendererProps {
    /** Markdown content to render */
    content: string;
    /** Additional CSS classes */
    className?: string;
    /** Show streaming cursor indicator */
    isStreaming?: boolean;
    /** Variant for different use cases */
    variant?: "default" | "compact" | "prose";
    /** Strip markdown code fences from AI responses */
    stripCodeFences?: boolean;
    /** Theme override: auto follows system */
    theme?: "auto" | "dark" | "light";
    /** Enable copy button on code blocks */
    enableCopyCode?: boolean;
    /** Callback when a link is clicked */
    onLinkClick?: (href: string) => void;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Strip markdown code fences that wrap the entire content.
 * AI models sometimes return: ```markdown\n...content...\n```
 * 
 * Works progressively for streaming:
 * - Strips opening fence immediately (even without closing fence)
 * - Strips closing fence when present
 */
function stripMarkdownCodeFences(content: string, isStreaming: boolean = false): string {
    if (!content) return "";

    let processed = content;

    // Strip opening fence immediately (```markdown\n or ```md\n or ```\n at start)
    const openingFenceMatch = processed.match(/^```(?:markdown|md)?\s*\n/);
    if (openingFenceMatch) {
        processed = processed.slice(openingFenceMatch[0].length);
    }

    // Strip closing fence if present (only when not streaming)
    if (!isStreaming) {
        if (processed.endsWith("\n```")) {
            processed = processed.slice(0, -4);
        } else if (processed.endsWith("```")) {
            processed = processed.slice(0, -3);
        }
    }

    return processed;
}

/**
 * Detect if user has dark mode enabled
 */
function useTheme(themeOverride: "auto" | "dark" | "light"): "dark" | "light" {
    // For SSR safety, default to light
    if (typeof window === "undefined") return "light";

    if (themeOverride !== "auto") return themeOverride;

    // Check document class for dark mode
    const isDark = document.documentElement.classList.contains("dark");
    return isDark ? "dark" : "light";
}

// ============================================================================
// Code Block Component with Copy Button
// ============================================================================

interface CodeBlockProps {
    language: string | undefined;
    children: string;
    theme: "dark" | "light";
    enableCopy: boolean;
}

function CodeBlock({ language, children, theme, enableCopy }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(children);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [children]);

    const codeStyle = theme === "dark" ? oneDark : oneLight;

    return (
        <div className="relative group my-4">
            {language && (
                <div className="absolute top-0 left-4 px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted rounded-b">
                    {language}
                </div>
            )}
            {enableCopy && (
                <button
                    onClick={handleCopy}
                    className="absolute top-2 right-2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background border"
                    aria-label="Copy code"
                >
                    {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                </button>
            )}
            <SyntaxHighlighter
                style={codeStyle}
                language={language || "text"}
                PreTag="div"
                customStyle={{
                    margin: 0,
                    borderRadius: "0.5rem",
                    fontSize: "0.8125rem",
                    padding: language ? "2rem 1rem 1rem" : "1rem",
                }}
            >
                {children}
            </SyntaxHighlighter>
        </div>
    );
}

// ============================================================================
// Variant Styles
// ============================================================================

const variantStyles = {
    default: {
        wrapper: "text-sm leading-relaxed",
        h1: "text-2xl font-bold mt-6 mb-4 first:mt-0",
        h2: "text-xl font-semibold mt-5 mb-3 pb-2 border-b border-border first:mt-0",
        h3: "text-lg font-semibold mt-4 mb-2 first:mt-0",
        h4: "text-base font-semibold mt-3 mb-1.5 first:mt-0",
        p: "my-3 leading-relaxed",
        ul: "my-3 pl-6 list-disc space-y-1.5",
        ol: "my-3 pl-6 list-decimal space-y-1.5",
        li: "leading-relaxed",
        blockquote: "my-4 pl-4 border-l-4 border-primary/40 italic text-muted-foreground",
        table: "my-4 w-full border-collapse text-sm",
        th: "border border-border px-3 py-2 text-left font-semibold bg-muted",
        td: "border border-border px-3 py-2",
    },
    compact: {
        wrapper: "text-xs leading-relaxed",
        h1: "text-lg font-bold mt-4 mb-2 first:mt-0",
        h2: "text-base font-semibold mt-3 mb-2 first:mt-0",
        h3: "text-sm font-semibold mt-2 mb-1 first:mt-0",
        h4: "text-sm font-medium mt-2 mb-1 first:mt-0",
        p: "my-2 leading-relaxed",
        ul: "my-2 pl-4 list-disc space-y-1",
        ol: "my-2 pl-4 list-decimal space-y-1",
        li: "leading-relaxed",
        blockquote: "my-2 pl-3 border-l-2 border-primary/40 italic text-muted-foreground text-[11px]",
        table: "my-2 w-full border-collapse text-xs",
        th: "border border-border px-2 py-1 text-left font-semibold bg-muted",
        td: "border border-border px-2 py-1",
    },
    prose: {
        wrapper: "prose prose-sm dark:prose-invert max-w-none",
        h1: "",
        h2: "",
        h3: "",
        h4: "",
        p: "",
        ul: "",
        ol: "",
        li: "",
        blockquote: "",
        table: "",
        th: "",
        td: "",
    },
};

// ============================================================================
// Main Component
// ============================================================================

function MarkdownRendererInner({
    content,
    className,
    isStreaming = false,
    variant = "default",
    stripCodeFences = true,
    theme: themeOverride = "auto",
    enableCopyCode = true,
    onLinkClick,
}: MarkdownRendererProps) {
    const theme = useTheme(themeOverride);
    const styles = variantStyles[variant];

    // Process content - strip code fences if enabled
    const processedContent = useMemo(() => {
        if (!content) return "";
        return stripCodeFences ? stripMarkdownCodeFences(content, isStreaming) : content;
    }, [content, stripCodeFences, isStreaming]);

    // Create memoized components config
    const components = useMemo<Components>(() => ({
        // Headings
        h1: ({ children }) => (
            <h1 className={styles.h1}>{children}</h1>
        ),
        h2: ({ children }) => (
            <h2 className={styles.h2}>{children}</h2>
        ),
        h3: ({ children }) => (
            <h3 className={styles.h3}>{children}</h3>
        ),
        h4: ({ children }) => (
            <h4 className={styles.h4}>{children}</h4>
        ),
        h5: ({ children }) => (
            <h5 className="text-sm font-medium mt-2 mb-1">{children}</h5>
        ),
        h6: ({ children }) => (
            <h6 className="text-sm font-medium mt-2 mb-1 text-muted-foreground">{children}</h6>
        ),

        // Paragraphs
        p: ({ children }) => (
            <p className={styles.p}>{children}</p>
        ),

        // Lists
        ul: ({ children }) => (
            <ul className={styles.ul}>{children}</ul>
        ),
        ol: ({ children }) => (
            <ol className={styles.ol}>{children}</ol>
        ),
        li: ({ children }) => (
            <li className={styles.li}>{children}</li>
        ),

        // Code - inline and blocks
        code: ({ className: codeClassName, children, ...props }) => {
            const match = /language-(\w+)/.exec(codeClassName || "");
            const language = match ? match[1] : undefined;
            const codeString = String(children).replace(/\n$/, "");

            // Check if it's a code block (has language or is multi-line)
            const isCodeBlock = !!match || codeString.includes("\n");

            if (isCodeBlock) {
                return (
                    <CodeBlock
                        language={language}
                        theme={theme}
                        enableCopy={enableCopyCode}
                    >
                        {codeString}
                    </CodeBlock>
                );
            }

            // Inline code
            return (
                <code
                    className="px-1.5 py-0.5 bg-muted rounded text-[0.8125em] font-mono text-foreground"
                    {...props}
                >
                    {children}
                </code>
            );
        },

        // Pre - handled by code component
        pre: ({ children }) => <>{children}</>,

        // Blockquote
        blockquote: ({ children }) => (
            <blockquote className={styles.blockquote}>
                {children}
            </blockquote>
        ),

        // Links
        a: ({ href, children }) => {
            const isExternal = href?.startsWith("http");
            return (
                <a
                    href={href}
                    className="text-primary underline underline-offset-2 hover:no-underline inline-flex items-center gap-0.5"
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                    onClick={(e) => {
                        if (onLinkClick && href) {
                            e.preventDefault();
                            onLinkClick(href);
                        }
                    }}
                >
                    {children}
                    {isExternal && <ExternalLink className="h-3 w-3 ml-0.5" />}
                </a>
            );
        },

        // Emphasis
        strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => (
            <em className="italic">{children}</em>
        ),
        del: ({ children }) => (
            <del className="line-through text-muted-foreground">{children}</del>
        ),

        // Horizontal Rule
        hr: () => (
            <hr className="my-6 border-t border-border" />
        ),

        // Tables
        table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-border">
                <table className={styles.table}>
                    {children}
                </table>
            </div>
        ),
        thead: ({ children }) => (
            <thead className="bg-muted">{children}</thead>
        ),
        tbody: ({ children }) => (
            <tbody>{children}</tbody>
        ),
        tr: ({ children }) => (
            <tr className="border-b border-border last:border-0">{children}</tr>
        ),
        th: ({ children }) => (
            <th className={styles.th}>{children}</th>
        ),
        td: ({ children }) => (
            <td className={styles.td}>{children}</td>
        ),

        // Images
        // AI-generated markdown can contain external image URLs. referrerPolicy
        // prevents leaking the viewer's referrer to third-party hosts (privacy
        // beacon). react-markdown already strips javascript:/data: schemes.
        img: ({ src, alt }) => (
            <img
                src={src}
                alt={alt || ""}
                className="max-w-full h-auto rounded-lg my-4"
                loading="lazy"
                referrerPolicy="no-referrer"
            />
        ),

        // Task list items (GFM)
        input: ({ type, checked }) => {
            if (type === "checkbox") {
                return (
                    <input
                        type="checkbox"
                        checked={checked}
                        disabled
                        className="mr-2 h-4 w-4 rounded border-border"
                    />
                );
            }
            return null;
        },
    }), [styles, theme, enableCopyCode, onLinkClick]);

    if (!processedContent) {
        return null;
    }

    return (
        <div className={cn("markdown-renderer", styles.wrapper, className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={components}
            >
                {processedContent}
            </ReactMarkdown>
            {isStreaming && (
                <span
                    className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-middle"
                    aria-label="Streaming"
                />
            )}
        </div>
    );
}

// Custom comparison for memo - always re-render when streaming or content changes
function arePropsEqual(prevProps: MarkdownRendererProps, nextProps: MarkdownRendererProps): boolean {
    // Always re-render during streaming to show live content
    if (prevProps.isStreaming || nextProps.isStreaming) {
        return false;
    }

    // For non-streaming, use shallow comparison
    return (
        prevProps.content === nextProps.content &&
        prevProps.variant === nextProps.variant &&
        prevProps.className === nextProps.className &&
        prevProps.stripCodeFences === nextProps.stripCodeFences &&
        prevProps.theme === nextProps.theme &&
        prevProps.enableCopyCode === nextProps.enableCopyCode
    );
}

// Memoize with custom comparison for performance
export const MarkdownRenderer = memo(MarkdownRendererInner, arePropsEqual);

// Default export for convenience
export default MarkdownRenderer;

