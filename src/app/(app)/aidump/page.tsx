"use client";

import { useState, useCallback, useEffect, useMemo, useRef, useId } from "react";
import { useRouter } from "next/navigation";
import {
    Wand2,
    Loader2,
    RotateCcw,
    ArrowLeft,
    Copy,
    Check,
    RefreshCw,
    Sparkles,
    FileText,
    Eye,
    GitCompare,
    ChevronDown,
    GripVertical,
    Hash,
    Type,
    FileCode,
    ListTodo,
    Upload,
    X,
    Image,
    File,
    Users,
    BookOpen,
    Lightbulb,
    GraduationCap,
    Zap,
    PenLine,
    Edit,
    AlertTriangle,
    Settings2,
    PanelRight,
    Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAIDump } from "@/hooks/use-ai-dump";
import type { DraftSummary, AIDumpData } from "@/hooks/use-ai-dump";
import { useFileUpload, SUPPORTED_FILE_TYPES } from "@/hooks/use-file-upload";
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getRelativeTime } from "@/lib/utils/text";
import type { AIDumpOptions } from "@/lib/validations/ai-dump";
import Link from "next/link";
import { MarkdownRenderer } from "@/components/markdown";
import { ThinkingPanel } from "@/components/ai-dump/ThinkingPanel";
import { detectContentType, getContentTypeDisplay, type ContentTypeResult } from "@/lib/ai/content-type-detection";


// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: AIDumpOptions = {
    template: "auto",
    toggles: {
        titles: true,
        tags: true,
        markdown: true,
        actions: false,
        preserveCode: true,
    },
    tone: "balanced",
    temperature: 0.2,
};


// ============================================================================
// Resizable Panel Hook
// ============================================================================

function useResizablePanel(initialWidth: number, minWidth: number, maxWidth: number) {
    const [width, setWidth] = useState(initialWidth);
    const isResizing = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        isResizing.current = true;
        startX.current = e.clientX;
        startWidth.current = width;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }, [width]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            const delta = startX.current - e.clientX;
            const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
            setWidth(newWidth);
        };

        const handleMouseUp = () => {
            isResizing.current = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [minWidth, maxWidth]);

    return { width, handleMouseDown };
}

// ============================================================================
// Media query + platform helpers
// ============================================================================

/** Detects the Apple platform so we can show the right modifier glyph. */
function useIsApplePlatform(): boolean {
    const [isApple, setIsApple] = useState(false);
    useEffect(() => {
        const detect = () => {
            const platform =
                // userAgentData is the modern source; fall back to navigator.platform.
                (navigator as Navigator & { userAgentData?: { platform?: string } })
                    .userAgentData?.platform ||
                navigator.platform ||
                "";
            setIsApple(/mac|iphone|ipad|ipod/i.test(platform));
        };
        detect();
    }, []);
    return isApple;
}

// ============================================================================
// Page Component
// ============================================================================

