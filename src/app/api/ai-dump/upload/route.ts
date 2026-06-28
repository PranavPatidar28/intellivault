import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import { extractText } from "unpdf";
import { errorResponse } from "@/lib/api-error";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

type MammothLib = { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> };

let mammoth: MammothLib | null = null;

async function loadMammoth(): Promise<MammothLib> {
    if (!mammoth) {
        mammoth = await import("mammoth");
    }
    return mammoth!;
}

// Supported file types
const SUPPORTED_TYPES = {
    "text/plain": "text",
    "text/markdown": "markdown",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "image/png": "image",
    "image/jpeg": "image",
    "image/webp": "image",
    "image/gif": "image",
} as const;

type FileType = (typeof SUPPORTED_TYPES)[keyof typeof SUPPORTED_TYPES];

interface ProcessedFile {
    type: FileType;
    text: string;
    metadata: {
        filename: string;
        mimeType: string;
        size: number;
        pageCount?: number;
    };
    imageData?: string; // Base64 for images
}

/**
 * POST /api/ai-dump/upload
 * Process uploaded files for AI Dump
 */
export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await nextHeaders(),
    });

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = enforceRateLimit(session.user.id, RATE_LIMITS.upload);
    if (limited) return limited;

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file type
        const mimeType = file.type;
        const fileType = SUPPORTED_TYPES[mimeType as keyof typeof SUPPORTED_TYPES];

        if (!fileType) {
            return NextResponse.json(
                {
                    error: "Unsupported file type",
                    supported: Object.keys(SUPPORTED_TYPES),
                },
                { status: 400 }
            );
        }

        // Validate file size (max 10MB)
        const MAX_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { error: "File too large. Maximum size is 10MB." },
                { status: 400 }
            );
        }

        // Process based on file type
        let processed: ProcessedFile;

        switch (fileType) {
            case "text":
            case "markdown":
                processed = await processTextFile(file);
                break;
            case "pdf":
                processed = await processPdfFile(file);
                break;
            case "docx":
                processed = await processDocxFile(file);
                break;
            case "image":
                processed = await processImageFile(file);
                break;
            default:
                return NextResponse.json({ error: "Processing not implemented" }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            ...processed,
        });
    } catch (error) {
        console.error("File processing error:", error);
        return errorResponse("Failed to process file", 500, error);
    }
}

/**
 * Process plain text and markdown files
 */
async function processTextFile(file: File): Promise<ProcessedFile> {
    const text = await file.text();

    return {
        type: file.type === "text/markdown" ? "markdown" : "text",
        text,
        metadata: {
            filename: file.name,
            mimeType: file.type,
            size: file.size,
        },
    };
}

/**
 * Process PDF files using unpdf (serverless-compatible)
 */
async function processPdfFile(file: File): Promise<ProcessedFile> {
    const buffer = await file.arrayBuffer();
    const result = await extractText(buffer);

    // unpdf returns text as an array of strings (one per page)
    const textContent = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;

    return {
        type: "pdf",
        text: textContent,
        metadata: {
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            pageCount: result.totalPages,
        },
    };
}

/**
 * Process DOCX files
 */
async function processDocxFile(file: File): Promise<ProcessedFile> {
    const mammothLib = await loadMammoth();
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await mammothLib.extractRawText({ buffer });

    return {
        type: "docx",
        text: result.value,
        metadata: {
            filename: file.name,
            mimeType: file.type,
            size: file.size,
        },
    };
}

/**
 * Process image files - return base64 for multimodal processing
 */
async function processImageFile(file: File): Promise<ProcessedFile> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    return {
        type: "image",
        text: "", // Will be filled by AI vision
        imageData: `data:${file.type};base64,${base64}`,
        metadata: {
            filename: file.name,
            mimeType: file.type,
            size: file.size,
        },
    };
}
