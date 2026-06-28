/**
 * Streaming Summarization API Route
 *
 * POST /api/notes/summarize/stream - Stream summary generation for a note
 */

import { NextRequest } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { generateSummaryStream, generateContentHash, type SummarizationOptions } from "@/lib/ai/summarization-service";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// Request validation schema
const streamRequestSchema = z.object({
    noteId: z.string().min(1, "Note ID is required"),
    options: z
        .object({
            length: z.enum(["short", "medium", "long"]).optional(),
            style: z.enum(["bullet", "paragraph", "tldr"]).optional(),
        })
        .optional(),
});

/**
 * POST /api/notes/summarize/stream
 *
 * Stream summary generation - returns chunks as Server-Sent Events
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

    try {
        const body = await request.json();
        const result = streamRequestSchema.safeParse(body);

        if (!result.success) {
            return new Response(
                JSON.stringify({ error: "Validation failed", details: result.error.issues }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const { noteId, options = {} } = result.data;

        // Fetch the note
        const note = await prisma.note.findUnique({
            where: { id: noteId, userId: session.user.id },
            select: {
                id: true,
                title: true,
                contentText: true,
            },
        });

        if (!note) {
            return new Response(JSON.stringify({ error: "Note not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Create streaming response
        const fullContent = `Title: ${note.title}\n\n${note.contentText}`;
        const contentHash = generateContentHash(note.contentText);

        // Create a TransformStream to encode the response
        const encoder = new TextEncoder();
        let fullSummary = "";

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Stream the summary chunks
                    for await (const chunk of generateSummaryStream(fullContent, options as SummarizationOptions)) {
                        fullSummary += chunk;
                        // Send as SSE format
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
                    }

                    // Send completion event with metadata
                    controller.enqueue(
                        encoder.encode(
                            `data: ${JSON.stringify({ done: true, contentHash })}\n\n`
                        )
                    );

                    // Save the summary to the database after streaming completes
                    await prisma.note.update({
                        where: { id: noteId },
                        data: {
                            summary: fullSummary,
                            contentHash,
                            aiProcessedAt: new Date(),
                        },
                    });

                    controller.close();
                } catch (error) {
                    console.error("Streaming error:", error);
                    controller.enqueue(
                        encoder.encode(
                            `data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Streaming failed" })}\n\n`
                        )
                    );
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        });
    } catch (error) {
        console.error("Error in streaming route:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Failed to start streaming" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
