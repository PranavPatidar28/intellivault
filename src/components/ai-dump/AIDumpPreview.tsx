"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Save, Eye, FileText, GitCompare } from "lucide-react";
import type { AIDumpData } from "@/hooks/use-ai-dump";

// ============================================================================
// Types
// ============================================================================

interface AIDumpPreviewProps {
    aiDump: AIDumpData | null;
    selectedTitle: string;
    selectedTags: string[];
    onSave: () => void;
    isProcessing: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function AIDumpPreview({
    aiDump,
    selectedTitle,
    selectedTags,
    onSave,
    isProcessing,
}: AIDumpPreviewProps) {
    const [activeTab, setActiveTab] = useState<"generated" | "raw" | "diff">(
        "generated"
    );

    if (!aiDump) {
        return (
            <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground py-12">
                    <Eye className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Preview will appear here after processing</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
                <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                >
                    <TabsList>
                        <TabsTrigger value="generated" className="gap-1.5">
                            <FileText className="h-3.5 w-3.5" />
                            Generated
                        </TabsTrigger>
                        <TabsTrigger value="raw" className="gap-1.5">
                            <FileText className="h-3.5 w-3.5" />
                            Raw
                        </TabsTrigger>
                        <TabsTrigger value="diff" className="gap-1.5">
                            <GitCompare className="h-3.5 w-3.5" />
                            Diff
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <Button
                    onClick={onSave}
                    disabled={isProcessing || aiDump.status === "final"}
                    className="gap-2"
                >
                    <Save className="h-4 w-4" />
                    {aiDump.status === "final" ? "Saved" : "Save Note"}
                </Button>
            </div>

            <CardContent className="flex-1 overflow-auto p-0">
                {activeTab === "generated" && (
                    <GeneratedPreview
                        title={selectedTitle}
                        tags={selectedTags}
                        markdown={aiDump.markdown}
                    />
                )}
                {activeTab === "raw" && <RawPreview content={aiDump.rawText} />}
                {activeTab === "diff" && (
                    <DiffPreview raw={aiDump.rawText} generated={aiDump.markdown} />
                )}
            </CardContent>
        </Card>
    );
}

// ============================================================================
// Sub-Components
// ============================================================================

interface GeneratedPreviewProps {
    title: string;
    tags: string[];
    markdown: string;
}

function GeneratedPreview({ title, tags, markdown }: GeneratedPreviewProps) {
    return (
        <div className="p-6 space-y-4">
            {/* Title */}
            <h1 className="text-2xl font-bold">{title}</h1>

            {/* Tags */}
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                        <span
                            key={tag}
                            className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
                        >
                            #{tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Markdown Content */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
                <MarkdownRenderer content={markdown} />
            </div>
        </div>
    );
}

interface RawPreviewProps {
    content: string;
}

function RawPreview({ content }: RawPreviewProps) {
    return (
        <div className="p-6">
            <pre className="whitespace-pre-wrap text-sm font-mono text-muted-foreground bg-muted/50 p-4 rounded-lg overflow-auto">
                {content}
            </pre>
        </div>
    );
}

interface DiffPreviewProps {
    raw: string;
    generated: string;
}

function DiffPreview({ raw, generated }: DiffPreviewProps) {
    // Simple diff visualization
    const rawLines = raw.split("\n");
    const generatedLines = generated.split("\n");

    return (
        <div className="p-6 grid grid-cols-2 gap-4">
            <div>
                <h3 className="text-sm font-medium mb-2 text-muted-foreground">
                    Original
                </h3>
                <pre className="text-xs font-mono bg-red-500/5 p-3 rounded-lg overflow-auto max-h-96">
                    {rawLines.slice(0, 50).map((line, i) => (
                        <div key={i} className="text-red-600 dark:text-red-400">
                            - {line}
                        </div>
                    ))}
                    {rawLines.length > 50 && (
                        <div className="text-muted-foreground">
                            ... {rawLines.length - 50} more lines
                        </div>
                    )}
                </pre>
            </div>
            <div>
                <h3 className="text-sm font-medium mb-2 text-muted-foreground">
                    Generated
                </h3>
                <pre className="text-xs font-mono bg-green-500/5 p-3 rounded-lg overflow-auto max-h-96">
                    {generatedLines.slice(0, 50).map((line, i) => (
                        <div key={i} className="text-green-600 dark:text-green-400">
                            + {line}
                        </div>
                    ))}
                    {generatedLines.length > 50 && (
                        <div className="text-muted-foreground">
                            ... {generatedLines.length - 50} more lines
                        </div>
                    )}
                </pre>
            </div>
        </div>
    );
}

// ============================================================================
// Markdown Renderer (Simple)
// ============================================================================

interface MarkdownRendererProps {
    content: string;
}

function MarkdownRenderer({ content }: MarkdownRendererProps) {
    // Simple markdown parsing for common elements
    const lines = content.split("\n");

    return (
        <div className="space-y-2">
            {lines.map((line, i) => {
                // Headers
                if (line.startsWith("### ")) {
                    return (
                        <h3 key={i} className="text-lg font-semibold mt-4">
                            {line.slice(4)}
                        </h3>
                    );
                }
                if (line.startsWith("## ")) {
                    return (
                        <h2 key={i} className="text-xl font-semibold mt-6">
                            {line.slice(3)}
                        </h2>
                    );
                }
                if (line.startsWith("# ")) {
                    return (
                        <h1 key={i} className="text-2xl font-bold mt-6">
                            {line.slice(2)}
                        </h1>
                    );
                }

                // Bullet points
                if (line.startsWith("- ") || line.startsWith("* ")) {
                    return (
                        <li key={i} className="ml-4">
                            {line.slice(2)}
                        </li>
                    );
                }

                // Checkboxes
                if (line.startsWith("- [ ] ")) {
                    return (
                        <li key={i} className="ml-4 flex items-center gap-2">
                            <input type="checkbox" disabled className="rounded" />
                            {line.slice(6)}
                        </li>
                    );
                }
                if (line.startsWith("- [x] ")) {
                    return (
                        <li key={i} className="ml-4 flex items-center gap-2">
                            <input type="checkbox" checked disabled className="rounded" />
                            <span className="line-through text-muted-foreground">
                                {line.slice(6)}
                            </span>
                        </li>
                    );
                }

                // Code blocks
                if (line.startsWith("```")) {
                    return <hr key={i} className="border-muted" />;
                }

                // Empty lines
                if (line.trim() === "") {
                    return <br key={i} />;
                }

                // Regular paragraphs
                return (
                    <p key={i} className="text-sm">
                        {line}
                    </p>
                );
            })}
        </div>
    );
}
