"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
    Mail,
    Cpu,
    Zap,
    PenLine,
    Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAIDump } from "@/hooks/use-ai-dump";
import { useFileUpload, SUPPORTED_FILE_TYPES } from "@/hooks/use-file-upload";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { AIDumpOptions } from "@/lib/validations/ai-dump";
import Link from "next/link";
import { MarkdownRenderer } from "@/components/markdown";
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
            const delta = e.clientX - startX.current;
            const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current - delta));
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
    const [selectedModel, setSelectedModel] = useState<string>("gemini-2.0-flash");
    const [isRefining, setIsRefining] = useState(false);
    const [refinementInput, setRefinementInput] = useState("");

    // Inline editor
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedMarkdown, setEditedMarkdown] = useState("");

    // Detect content type from input
    const detectedContentType = useMemo<ContentTypeResult | null>(() => {
        if (inputContent.length < 50) return null;
        return detectContentType(inputContent);
    }, [inputContent]);

    const { width: previewWidth, handleMouseDown } = useResizablePanel(400, 300, 600);

    const {
        aiDump,
        isProcessing,
        isRegenerating,
        error,
        streamingStatus,
        selectedTitle,
        selectedTags,
        createAIDump,
        regenerateSection,
        finalize,
        setSelectedTitle,
        toggleTag,
        reset,
    } = useAIDump();

    const {
        isDragging,
        isUploading,
        uploadProgress,
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

    // Keyboard shortcut: Ctrl+Enter to submit
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && inputContent.trim() && !isProcessing && !aiDump) {
                e.preventDefault();
                handleSubmit();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [inputContent, isProcessing, aiDump]);

    // Sync edited markdown with AI dump output
    useEffect(() => {
        if (aiDump?.markdown && !isProcessing) {
            setEditedMarkdown(aiDump.markdown);
        }
    }, [aiDump?.markdown, isProcessing]);

    const handleSubmit = useCallback(async () => {
        if (!inputContent.trim()) return;
        // TODO: Pass uploadedImage for multimodal processing
        await createAIDump(inputContent, options);
    }, [inputContent, options, createAIDump]);

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
        const noteId = await finalize();
        if (noteId) {
            router.push(`/notes/${noteId}`);
        }
    }, [finalize, router]);

    const handleReset = useCallback(() => {
        setInputContent("");
        reset();
    }, [reset]);

    const copyToClipboard = useCallback(
        async (text: string, section: string) => {
            await navigator.clipboard.writeText(text);
            setCopiedSection(section);
            toast({ title: "Copied to clipboard" });
            setTimeout(() => setCopiedSection(null), 2000);
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

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-lg font-semibold flex items-center gap-2">
                            <Wand2 className="h-4 w-4 text-primary" />
                            AI Dump
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Streaming Status Badge */}
                    {streamingStatus && (
                        <Badge variant="secondary" className="gap-1.5 animate-pulse">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {streamingStatus}
                        </Badge>
                    )}

                    {aiDump && (
                        <>
                            <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-xs">
                                <RotateCcw className="h-3 w-3" />
                                Reset
                            </Button>
                            <Button size="sm" onClick={handleSave} className="gap-1.5">
                                Save Note
                            </Button>
                        </>
                    )}
                </div>
            </header>

            {/* Main Content - 3 Column Layout with Resizable Preview */}
            <div className="flex-1 flex min-h-0">
                {/* Left Panel - Options */}
                <aside className="w-[260px] flex-shrink-0 border-r overflow-auto bg-muted/20">
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
                                            <BookOpen className="h-3.5 w-3.5 text-green-500" />
                                            Research Notes
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="code-review">
                                        <span className="flex items-center gap-2">
                                            <FileCode className="h-3.5 w-3.5 text-orange-500" />
                                            Code Review
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
                            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
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
                                        className={cn("text-[10px] gap-1", getContentTypeDisplay(detectedContentType.type).color)}
                                    >
                                        <Zap className="h-2.5 w-2.5" />
                                        Detected: {getContentTypeDisplay(detectedContentType.type).label}
                                    </Badge>
                                    {detectedContentType.suggestedTemplate !== options.template &&
                                        detectedContentType.suggestedTemplate !== "auto" && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 text-[10px] px-2"
                                                onClick={() => handleOptionsChange({ template: detectedContentType.suggestedTemplate as AIDumpOptions["template"] })}
                                            >
                                                Use
                                            </Button>
                                        )}
                                </div>
                            )}
                        </div>

                        <Separator />

                        {/* AI Model Selection */}
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                                <Cpu className="h-3 w-3" />
                                AI Model
                            </h3>
                            <Select
                                value={selectedModel}
                                onValueChange={setSelectedModel}
                                disabled={isProcessing}
                            >
                                <SelectTrigger className="w-full h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gemini-2.0-flash">
                                        <span className="flex items-center gap-2">
                                            <Zap className="h-3 w-3 text-yellow-500" />
                                            Gemini 2.0 Flash
                                            <Badge variant="outline" className="text-[8px] px-1 ml-1">Fast</Badge>
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="gemini-1.5-pro">
                                        <span className="flex items-center gap-2">
                                            <Sparkles className="h-3 w-3 text-purple-500" />
                                            Gemini 1.5 Pro
                                            <Badge variant="outline" className="text-[8px] px-1 ml-1">Quality</Badge>
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="gpt-4o-mini">
                                        <span className="flex items-center gap-2">
                                            <Cpu className="h-3 w-3 text-green-500" />
                                            GPT-4o Mini
                                            <Badge variant="outline" className="text-[8px] px-1 ml-1">OpenAI</Badge>
                                        </span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground mt-2">
                                {selectedModel === "gemini-2.0-flash" && "Fastest option, great for most content."}
                                {selectedModel === "gemini-1.5-pro" && "Higher quality, better for complex content."}
                                {selectedModel === "gpt-4o-mini" && "OpenAI alternative, good balance."}
                            </p>
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
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                                className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                                <span>Precise</span>
                                <span>Creative</span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Center Panel - Input & Results */}
                <main className="flex-1 overflow-auto flex flex-col bg-background min-w-0">
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
                                        "relative flex-1 min-h-[300px] border-2 border-dashed rounded-lg transition-all",
                                        isDragging
                                            ? "border-primary bg-primary/5"
                                            : "border-muted hover:border-muted-foreground/30"
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
                                                <Progress value={uploadProgress} className="mt-2" />
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
                                                alt="Uploaded"
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
                                        disabled={!inputContent.trim() || isProcessing}
                                        className="gap-2"
                                    >
                                        <Wand2 className="h-4 w-4" />
                                        Run AI Dump
                                        <kbd className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary-foreground/20 rounded font-mono">
                                            ⌘↵
                                        </kbd>
                                    </Button>
                                </div>

                                {(error || uploadError) && (
                                    <p className="text-sm text-destructive mt-2">{error || uploadError}</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Results State (with loading skeletons)
                        <div className="flex-1 overflow-auto p-6 space-y-4">
                            {/* TL;DR Card */}
                            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent overflow-hidden">
                                <CardContent className="px-4">
                                    <div className="flex items-start gap-3">
                                        <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-primary mb-1.5">
                                                TL;DR
                                            </h4>
                                            {hasTldr ? (
                                                <p className="text-sm text-muted-foreground leading-relaxed">
                                                    {aiDump.tldr}
                                                </p>
                                            ) : (
                                                <Skeleton className="h-4 w-full" />
                                            )}
                                        </div>
                                        {hasTldr && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 flex-shrink-0"
                                                onClick={() => copyToClipboard(aiDump!.tldr, "tldr")}
                                            >
                                                {copiedSection === "tldr" ? (
                                                    <Check className="h-3 w-3 text-green-500" />
                                                ) : (
                                                    <Copy className="h-3 w-3" />
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Titles - with loading state */}
                            <ResultSection
                                title="Choose Title"
                                icon={<Type className="h-4 w-4" />}
                                onRegenerate={() => regenerateSection("titles")}
                                isRegenerating={isRegenerating.titles}
                                isLoading={!hasTitles && isProcessing}
                            >
                                {hasTitles ? (
                                    <div className="space-y-2">
                                        {aiDump!.titles.map((title, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setSelectedTitle(title.text)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                                                    selectedTitle === title.text
                                                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                                        : "border-muted hover:border-primary/30 hover:bg-muted/50"
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                                        selectedTitle === title.text
                                                            ? "border-primary bg-primary"
                                                            : "border-muted-foreground/30"
                                                    )}
                                                >
                                                    {selectedTitle === title.text && (
                                                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <Badge variant="secondary" className="text-[10px] mb-1 capitalize">
                                                        {title.variant}
                                                    </Badge>
                                                    <p className="text-sm">{title.text}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Skeleton className="h-16 w-full" />
                                        <Skeleton className="h-16 w-full" />
                                        <Skeleton className="h-16 w-full" />
                                    </div>
                                )}
                            </ResultSection>

                            {/* Tags - with loading state */}
                            <ResultSection
                                title="Select Tags"
                                icon={<Hash className="h-4 w-4" />}
                                onRegenerate={() => regenerateSection("tags")}
                                isRegenerating={isRegenerating.tags}
                                isLoading={!hasTags && isProcessing}
                            >
                                {hasTags ? (
                                    <div className="flex flex-wrap gap-2">
                                        {aiDump!.tags.map((tag) => (
                                            <button
                                                key={tag.name}
                                                onClick={() => toggleTag(tag.name)}
                                                className={cn(
                                                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all",
                                                    selectedTags.includes(tag.name)
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                                )}
                                            >
                                                {selectedTags.includes(tag.name) ? (
                                                    <Check className="h-3 w-3" />
                                                ) : (
                                                    <span className="w-3 h-3 rounded-full border border-current opacity-40" />
                                                )}
                                                {tag.name}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        <Skeleton className="h-8 w-20 rounded-full" />
                                        <Skeleton className="h-8 w-24 rounded-full" />
                                        <Skeleton className="h-8 w-16 rounded-full" />
                                        <Skeleton className="h-8 w-28 rounded-full" />
                                        <Skeleton className="h-8 w-20 rounded-full" />
                                    </div>
                                )}
                            </ResultSection>

                            {/* Summary - with loading state */}
                            <Card>
                                <CardContent className="px-6">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                        Summary
                                    </h4>
                                    {hasSummary ? (
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {aiDump!.summary}
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-3/4" />
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </main>

                {/* Resize Handle */}
                <div
                    className="w-1 bg-border hover:bg-primary/50 cursor-col-resize flex-shrink-0 relative group"
                    onMouseDown={handleMouseDown}
                >
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-4 h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="h-6 w-6 text-muted-foreground" />
                    </div>
                </div>

                {/* Right Panel - Preview (Resizable) */}
                <aside
                    className="overflow-hidden flex flex-col bg-muted/10 flex-shrink-0"
                    style={{ width: previewWidth }}
                >
                    <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as typeof previewTab)} className="flex flex-col h-full">
                        <div className="flex items-center justify-between px-4 py-2 border-b bg-background/50">
                            <TabsList className="bg-transparent h-8">
                                <TabsTrigger value="generated" className="text-xs h-7 px-2 data-[state=active]:bg-background">
                                    <Eye className="h-3 w-3 mr-1" />
                                    Preview
                                </TabsTrigger>
                                <TabsTrigger value="raw" className="text-xs h-7 px-2 data-[state=active]:bg-background">
                                    <FileText className="h-3 w-3 mr-1" />
                                    Raw
                                </TabsTrigger>
                                <TabsTrigger value="diff" className="text-xs h-7 px-2 data-[state=active]:bg-background">
                                    <GitCompare className="h-3 w-3 mr-1" />
                                    Diff
                                </TabsTrigger>
                            </TabsList>

                            <div className="flex items-center gap-1">
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
                                            <Check className="h-3 w-3 mr-1 text-green-500" />
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
                                {/* Show content if we have markdown OR if we're processing with aiDump (streaming) */}
                                {(hasMarkdown || (isProcessing && aiDump)) ? (
                                    <div className="p-4">
                                        <h1 className="text-xl font-bold mb-3">{selectedTitle || "Untitled"}</h1>
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
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <FileCode className="h-3 w-3" />
                                                    <span>Markdown editing • Changes auto-save</span>
                                                </div>
                                            </div>
                                        ) : (
                                            /* VIEW MODE: Show rendered markdown */
                                            <MarkdownRenderer
                                                content={editedMarkdown || aiDump?.markdown || ""}
                                                isStreaming={isProcessing}
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
                                                        onClick={() => {
                                                            setRefinementInput("Make it shorter and more concise");
                                                        }}
                                                    >
                                                        Shorter
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        disabled={isRefining || isRegenerating.markdown}
                                                        onClick={() => {
                                                            setRefinementInput("Add more detail and examples");
                                                        }}
                                                    >
                                                        More Detail
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        disabled={isRefining || isRegenerating.markdown}
                                                        onClick={() => {
                                                            setRefinementInput("Make it more professional and formal");
                                                        }}
                                                    >
                                                        More Formal
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        disabled={isRefining || isRegenerating.markdown}
                                                        onClick={() => {
                                                            setRefinementInput("Add bullet points for key information");
                                                        }}
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
                                                        onClick={async () => {
                                                            if (!refinementInput.trim()) return;
                                                            setIsRefining(true);
                                                            try {
                                                                const success = await regenerateSection("markdown", {
                                                                    tone: options.tone,
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
                                                        }}
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
                                    <div className="p-4 space-y-4">
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
                                    <pre className="p-4 text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                                        {inputContent}
                                    </pre>
                                ) : (
                                    <EmptyState icon={FileText} message="Paste content to see raw input" />
                                )}
                            </TabsContent>

                            <TabsContent value="diff" className="m-0 h-full">
                                {hasMarkdown ? (
                                    <div className="p-4 space-y-4">
                                        <div>
                                            <Badge variant="outline" className="mb-2 text-xs bg-red-500/10 text-red-600 border-red-200">
                                                Original ({inputContent.length} chars)
                                            </Badge>
                                            <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground max-h-40 overflow-auto bg-muted/50 rounded p-2">
                                                {inputContent.slice(0, 500)}{inputContent.length > 500 ? "..." : ""}
                                            </pre>
                                        </div>
                                        <div>
                                            <Badge variant="outline" className="mb-2 text-xs bg-green-500/10 text-green-600 border-green-200">
                                                Generated ({aiDump!.markdown.length} chars)
                                            </Badge>
                                            <pre className="text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto bg-muted/50 rounded p-2">
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
                </aside>
            </div>
        </div>
    );
}

// ============================================================================
// Sub-Components
// ============================================================================

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
