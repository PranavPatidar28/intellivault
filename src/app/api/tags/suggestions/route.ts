import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";
import { z } from "zod";

const suggestionsSchema = z.object({
  content: z.string().min(1, "Content is required"),
  maxSuggestions: z.number().min(1).max(10).default(5),
});

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { content, maxSuggestions } = suggestionsSchema.parse(body);

    // Get existing tags to suggest from
    const existingTags = await prisma.tag.findMany({
      where: { deletedAt: null, isArchived: false },
      select: { name: true, usageCount: true },
      take: 100,
    });

    // Simple keyword matching + AI suggestion via Ollama
    const suggestions: Array<{
      name: string;
      confidence: number;
      reason: string;
      existingTag: boolean;
    }> = [];

    // Try to call Ollama for AI-powered suggestions
    try {
      const ollamaResponse = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama2",
          prompt: `Given the following note content, suggest up to ${maxSuggestions} relevant tags. Tags should be single words or short phrases that categorize the content. Existing tags in the system: ${existingTags.map((t) => t.name).join(", ")}. 

Content:
${content}

Provide suggestions as a JSON array of objects with 'name' (tag name), 'confidence' (0-1), and 'reason' (why this tag fits). Prefer existing tags when applicable.`,
          stream: false,
        }),
      });

      if (ollamaResponse.ok) {
        const aiResult = await ollamaResponse.json();
        const aiText = aiResult.response;

        // Try to extract JSON from AI response
        const jsonMatch = aiText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const aiSuggestions = JSON.parse(jsonMatch[0]);

          for (const suggestion of aiSuggestions.slice(0, maxSuggestions)) {
            const existingTag = existingTags.find(
              (t) => t.name.toLowerCase() === suggestion.name.toLowerCase()
            );

            suggestions.push({
              name: suggestion.name,
              confidence: suggestion.confidence || 0.7,
              reason: suggestion.reason || "AI suggested tag",
              existingTag: !!existingTag,
            });
          }
        }
      }
    } catch (ollamaError) {
      console.log("Ollama not available, using fallback:", ollamaError);
    }

    // Fallback: simple keyword matching if AI fails or returns no results
    if (suggestions.length === 0) {
      const words = content
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3);

      const wordCounts: Record<string, number> = {};
      words.forEach((word) => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });

      // Match with existing tags
      for (const tag of existingTags) {
        const tagWords = tag.name.toLowerCase().split(/\s+/);
        let matchCount = 0;

        for (const tagWord of tagWords) {
          if (wordCounts[tagWord]) {
            matchCount += wordCounts[tagWord];
          }
        }

        if (matchCount > 0) {
          suggestions.push({
            name: tag.name,
            confidence: Math.min(matchCount / 5, 0.9),
            reason: `Appears ${matchCount} time(s) in content`,
            existingTag: true,
          });
        }
      }

      // Sort by confidence and limit
      suggestions.sort((a, b) => b.confidence - a.confidence);
      suggestions.splice(maxSuggestions);
    }

    // Get related tags based on co-occurrence
    const relatedTags = existingTags
      .filter((t) => !suggestions.find((s) => s.name === t.name))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      suggestions,
      relatedTags: relatedTags.map((t) => ({ name: t.name })),
    });
  } catch (error) {
    console.error("Error generating tag suggestions:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