export default function AIDumpPage() {
    const router = useRouter();
    const { toast } = useToast();

    const [inputContent, setInputContent] = useState("");
    const [options, setOptions] = useState<AIDumpOptions>(DEFAULT_OPTIONS);
    const [previewTab, setPreviewTab] = useState<"generated" | "raw" | "diff">("generated");
    const [copiedSection, setCopiedSection] = useState<string | null>(null);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [isRefining, setIsRefining] = useState(false);
    const [refinementInput, setRefinementInput] = useState("");

    // Mobile panel sheets (options + metadata are off-canvas below lg).
    const [optionsSheetOpen, setOptionsSheetOpen] = useState(false);
    const [metadataSheetOpen, setMetadataSheetOpen] = useState(false);

    // The Sheets are lg:hidden, but Radix keeps the overlay mounted while open.
    // If the viewport grows to lg while a Sheet is open, the content hides but a
    // dark backdrop can linger — so close both Sheets when crossing to lg.
    const isLgUp = useIsBreakpoint("min", 1024);
    useEffect(() => {
        if (isLgUp) {
            setOptionsSheetOpen(false);
            setMetadataSheetOpen(false);
        }
    }, [isLgUp]);

    // Confirm before permanently deleting a saved draft.
    const [draftPendingDelete, setDraftPendingDelete] = useState<DraftSummary | null>(null);

    const isApple = useIsApplePlatform();

    // Inline editor
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedMarkdown, setEditedMarkdown] = useState("");

    // Saved drafts (resume)
    const [drafts, setDrafts] = useState<DraftSummary[]>([]);
    const [draftsLoading, setDraftsLoading] = useState(false);
    const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);

    // Debounce the raw input before running the (expensive) content-type
    // detection, so a large paste / upload doesn't re-scan on every keystroke.
    const [debouncedContent, setDebouncedContent] = useState("");
    useEffect(() => {
        const id = setTimeout(() => setDebouncedContent(inputContent), 350);
        return () => clearTimeout(id);
    }, [inputContent]);

    const detectedContentType = useMemo<ContentTypeResult | null>(() => {
        if (debouncedContent.length < 50) return null;
        return detectContentType(debouncedContent);
    }, [debouncedContent]);

    // Collapsible state for right sidebar sections
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
        tldr: false,
        summary: false,
    });

    const toggleSectionCollapse = useCallback((section: string) => {
        setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
    }, []);

    // Resizable right sidebar
    const { width: rightPanelWidth, handleMouseDown: handleRightPanelResize } = useResizablePanel(280, 220, 400);

    const {
        aiDump,
        isProcessing,
        isGenerating,
        isRegenerating,
        error,
        streamingStatus,
        warning,
        selectedTitle,
        selectedTags,
        createAIDump,
        regenerateSection,
        finalize,
        loadDraft,
        deleteDraft,
        listDrafts,
        cancel,
        setSelectedTitle,
        toggleTag,
        reset,
    } = useAIDump();

    const refreshDrafts = useCallback(async () => {
        setDraftsLoading(true);
        try {
            setDrafts(await listDrafts());
        } finally {
            setDraftsLoading(false);
        }
    }, [listDrafts]);

    // Load the drafts list whenever we're on the empty input screen.
    useEffect(() => {
        if (!aiDump && !isProcessing) {
            refreshDrafts();
        }
    }, [aiDump, isProcessing, refreshDrafts]);

    const {
        isDragging,
        isUploading,
        uploadError,
        processedFile,
        handleDragEnter,
        handleDragLeave,
        handleDragOver,
        handleDrop,
        handleFileSelect,
        openFilePicker,
        clearFile,
        fileInputRef,
    } = useFileUpload();

    // When file is processed, update input content
    useEffect(() => {
        if (processedFile) {
            if (processedFile.type === "image" && processedFile.imageData) {
                setUploadedImage(processedFile.imageData);
                setInputContent(`[Image: ${processedFile.metadata.filename}]\n\nDescribe and analyze this image.`);
            } else {
                setInputContent(processedFile.text || "");
            }
        }
    }, [processedFile]);

    // Sync edited markdown with AI dump output
    useEffect(() => {
        if (aiDump?.markdown && !isProcessing) {
            setEditedMarkdown(aiDump.markdown);
        }
    }, [aiDump?.markdown, isProcessing]);

    const handleSubmit = useCallback(async () => {
        if (!inputContent.trim() && !uploadedImage) return;
        await createAIDump(inputContent, options, {
            imageData: uploadedImage ?? undefined,
            source: processedFile ? "upload" : "paste",
        });
    }, [inputContent, uploadedImage, processedFile, options, createAIDump]);

    // Keyboard shortcut: Ctrl+Enter to submit
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                (e.ctrlKey || e.metaKey) &&
                e.key === "Enter" &&
                (inputContent.trim() || uploadedImage) &&
                !isProcessing &&
                !isUploading &&
                !aiDump
            ) {
                e.preventDefault();
                handleSubmit();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [inputContent, uploadedImage, isProcessing, isUploading, aiDump, handleSubmit]);

    // True when the user has inline edits that diverge from the generated
    // markdown and hasn't saved them yet. Used to guard navigation.
    const hasUnsavedEdits =
        !!aiDump &&
        aiDump.status !== "final" &&
        editedMarkdown.length > 0 &&
        editedMarkdown !== aiDump.markdown;

    // Warn on hard navigation / tab close while edits are unsaved.
    useEffect(() => {
        if (!hasUnsavedEdits) return;
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasUnsavedEdits]);

    // Confirm before in-app navigation away (e.g. the back link) loses edits.
    const handleBackNavigation = useCallback(
        (e: React.MouseEvent) => {
            if (!hasUnsavedEdits) return;
            const ok = window.confirm(
                "You have unsaved edits to this note. Leave without saving?"
            );
            if (!ok) e.preventDefault();
        },
        [hasUnsavedEdits]
    );

    const handleOptionsChange = useCallback(
        (newOptions: Partial<AIDumpOptions>) => {
            setOptions((prev) => ({
                ...prev,
                ...newOptions,
                toggles: {
                    ...prev.toggles,
                    ...newOptions.toggles,
                },
            }));
        },
        []
    );

    const handleSave = useCallback(async () => {
        const noteId = await finalize({
            selectedTitle,
            selectedTags,
            // Persist the user's inline edits, falling back to the generated md.
            finalMarkdown: editedMarkdown || aiDump?.markdown || "",
        });
        if (noteId) {
            router.push(`/notes/${noteId}`);
        }
    }, [finalize, router, selectedTitle, selectedTags, editedMarkdown, aiDump?.markdown]);

    const handleReset = useCallback(() => {
        setInputContent("");
        setUploadedImage(null);
        setIsEditMode(false);
        setEditedMarkdown("");
        setRefinementInput("");
        setPreviewTab("generated");
        setCopiedSection(null);
        clearFile();
        reset();
    }, [reset, clearFile]);

    const handleLoadDraft = useCallback(
        async (noteId: string) => {
            const ok = await loadDraft(noteId);
            if (!ok) {
                toast({
                    title: "Couldn't open draft",
                    description: "The draft may have been removed. Refreshing the list.",
                    variant: "destructive",
                });
                refreshDrafts();
            }
        },
        [loadDraft, toast, refreshDrafts]
    );

    // Open the confirmation dialog; actual delete happens on confirm.
    const requestDeleteDraft = useCallback((draft: DraftSummary) => {
        setDraftPendingDelete(draft);
    }, []);

    const confirmDeleteDraft = useCallback(async () => {
        const draft = draftPendingDelete;
        if (!draft) return;
        setDeletingDraftId(draft.id);
        try {
            const ok = await deleteDraft(draft.id);
            if (ok) {
                setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
            }
        } finally {
            setDeletingDraftId(null);
            setDraftPendingDelete(null);
        }
    }, [deleteDraft, draftPendingDelete]);

    // Apply a refinement instruction to the current markdown output.
    const handleRefine = useCallback(
        async (instruction: string) => {
            const trimmed = instruction.trim();
            if (!trimmed) return;
            setIsRefining(true);
            try {
                const success = await regenerateSection("markdown", {
                    tone: options.tone,
                    temperature: options.temperature,
                    instruction: trimmed,
                });
                if (success) {
                    toast({
                        title: "Refinement Applied",
                        description: "The content has been updated based on your instructions.",
                    });
                    setRefinementInput("");
                }
            } finally {
                setIsRefining(false);
            }
        },
        [regenerateSection, options.tone, options.temperature, toast]
    );

    const copyToClipboard = useCallback(
        async (text: string, section: string) => {
            try {
                if (!navigator.clipboard?.writeText) {
                    throw new Error("Clipboard API unavailable");
                }
                await navigator.clipboard.writeText(text);
                setCopiedSection(section);
                toast({ title: "Copied to clipboard" });
                setTimeout(() => setCopiedSection(null), 2000);
            } catch {
                toast({
                    title: "Couldn't copy to clipboard",
                    description:
                        "Your browser blocked clipboard access. Try copying manually.",
                    variant: "destructive",
                });
            }
        },
        [toast]
    );

    const wordCount = inputContent.trim().split(/\s+/).filter(Boolean).length;

    // Determine what sections are loaded
    const hasTitles = aiDump?.titles && aiDump.titles.length > 0;
    const hasTags = aiDump?.tags && aiDump.tags.length > 0;
    const hasMarkdown = aiDump?.markdown && aiDump.markdown.length > 0;
    const hasTldr = aiDump?.tldr && aiDump.tldr.length > 0;
    const hasSummary = aiDump?.summary && aiDump.summary.length > 0;
    const hasActions = aiDump?.actions && aiDump.actions.length > 0;

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <header className="flex items-center justify-between px-4 md:px-6 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
                <div className="flex items-center gap-2 md:gap-4 min-w-0">
                    {/* Mobile nav trigger — this page has a custom layout, so the
                        shared sidebar is otherwise unreachable on small screens. */}
                    <SidebarTrigger className="md:hidden" />
                    <Link href="/dashboard" onClick={handleBackNavigation}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Back to dashboard">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold flex items-center gap-2 truncate tracking-tight">
                            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                                <Wand2 className="h-4 w-4" />
                            </span>
                            AI Dump
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 md:gap-2">
                    {/* Streaming Status Badge */}
                    {streamingStatus && (
                        <Badge variant="secondary" className="gap-1.5 animate-pulse hidden sm:flex" role="status" aria-live="polite">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {streamingStatus}
                        </Badge>
                    )}

                    {/* Stop / cancel an in-flight generation */}
                    {isGenerating && (
                        <Button variant="outline" size="sm" onClick={cancel} className="gap-1.5 text-xs">
                            <Square className="h-3 w-3 fill-current" />
                            Stop
                        </Button>
                    )}

                    {/* Mobile-only panel toggles (the asides become Sheets below lg) */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 lg:hidden"
                        aria-label="Open options"
                        onClick={() => setOptionsSheetOpen(true)}
                    >
                        <Settings2 className="h-4 w-4" />
                    </Button>
                    {(aiDump || isProcessing) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 lg:hidden"
                            aria-label="Open title, tags and summary"
                            onClick={() => setMetadataSheetOpen(true)}
                        >
                            <PanelRight className="h-4 w-4" />
                        </Button>
                    )}

                    {aiDump && (
                        <>
                            <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-xs">
                                <RotateCcw className="h-3 w-3" />
                                <span className="hidden sm:inline">Reset</span>
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={isProcessing || !selectedTitle.trim()} className="gap-1.5">
                                Save Note
                            </Button>
                        </>
                    )}
                </div>
            </header>

            {/* Main Content - 3 Column Layout (lg+); stacks to a single column below lg. */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0">
                {/* Left Panel - Options (desktop inline; mobile lives in a Sheet) */}
                <aside className="hidden lg:block w-[240px] flex-shrink-0 border-r overflow-auto bg-muted/20">
                    <OptionsPanel
                        options={options}
                        handleOptionsChange={handleOptionsChange}
                        isProcessing={isProcessing}
                        detectedContentType={detectedContentType}
                    />
                </aside>
                {/* Center Panel - Preview (Primary Focus) */}
                <main className="flex-1 overflow-auto flex flex-col bg-background min-w-0 border-r">
                    {/* Reasoning ("Thinking…") — self-hides when there is none */}
                    {aiDump?.reasoning && (
                        <div className="px-4 pt-3">
                            <ThinkingPanel reasoning={aiDump.reasoning} isStreaming={isGenerating} />
                        </div>
                    )}
                    {/* Non-fatal warning (e.g. content truncated) */}
                    {warning && (
                        <div className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200" role="status">
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            <span>{warning}</span>
                        </div>
                    )}
                    {/* Error (persists in the preview state, not just a toast) */}
                    {error && aiDump && (
                        <div className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    {!aiDump && !isProcessing ? (
                        // Input State
                        <div className="flex-1 flex flex-col p-6">
                            {/* Hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept={Object.keys(SUPPORTED_FILE_TYPES).join(",")}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileSelect(file);
                                }}
                            />

                            <div className="flex-1 flex flex-col">
                                {/* Drag & Drop Zone */}
                                <div
                                    onDragEnter={handleDragEnter}
                                    onDragLeave={handleDragLeave}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    className={cn(
                                        "relative flex-1 min-h-[300px] border-2 border-dashed rounded-xl transition-all",
                                        isDragging
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-ring/50"
                                    )}
                                >
                                    {/* Drag overlay */}
                                    {isDragging && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-primary/5 backdrop-blur-sm z-10 rounded-lg">
                                            <div className="text-center">
                                                <Upload className="h-12 w-12 mx-auto text-primary mb-3" />
                                                <p className="text-lg font-medium text-primary">Drop file here</p>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    PDF, Word, Images, Text
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Upload progress */}
                                    {isUploading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10 rounded-lg">
                                            <div className="text-center w-48">
                                                <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin mb-3" />
                                                <p className="text-sm font-medium">Processing file...</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Extracting text, this may take a moment
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Uploaded file badge */}
                                    {processedFile && (
                                        <div className="absolute top-3 left-3 flex items-center gap-2 z-5">
                                            <Badge variant="secondary" className="gap-1.5 pr-1">
                                                {processedFile.type === "image" ? (
                                                    <Image className="h-3 w-3" />
                                                ) : (
                                                    <File className="h-3 w-3" />
                                                )}
                                                {processedFile.metadata.filename}
                                                <button
                                                    aria-label="Remove file"
                                                    onClick={() => {
                                                        clearFile();
                                                        setInputContent("");
                                                        setUploadedImage(null);
                                                    }}
                                                    className="ml-1 p-0.5 rounded-full hover:bg-muted-foreground/20"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        </div>
                                    )}

                                    {/* Image preview */}
                                    {uploadedImage && (
                                        <div className="absolute top-3 right-3 w-24 h-24 rounded-lg overflow-hidden border shadow-sm z-5">
                                            <img
                                                src={uploadedImage}
                                                alt={processedFile?.metadata.filename ? `Uploaded: ${processedFile.metadata.filename}` : "Uploaded image preview"}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}

                                    <Textarea
                                        placeholder="Paste your content here or drag & drop a file...&#10;&#10;• Meeting notes&#10;• Research papers (PDF)&#10;• Word documents&#10;• Images & Screenshots&#10;&#10;Transform any content into a polished, structured note."
                                        value={inputContent}
                                        onChange={(e) => setInputContent(e.target.value)}
                                        className="h-full w-full resize-none text-sm border-0 focus:ring-0 rounded-lg p-4 bg-transparent"
                                        disabled={isProcessing || isUploading}
                                    />
                                </div>

                                <div className="flex items-center justify-between mt-4">
                                    <div className="flex items-center gap-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={openFilePicker}
                                            disabled={isProcessing || isUploading}
                                            className="gap-1.5"
                                        >
                                            <Upload className="h-4 w-4" />
                                            Upload
                                        </Button>
                                        <div className="text-xs text-muted-foreground space-x-3">
                                            <span>{inputContent.length} chars</span>
                                            <span>•</span>
                                            <span>{wordCount} words</span>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={(!inputContent.trim() && !uploadedImage) || isProcessing || isUploading}
                                        className="gap-2"
                                    >
                                        <Wand2 className="h-4 w-4" />
                                        Run AI Dump
                                        <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-primary-foreground/20 rounded font-mono">
                                            {isApple ? "⌘↵" : "Ctrl ↵"}
                                        </kbd>
                                    </Button>
                                </div>

                                {(error || uploadError) && (
                                    <p className="text-sm text-destructive mt-2">{error || uploadError}</p>
                                )}

                                {/* Resume a draft */}
                                {drafts.length > 0 && (
                                    <div className="mt-6 pt-4 border-t">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    Resume a Draft
                                                </span>
                                                {draftsLoading && (
                                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                                )}
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                Drafts auto-delete after 7 days
                                            </span>
                                        </div>
                                        <div className="space-y-1.5 max-h-56 overflow-auto">
                                            {drafts.map((draft) => (
                                                <div
                                                    key={draft.id}
                                                    className="group flex items-center gap-2 rounded-lg border bg-card p-2 hover:border-primary/40 transition-colors"
                                                >
                                                    <button
                                                        onClick={() => handleLoadDraft(draft.id)}
                                                        className="flex-1 min-w-0 text-left"
                                                    >
                                                        <p className="text-xs font-medium truncate">
                                                            {draft.title || "Untitled draft"}
                                                        </p>
                                                        {draft.tldr && (
                                                            <p className="text-xs text-muted-foreground truncate">
                                                                {draft.tldr}
                                                            </p>
                                                        )}
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {getRelativeTime(draft.updatedAt)}
                                                        </p>
                                                    </button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                                                        aria-label={`Delete draft ${draft.title || "Untitled draft"}`}
                                                        disabled={deletingDraftId === draft.id}
                                                        onClick={() => requestDeleteDraft(draft)}
                                                    >
                                                        {deletingDraftId === draft.id ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <X className="h-3.5 w-3.5" />
                                                        )}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Preview State - Main Content Area (CENTER)
                        <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as typeof previewTab)} className="flex flex-col h-full">
                            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                                <TabsList className="bg-transparent h-8">
                                    <TabsTrigger value="generated" className="text-xs h-7 px-3 data-[state=active]:bg-background">
                                        <Eye className="h-3 w-3 mr-1.5" />
                                        Preview
                                    </TabsTrigger>
                                    <TabsTrigger value="raw" className="text-xs h-7 px-3 data-[state=active]:bg-background">
                                        <FileText className="h-3 w-3 mr-1.5" />
                                        Input
                                    </TabsTrigger>
                                    <TabsTrigger value="diff" className="text-xs h-7 px-3 data-[state=active]:bg-background">
                                        <GitCompare className="h-3 w-3 mr-1.5" />
                                        Compare
                                    </TabsTrigger>
                                </TabsList>

                                <div className="flex items-center gap-1">
                                    {/* Output size indicator */}
                                    {hasMarkdown && previewTab === "generated" && !isProcessing && (
                                        <span className="text-xs text-muted-foreground mr-2 font-mono">
                                            {(() => {
                                                const md = editedMarkdown || aiDump?.markdown || "";
                                                const words = md.trim().split(/\s+/).filter(Boolean).length;
                                                return `${words.toLocaleString()} words · ${md.length.toLocaleString()} chars`;
                                            })()}
                                        </span>
                                    )}
                                    {/* Edit/View Toggle */}
                                    {hasMarkdown && previewTab === "generated" && (
                                        <Button
                                            variant={isEditMode ? "default" : "ghost"}
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={() => setIsEditMode(!isEditMode)}
                                        >
                                            {isEditMode ? (
                                                <>
                                                    <Eye className="h-3 w-3 mr-1" />
                                                    Preview
                                                </>
                                            ) : (
                                                <>
                                                    <Edit className="h-3 w-3 mr-1" />
                                                    Edit
                                                </>
                                            )}
                                        </Button>
                                    )}

                                    {/* Copy Button */}
                                    {hasMarkdown && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={() => copyToClipboard(editedMarkdown || aiDump!.markdown, "markdown")}
                                        >
                                            {copiedSection === "markdown" ? (
                                                <Check className="h-3 w-3 mr-1 text-success" />
                                            ) : (
                                                <Copy className="h-3 w-3 mr-1" />
                                            )}
                                            Copy
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto">
                                <TabsContent value="generated" className="m-0 h-full">
                                    {(hasMarkdown || (isProcessing && aiDump)) ? (
                                        <div className="p-6">
                                            <h1 className="text-2xl font-bold mb-3">{selectedTitle || "Untitled"}</h1>
                                            {selectedTags.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mb-4">
                                                    {selectedTags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
                                                        >
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* EDIT MODE: Show textarea */}
                                            {isEditMode ? (
                                                <div className="space-y-3">
                                                    <Textarea
                                                        value={editedMarkdown}
                                                        onChange={(e) => setEditedMarkdown(e.target.value)}
                                                        className="min-h-[400px] font-mono text-sm resize-none"
                                                        placeholder="Edit your markdown here..."
                                                    />
                                                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                                        <div className="flex items-center gap-2">
                                                            <FileCode className="h-3 w-3" />
                                                            <span>Markdown editing • Edits are kept and saved when you click Save Note</span>
                                                        </div>
                                                        {aiDump?.markdown && editedMarkdown !== aiDump.markdown && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 text-xs gap-1 flex-shrink-0"
                                                                onClick={() => setEditedMarkdown(aiDump.markdown)}
                                                            >
                                                                <RotateCcw className="h-3 w-3" />
                                                                Revert to generated
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                /* VIEW MODE: Show rendered markdown */
                                                <MarkdownRenderer
                                                    content={editedMarkdown || aiDump?.markdown || ""}
                                                    isStreaming={isGenerating}
                                                    enableCopyCode
                                                />
                                            )}

                                            {/* Refinement Controls */}
                                            {!isProcessing && (
                                                <div className="mt-6 pt-4 border-t space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <PenLine className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-xs font-medium text-muted-foreground">Refine Output</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            disabled={isRefining || isRegenerating.markdown}
                                                            onClick={() => handleRefine("Make it shorter and more concise")}
                                                        >
                                                            Shorter
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            disabled={isRefining || isRegenerating.markdown}
                                                            onClick={() => handleRefine("Add more detail and examples")}
                                                        >
                                                            More Detail
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            disabled={isRefining || isRegenerating.markdown}
                                                            onClick={() => handleRefine("Make it more professional and formal")}
                                                        >
                                                            More Formal
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            disabled={isRefining || isRegenerating.markdown}
                                                            onClick={() => handleRefine("Add bullet points for key information")}
                                                        >
                                                            Add Bullets
                                                        </Button>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Textarea
                                                            placeholder="Or type a custom instruction... (e.g., 'Focus more on action items')"
                                                            value={refinementInput}
                                                            onChange={(e) => setRefinementInput(e.target.value)}
                                                            className="h-16 text-xs resize-none"
                                                            disabled={isRefining || isRegenerating.markdown}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            className="h-16 px-4"
                                                            disabled={!refinementInput.trim() || isRefining || isRegenerating.markdown}
                                                            onClick={() => handleRefine(refinementInput)}
                                                        >
                                                            {isRefining || isRegenerating.markdown ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <RefreshCw className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : isProcessing ? (
                                        <div className="p-6 space-y-4">
                                            <Skeleton className="h-8 w-3/4" />
                                            <div className="flex gap-2">
                                                <Skeleton className="h-5 w-16 rounded-full" />
                                                <Skeleton className="h-5 w-20 rounded-full" />
                                            </div>
                                            <div className="space-y-2 mt-4">
                                                <Skeleton className="h-4 w-full" />
                                                <Skeleton className="h-4 w-full" />
                                                <Skeleton className="h-4 w-2/3" />
                                                <Skeleton className="h-4 w-full" />
                                                <Skeleton className="h-4 w-4/5" />
                                            </div>
                                        </div>
                                    ) : (
                                        <EmptyState icon={Eye} message="Run AI Dump to see preview" />
                                    )}
                                </TabsContent>

                                <TabsContent value="raw" className="m-0 h-full">
                                    {inputContent ? (
                                        <pre className="p-6 text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                                            {inputContent}
                                        </pre>
                                    ) : (
                                        <EmptyState icon={FileText} message="Paste content to see raw input" />
                                    )}
                                </TabsContent>

                                <TabsContent value="diff" className="m-0 h-full">
                                    {hasMarkdown ? (
                                        <div className="p-6 space-y-4">
                                            <div>
                                                <Badge variant="outline" className="mb-2 text-xs bg-destructive/10 text-destructive border-destructive/30">
                                                    Original ({inputContent.length} chars)
                                                </Badge>
                                                <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground max-h-40 overflow-auto bg-muted/50 rounded-md p-2">
                                                    {inputContent.slice(0, 500)}{inputContent.length > 500 ? "..." : ""}
                                                </pre>
                                            </div>
                                            <div>
                                                <Badge variant="outline" className="mb-2 text-xs bg-success/10 text-success border-success/30">
                                                    Generated ({aiDump!.markdown.length} chars)
                                                </Badge>
                                                <pre className="text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto bg-muted/50 rounded-md p-2">
                                                    {aiDump!.markdown.slice(0, 500)}{aiDump!.markdown.length > 500 ? "..." : ""}
                                                </pre>
                                            </div>
                                        </div>
                                    ) : (
                                        <EmptyState icon={GitCompare} message="Run AI Dump to compare" />
                                    )}
                                </TabsContent>
                            </div>
                        </Tabs>
                    )}
                </main>

                {/* Resize Handle — pointer-driven, so desktop (lg+) only */}
                <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize metadata panel"
                    className="hidden lg:block w-1 bg-border hover:bg-primary/50 cursor-col-resize flex-shrink-0 relative group"
                    onMouseDown={handleRightPanelResize}
                >
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-4 h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="h-6 w-6 text-muted-foreground" />
                    </div>
                </div>

                {/* Right Panel - Metadata & Actions (desktop inline; mobile in a Sheet) */}
                <aside
                    className="hidden lg:block flex-shrink-0 overflow-auto bg-muted/10"
                    style={{ width: rightPanelWidth }}
                >
                    <MetadataPanel
                        aiDump={aiDump}
                        isProcessing={isProcessing}
                        options={options}
                        collapsedSections={collapsedSections}
                        toggleSectionCollapse={toggleSectionCollapse}
                        regenerateSection={regenerateSection}
                        isRegenerating={isRegenerating}
                        selectedTitle={selectedTitle}
                        setSelectedTitle={setSelectedTitle}
                        selectedTags={selectedTags}
                        toggleTag={toggleTag}
                        copyToClipboard={copyToClipboard}
                        copiedSection={copiedSection}
                        hasTitles={!!hasTitles}
                        hasTags={!!hasTags}
                        hasMarkdown={!!hasMarkdown}
                        hasTldr={!!hasTldr}
                        hasSummary={!!hasSummary}
                        hasActions={!!hasActions}
                    />
                </aside>
            </div>

            {/* Mobile: Options panel in a left Sheet */}
            <Sheet open={optionsSheetOpen} onOpenChange={setOptionsSheetOpen}>
                <SheetContent side="left" className="w-[88vw] max-w-[320px] overflow-auto p-0 lg:hidden">
                    <SheetHeader className="px-4 pt-4 pb-0">
                        <SheetTitle className="flex items-center gap-2 text-sm">
                            <Settings2 className="h-4 w-4 text-primary" />
                            Options
                        </SheetTitle>
                    </SheetHeader>
                    <OptionsPanel
                        options={options}
                        handleOptionsChange={handleOptionsChange}
                        isProcessing={isProcessing}
                        detectedContentType={detectedContentType}
                    />
                </SheetContent>
            </Sheet>

            {/* Mobile: Metadata panel in a right Sheet */}
            <Sheet open={metadataSheetOpen} onOpenChange={setMetadataSheetOpen}>
                <SheetContent side="right" className="w-[88vw] max-w-[340px] overflow-auto p-0 lg:hidden">
                    <SheetHeader className="px-4 pt-4 pb-0">
                        <SheetTitle className="flex items-center gap-2 text-sm">
                            <PanelRight className="h-4 w-4 text-primary" />
                            Title, Tags & Summary
                        </SheetTitle>
                    </SheetHeader>
                    <MetadataPanel
                        aiDump={aiDump}
                        isProcessing={isProcessing}
                        options={options}
                        collapsedSections={collapsedSections}
                        toggleSectionCollapse={toggleSectionCollapse}
                        regenerateSection={regenerateSection}
                        isRegenerating={isRegenerating}
                        selectedTitle={selectedTitle}
                        setSelectedTitle={setSelectedTitle}
                        selectedTags={selectedTags}
                        toggleTag={toggleTag}
                        copyToClipboard={copyToClipboard}
                        copiedSection={copiedSection}
                        hasTitles={!!hasTitles}
                        hasTags={!!hasTags}
                        hasMarkdown={!!hasMarkdown}
                        hasTldr={!!hasTldr}
                        hasSummary={!!hasSummary}
                        hasActions={!!hasActions}
                    />
                </SheetContent>
            </Sheet>

            {/* Confirm permanent draft deletion */}
            <Dialog
                open={!!draftPendingDelete}
                onOpenChange={(open) => {
                    if (!open) setDraftPendingDelete(null);
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete this draft?</DialogTitle>
                        <DialogDescription>
                            {draftPendingDelete?.title || "This untitled draft"} will be
                            permanently removed. This can&apos;t be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDraftPendingDelete(null)}
                            disabled={!!deletingDraftId}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteDraft}
                            disabled={!!deletingDraftId}
                            className="gap-1.5"
                        >
                            {deletingDraftId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <X className="h-4 w-4" />
                            )}
                            Delete draft
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ============================================================================
// Sub-Components
// ============================================================================

interface OptionsPanelProps {
    options: AIDumpOptions;
    handleOptionsChange: (newOptions: Partial<AIDumpOptions>) => void;
    isProcessing: boolean;
    detectedContentType: ContentTypeResult | null;
}

function OptionsPanel({
    options,
    handleOptionsChange,
    isProcessing,
    detectedContentType,
}: OptionsPanelProps) {
    // Unique per-instance id; OptionsPanel renders twice (desktop aside + mobile
    // Sheet), so a hardcoded id would collide and break aria-labelledby.
    const creativityLabelId = useId();
    return (
        <div className="p-4 space-y-5">
            <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Template
                </h3>
                <Select
                    value={options.template}
                    onValueChange={(v) => handleOptionsChange({ template: v as AIDumpOptions["template"] })}
                    disabled={isProcessing}
                >
                    <SelectTrigger className="w-full h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="auto">
                            <span className="flex items-center gap-2">
                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                                Auto-detect
                            </span>
                        </SelectItem>
                        <SelectItem value="meeting">
                            <span className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-blue-500" />
                                Meeting Notes
                            </span>
                        </SelectItem>
                        <SelectItem value="research">
                            <span className="flex items-center gap-2">
                                <BookOpen className="h-3.5 w-3.5 text-success" />
                                Research Notes
                            </span>
                        </SelectItem>
                        <SelectItem value="code-review">
                            <span className="flex items-center gap-2">
                                <FileCode className="h-3.5 w-3.5 text-orange-500" />
                                Code Review
                            </span>
                        </SelectItem>
                        <SelectItem value="code">
                            <span className="flex items-center gap-2">
                                <FileCode className="h-3.5 w-3.5 text-rose-500" />
                                Technical Docs
                            </span>
                        </SelectItem>
                        <SelectItem value="brainstorm">
                            <span className="flex items-center gap-2">
                                <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                                Brainstorm
                            </span>
                        </SelectItem>
                        <SelectItem value="lecture">
                            <span className="flex items-center gap-2">
                                <GraduationCap className="h-3.5 w-3.5 text-purple-500" />
                                Lecture Notes
                            </span>
                        </SelectItem>
                        <SelectItem value="article">
                            <span className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-cyan-500" />
                                Article Summary
                            </span>
                        </SelectItem>
                    </SelectContent>
                </Select>
                {/* Template description */}
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {options.template === "auto" && "AI will analyze content and choose the best format."}
                    {options.template === "meeting" && "Extracts attendees, decisions, and action items."}
                    {options.template === "research" && "Organizes findings with sources and methodology."}
                    {options.template === "code-review" && "Documents issues, suggestions, and good patterns."}
                    {options.template === "brainstorm" && "Groups ideas by theme and highlights top concepts."}
                    {options.template === "lecture" && "Formats with objectives, concepts, and summary."}
                    {options.template === "article" && "Summarizes with key points and takeaways."}
                    {options.template === "code" && "Documents code with explanations and examples."}
                </p>
                {/* Detected content type badge */}
                {detectedContentType && detectedContentType.confidence > 0.4 && (
                    <div className="mt-3 flex items-center gap-2">
                        <Badge
                            variant="secondary"
                            className={cn("text-xs gap-1", getContentTypeDisplay(detectedContentType.type).color)}
                        >
                            <Zap className="h-2.5 w-2.5" />
                            Detected: {getContentTypeDisplay(detectedContentType.type).label}
                        </Badge>
                        {detectedContentType.suggestedTemplate !== options.template &&
                            detectedContentType.suggestedTemplate !== "auto" && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 text-xs px-2"
                                    onClick={() => handleOptionsChange({ template: detectedContentType.suggestedTemplate as AIDumpOptions["template"] })}
                                >
                                    Use
                                </Button>
                            )}
                    </div>
                )}
            </div>

            <Separator />

            <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Generate
                </h3>
                <div className="space-y-2.5">
                    <ToggleOption
                        label="Title Variants"
                        icon={<Type className="h-3.5 w-3.5" />}
                        checked={options.toggles.titles}
                        onChange={() => handleOptionsChange({ toggles: { ...options.toggles, titles: !options.toggles.titles } })}
                        disabled={isProcessing}
                    />
                    <ToggleOption
                        label="Smart Tags"
                        icon={<Hash className="h-3.5 w-3.5" />}
                        checked={options.toggles.tags}
                        onChange={() => handleOptionsChange({ toggles: { ...options.toggles, tags: !options.toggles.tags } })}
                        disabled={isProcessing}
                    />
                    <ToggleOption
                        label="Structured Markdown"
                        icon={<FileCode className="h-3.5 w-3.5" />}
                        checked={options.toggles.markdown}
                        onChange={() => handleOptionsChange({ toggles: { ...options.toggles, markdown: !options.toggles.markdown } })}
                        disabled={isProcessing}
                    />
                    <ToggleOption
                        label="Action Items"
                        icon={<ListTodo className="h-3.5 w-3.5" />}
                        checked={options.toggles.actions}
                        onChange={() => handleOptionsChange({ toggles: { ...options.toggles, actions: !options.toggles.actions } })}
                        disabled={isProcessing}
                    />
                </div>
            </div>

            <Separator />

            <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Tone
                </h3>
                <Select
                    value={options.tone}
                    onValueChange={(v) => handleOptionsChange({ tone: v as AIDumpOptions["tone"] })}
                    disabled={isProcessing}
                >
                    <SelectTrigger className="w-full h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="balanced">Balanced</SelectItem>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Separator />

            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 id={creativityLabelId} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Creativity
                    </h3>
                    <span className="text-xs text-muted-foreground font-mono">
                        {options.temperature.toFixed(1)}
                    </span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={options.temperature}
                    onChange={(e) => handleOptionsChange({ temperature: parseFloat(e.target.value) })}
                    disabled={isProcessing}
                    aria-labelledby={creativityLabelId}
                    aria-valuetext={`${options.temperature.toFixed(1)} — ${
                        options.temperature <= 0.3
                            ? "precise"
                            : options.temperature >= 0.7
                              ? "creative"
                              : "balanced"
                    }`}
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Precise</span>
                    <span>Creative</span>
                </div>
            </div>
        </div>
    );
}

interface MetadataPanelProps {
    aiDump: AIDumpData | null;
    isProcessing: boolean;
    options: AIDumpOptions;
    collapsedSections: Record<string, boolean>;
    toggleSectionCollapse: (section: string) => void;
    regenerateSection: (section: "titles" | "tags" | "markdown" | "actions") => void;
    isRegenerating: Record<"titles" | "tags" | "markdown" | "actions", boolean>;
    selectedTitle: string;
    setSelectedTitle: (title: string) => void;
    selectedTags: string[];
    toggleTag: (tag: string) => void;
    copyToClipboard: (text: string, section: string) => void;
    copiedSection: string | null;
    hasTitles: boolean;
    hasTags: boolean;
    hasMarkdown: boolean;
    hasTldr: boolean;
    hasSummary: boolean;
    hasActions: boolean;
}

function MetadataPanel({
    aiDump,
    isProcessing,
    options,
    collapsedSections,
    toggleSectionCollapse,
    regenerateSection,
    isRegenerating,
    selectedTitle,
    setSelectedTitle,
    selectedTags,
    toggleTag,
    copyToClipboard,
    copiedSection,
    hasTitles,
    hasTags,
    hasMarkdown,
    hasTldr,
    hasSummary,
    hasActions,
}: MetadataPanelProps) {
    if (!aiDump && !isProcessing) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6">
                <Type className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm text-center">Title, tags, and summary will appear here after processing</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            {/* TL;DR Section */}
            <div className="space-y-2">
                <button
                    onClick={() => toggleSectionCollapse("tldr")}
                    aria-expanded={!collapsedSections.tldr}
                    className="flex items-center justify-between w-full text-left"
                >
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-primary">TL;DR</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", collapsedSections.tldr && "-rotate-90")} />
                </button>
                {!collapsedSections.tldr && (
                    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                        <CardContent className="p-3">
                            {hasTldr ? (
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {aiDump!.tldr}
                                </p>
                            ) : (
                                <Skeleton className="h-4 w-full" />
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <Separator />

            {/* Choose Title Section */}
            <ResultSection
                title="Choose Title"
                icon={<Type className="h-4 w-4" />}
                onRegenerate={() => regenerateSection("titles")}
                isRegenerating={isRegenerating.titles}
                isLoading={!hasTitles && isProcessing}
            >
                {hasTitles ? (
                    <div className="space-y-2" role="radiogroup" aria-label="Choose a title">
                        {aiDump!.titles.map((title, idx) => (
                            <button
                                key={idx}
                                role="radio"
                                aria-checked={selectedTitle === title.text}
                                onClick={() => setSelectedTitle(title.text)}
                                disabled={isProcessing}
                                className={cn(
                                    "w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-all text-xs disabled:opacity-60 disabled:cursor-not-allowed",
                                    selectedTitle === title.text
                                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                        : "border-muted hover:border-primary/30 hover:bg-muted/50"
                                )}
                            >
                                <div
                                    className={cn(
                                        "w-3 h-3 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                        selectedTitle === title.text
                                            ? "border-primary bg-primary"
                                            : "border-muted-foreground/30"
                                    )}
                                >
                                    {selectedTitle === title.text && (
                                        <Check className="h-2 w-2 text-primary-foreground" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <Badge variant="secondary" className="text-xs mb-1 capitalize">
                                        {title.variant}
                                    </Badge>
                                    <p className="text-xs leading-snug">{title.text}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                )}
            </ResultSection>

            <Separator />

            {/* Select Tags Section */}
            <ResultSection
                title="Select Tags"
                icon={<Hash className="h-4 w-4" />}
                onRegenerate={() => regenerateSection("tags")}
                isRegenerating={isRegenerating.tags}
                isLoading={!hasTags && isProcessing}
            >
                {hasTags ? (
                    <div className="flex flex-wrap gap-1.5">
                        {aiDump!.tags.map((tag) => (
                            <button
                                key={tag.name}
                                aria-pressed={selectedTags.includes(tag.name)}
                                onClick={() => toggleTag(tag.name)}
                                disabled={isProcessing}
                                className={cn(
                                    "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed",
                                    selectedTags.includes(tag.name)
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                )}
                            >
                                {selectedTags.includes(tag.name) ? (
                                    <Check className="h-2.5 w-2.5" />
                                ) : (
                                    <span className="w-2.5 h-2.5 rounded-full border border-current opacity-40" />
                                )}
                                {tag.name}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        <Skeleton className="h-6 w-16 rounded-full" />
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-6 w-14 rounded-full" />
                        <Skeleton className="h-6 w-18 rounded-full" />
                    </div>
                )}
            </ResultSection>

            <Separator />

            {/* Summary Section */}
            <div className="space-y-2">
                <button
                    onClick={() => toggleSectionCollapse("summary")}
                    aria-expanded={!collapsedSections.summary}
                    className="flex items-center justify-between w-full text-left"
                >
                    <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Summary</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", collapsedSections.summary && "-rotate-90")} />
                </button>
                {!collapsedSections.summary && (
                    <Card>
                        <CardContent className="p-3">
                            {hasSummary ? (
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {aiDump!.summary}
                                </p>
                            ) : (
                                <div className="space-y-1.5">
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-2/3" />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <Separator />

            {/* Action Items (shown when the toggle produced any) */}
            {(hasActions || (isProcessing && options.toggles.actions)) && (
                <>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Action Items
                            </span>
                        </div>
                        {hasActions ? (
                            <div className="space-y-1.5">
                                {aiDump!.actions.map((action, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-start gap-2 rounded-lg border bg-card p-2 text-xs"
                                    >
                                        <ListTodo className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="leading-snug">{action.text}</p>
                                            {(action.assignee || action.due_date) && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {action.assignee && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            {action.assignee}
                                                        </Badge>
                                                    )}
                                                    {action.due_date && (
                                                        <Badge variant="outline" className="text-xs">
                                                            {action.due_date}
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        )}
                    </div>

                    <Separator />
                </>
            )}

            {/* Quick Actions */}
            <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Quick Actions
                </h4>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                            const allContent = `# ${selectedTitle}\n\n${selectedTags.map(t => `#${t}`).join(" ")}\n\n${aiDump?.markdown || ""}`;
                            copyToClipboard(allContent, "all");
                        }}
                        disabled={!hasMarkdown}
                    >
                        {copiedSection === "all" ? (
                            <Check className="h-3 w-3 text-success" />
                        ) : (
                            <Copy className="h-3 w-3" />
                        )}
                        Copy All
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => regenerateSection("markdown")}
                        disabled={isRegenerating.markdown || !hasMarkdown}
                    >
                        <RefreshCw className={cn("h-3 w-3", isRegenerating.markdown && "animate-spin")} />
                        Regenerate
                    </Button>
                </div>
            </div>
        </div>
    );
}

function ToggleOption({
    label,
    icon,
    checked,
    onChange,
    disabled,
}: {
    label: string;
    icon: React.ReactNode;
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
}) {
    return (
        <label className="flex items-center gap-2.5 cursor-pointer group">
            <Checkbox
                checked={checked}
                onCheckedChange={onChange}
                disabled={disabled}
                className="h-4 w-4"
            />
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">{icon}</span>
            <span className="text-sm group-hover:text-foreground transition-colors">{label}</span>
        </label>
    );
}

function ResultSection({
    title,
    icon,
    onRegenerate,
    isRegenerating,
    isLoading,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    onRegenerate: () => void;
    isRegenerating: boolean;
    isLoading?: boolean;
    children: React.ReactNode;
}) {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <Card>
            <CardHeader className="py-0 px-4">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                    >
                        <ChevronDown
                            className={cn("h-4 w-4 transition-transform", !isExpanded && "-rotate-90")}
                        />
                        <span className="text-muted-foreground">{icon}</span>
                        {title}
                        {isLoading && (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-2" />
                        )}
                    </button>
                    {!isLoading && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onRegenerate}
                            disabled={isRegenerating}
                            className="h-7 text-xs gap-1"
                        >
                            <RefreshCw className={cn("h-3 w-3", isRegenerating && "animate-spin")} />
                            Regenerate
                        </Button>
                    )}
                </div>
            </CardHeader>
            {isExpanded && <CardContent className="pt-0 px-4 pb-4">{children}</CardContent>}
        </Card>
    );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
            <Icon className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm">{message}</p>
        </div>
    );
}
