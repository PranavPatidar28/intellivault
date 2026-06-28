import { NextRequest } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NoteStatus } from "@/generated/prisma";
import { processAIDumpStream } from "@/lib/ai/ai-dump-service";
import { createAIDumpSchema } from "@/lib/validations/ai-dump";
import type { AIDumpOptions } from "@/lib/validations/ai-dump";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/ai-dump/stream
 * Stream AI Dump processing results as Server-Sent Events
 */
export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await nextHeaders(),
    });

    if (!session?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const rl = checkRateLimit(session.user.id, RATE_LIMITS.ai.limit, RATE_LIMITS.ai.windowMs);
    if (!rl.success) {
        return new Response(
            JSON.stringify({ error: "Too many requests. Please slow down." }),
            {
                status: 429,
                headers: {
                    "Content-Type": "application/json",
                    "Retry-After": String(rl.retryAfter),
                },
            }
        );
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Validate request
    const parsed = createAIDumpSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(
            JSON.stringify({ error: "Validation failed", details: parsed.error.flatten() }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const { content, source, options, imageData } = parsed.data;
    const originalFilename = null; // Not exposed in current schema

    // Content is optional when an image is provided; the service transcribes
    // the image into text. Guarantee a string for the pipeline.
    const contentText = content ?? "";

    // Create a TransformStream to handle the SSE response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start processing in the background
    (async () => {
        let noteId: string | null = null;
        const finalData: Record<string, unknown> = {};

        try {
            // Send initial status
            await writer.write(
                encoder.encode(`data: ${JSON.stringify({ type: "connected", data: null })}\n\n`)
            );

            // Process with streaming
            const userId = session.user.id!;
            for await (const event of processAIDumpStream(
                contentText,
                userId,
                options as AIDumpOptions,
                imageData
            )) {
                // Store final data for database save
                if (event.type === "titles") {
                    finalData.titles = event.data;
                } else if (event.type === "tags") {
                    finalData.tags = event.data;
                } else if (event.type === "tldr") {
                    finalData.tldr = event.data;
                } else if (event.type === "markdown_end") {
                    finalData.markdown = event.data;
                } else if (event.type === "summary_end") {
                    finalData.summary = event.data;
                } else if (event.type === "actions") {
                    finalData.actions = event.data;
                } else if (event.type === "provenance") {
                    finalData.provenance = event.data;
                } else if (event.type === "resolved_content") {
                    finalData.resolvedContent = event.data;
                }

                // Send event to client
                await writer.write(
                    encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
                );
            }

            // Select first title as default
            const titles = finalData.titles as Array<{ variant: string; text: string; score: number }>;
            const selectedTitle =
                titles?.find((t) => t.variant === "short")?.text ||
                titles?.[0]?.text ||
                "Untitled";

            // Create draft note in database
            const note = await prisma.note.create({
                data: {
                    title: selectedTitle,
                    contentJSON: {},
                    contentText: (finalData.markdown as string) || contentText,
                    status: NoteStatus.DRAFT,
                    rawText: (finalData.resolvedContent as string) || contentText,
                    source: source || "paste",
                    originalFilename: originalFilename || null,
                    titles: finalData.titles as object,
                    summary: (finalData.summary as string) || null,
                    tldr: (finalData.tldr as string) || null,
                    actions: (finalData.actions as object) || [],
                    aiOptions: options as object,
                    provenance: finalData.provenance as object,
                    versions: [],
                    userId: userId,
                    embeddingStatus: "PENDING",
                },
            });

            noteId = note.id;

            // Send final note ID
            await writer.write(
                encoder.encode(
                    `data: ${JSON.stringify({ type: "note_created", data: { noteId: note.id } })}\n\n`
                )
            );

            // Send done event
            await writer.write(
                encoder.encode(`data: ${JSON.stringify({ type: "done", data: null })}\n\n`)
            );
        } catch (error) {
            console.error("Streaming AI Dump error:", error);
            await writer.write(
                encoder.encode(
                    `data: ${JSON.stringify({
                        type: "error",
                        data: error instanceof Error ? error.message : "Unknown error",
                    })}\n\n`
                )
            );
        } finally {
            await writer.close();
        }
    })();

    return new Response(stream.readable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
