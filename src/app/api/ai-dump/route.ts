import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createAIDumpSchema } from "@/lib/validations/ai-dump";
import { processAIDump } from "@/lib/ai/ai-dump-service";
import { NoteStatus } from "@/generated/prisma";
import { errorResponse } from "@/lib/api-error";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/ai-dump
 * Create a new draft note with AI-generated content
 */
export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await nextHeaders(),
    });

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate-limit this expensive endpoint (processAIDump fires several paid LLM
    // calls) per user to prevent cost/DoS abuse.
    const limited = enforceRateLimit(session.user.id, RATE_LIMITS.ai);
    if (limited) return limited;

    try {
        const json = await request.json();
        const result = createAIDumpSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.issues },
                { status: 400 }
            );
        }

        const { content, source, options, metadata } = result.data;

        // Validate content is provided
        if (!content) {
            return NextResponse.json(
                { error: "Content is required" },
                { status: 400 }
            );
        }

        // Process content through AI pipeline
        const aiResult = await processAIDump(content, session.user.id, options);

        // Select first title as default
        const selectedTitle =
            aiResult.titles.find((t) => t.variant === "short")?.text ||
            aiResult.titles[0]?.text ||
            "Untitled";

        // Create draft note with AI-generated content
        const note = await prisma.note.create({
            data: {
                title: selectedTitle,
                contentJSON: {}, // Will be populated when user edits
                contentText: aiResult.markdown,
                status: NoteStatus.DRAFT,

                // AI Dump specific fields
                rawText: content,
                source: source,
                originalFilename: metadata?.originalFilename ?? null,

                // Generated content
                titles: aiResult.titles,
                summary: aiResult.summary,
                tldr: aiResult.tldr,
                actions: aiResult.actions,

                // Processing metadata
                aiOptions: options,
                provenance: aiResult.provenance,
                versions: [],

                // User relation
                userId: session.user.id,
                embeddingStatus: "PENDING",
            },
        });

        // Trigger embedding in background
        import("@/lib/ai/embedding-sync").then(({ embedNote }) => {
            embedNote(note.id, { userId: session.user.id }).catch((err: unknown) =>
                console.error(`Failed to embed AI Dump note ${note.id}:`, err)
            );
        });

        return NextResponse.json({
            success: true,
            noteId: note.id,
            generated: {
                titles: aiResult.titles,
                tags: aiResult.tags,
                tldr: aiResult.tldr,
                summary: aiResult.summary,
                markdown: aiResult.markdown,
                actions: aiResult.actions,
                provenance: aiResult.provenance,
            },
            warnings: [],
            errors: [],
        });
    } catch (error) {
        console.error("Error processing AI Dump:", error);
        return errorResponse("Failed to process AI Dump", 500, error);
    }
}

/**
 * GET /api/ai-dump
 * List user's draft notes
 */
export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await nextHeaders(),
    });

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") ?? "1", 10);
        const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 50);
        const skip = (page - 1) * limit;

        // Opportunistic cleanup: purge this user's abandoned drafts older than
        // the retention window. Drafts are created on every AI Dump run, so
        // without this they accumulate forever. Best-effort — a failure here
        // must not block listing.
        const DRAFT_TTL_DAYS = 7;
        const cutoff = new Date(Date.now() - DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000);
        try {
            await prisma.note.deleteMany({
                where: {
                    userId: session.user.id,
                    status: NoteStatus.DRAFT,
                    updatedAt: { lt: cutoff },
                },
            });
        } catch (cleanupError) {
            console.error("Draft cleanup failed (non-fatal):", cleanupError);
        }

        const [notes, total] = await Promise.all([
            prisma.note.findMany({
                where: {
                    userId: session.user.id,
                    status: NoteStatus.DRAFT,
                },
                orderBy: {
                    updatedAt: "desc",
                },
                skip,
                take: limit,
                select: {
                    id: true,
                    title: true,
                    tldr: true,
                    source: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            prisma.note.count({
                where: {
                    userId: session.user.id,
                    status: NoteStatus.DRAFT,
                },
            }),
        ]);

        return NextResponse.json({
            success: true,
            notes,
            metadata: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching AI Dumps:", error);
        return NextResponse.json(
            { error: "Failed to fetch AI Dumps" },
            { status: 500 }
        );
    }
}
