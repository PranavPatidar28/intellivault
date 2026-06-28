import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";
import { z } from "zod";
import { slugify } from "@/lib/utils/text";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// Bound the raw payload and the number of tags so a single request cannot
// trigger tens of thousands of serial DB round-trips and exhaust the shared
// connection pool.
const MAX_IMPORT_BYTES = 1_000_000; // 1 MB of import data
const MAX_IMPORT_TAGS = 1000;
const MAX_TAGS_PER_USER = 5000;

const importSchema = z.object({
  data: z.string().min(1).max(MAX_IMPORT_BYTES),
  format: z.enum(["json", "csv"]),
  strategy: z.enum(["merge", "replace", "skip"]).default("merge"),
});

const importTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().max(50).nullish(),
  description: z.string().max(500).nullish(),
  parentName: z.string().max(100).nullish(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

type ImportTag = z.infer<typeof importTagSchema>;

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = enforceRateLimit(session.user.id, RATE_LIMITS.bulk);
  if (limited) return limited;

  try {
    const body = await request.json();
    const parsed = importSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { data, format, strategy } = parsed.data;

    // Build the raw tag list from the requested format.
    let rawTags: unknown[] = [];

    if (format === "json") {
      let json: unknown;
      try {
        json = JSON.parse(data);
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON in import data" },
          { status: 400 }
        );
      }
      if (!Array.isArray(json)) {
        return NextResponse.json(
          { error: "Import data must be a JSON array of tags" },
          { status: 400 }
        );
      }
      rawTags = json;
    } else {
      // Parse CSV
      const lines = data.split("\n");
      for (let i = 1; i < lines.length; i++) {
        const line = (lines[i] ?? "").trim();
        if (!line) continue;

        const values = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
        rawTags.push({
          name: values[0],
          color: values[2] || null,
          description: values[3] || null,
          parentName: values[4] || null,
          isFavorite: values[5] === "true",
          isArchived: values[6] === "true",
        });
      }
    }

    if (rawTags.length === 0) {
      return NextResponse.json(
        { error: "No tags found in import data" },
        { status: 400 }
      );
    }

    if (rawTags.length > MAX_IMPORT_TAGS) {
      return NextResponse.json(
        { error: `Too many tags. Maximum ${MAX_IMPORT_TAGS} per import.` },
        { status: 400 }
      );
    }

    // Validate every item's shape before touching the database.
    const validation = z.array(importTagSchema).safeParse(rawTags);
    if (!validation.success) {
      return NextResponse.json(
        { error: "One or more tags are invalid", details: validation.error.issues },
        { status: 400 }
      );
    }
    const tagsToImport: ImportTag[] = validation.data;

    // Enforce a per-user tag quota.
    const existingCount = await prisma.tag.count({
      where: { userId: session.user.id, deletedAt: null },
    });
    if (existingCount + tagsToImport.length > MAX_TAGS_PER_USER) {
      return NextResponse.json(
        { error: `Import would exceed the maximum of ${MAX_TAGS_PER_USER} tags.` },
        { status: 400 }
      );
    }

    const imported: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const tagData of tagsToImport) {
      const slug = slugify(tagData.name);
      try {
        // Check if tag exists for this user
        const existingTag = await prisma.tag.findUnique({
          where: {
            userId_slug: {
              userId: session.user.id,
              slug,
            },
          },
        });

        if (existingTag) {
          if (strategy === "skip") {
            skipped.push(tagData.name);
            continue;
          } else if (strategy === "merge") {
            // Update existing tag
            await prisma.tag.update({
              where: { id: existingTag.id },
              data: {
                color: tagData.color,
                description: tagData.description,
                isFavorite: tagData.isFavorite,
                isArchived: tagData.isArchived,
              },
            });
            imported.push(tagData.name);
          } else if (strategy === "replace") {
            // Atomically delete and recreate so a failure can't lose the tag.
            await prisma.$transaction([
              prisma.tag.delete({ where: { id: existingTag.id } }),
              prisma.tag.create({
                data: {
                  name: tagData.name,
                  slug,
                  color: tagData.color,
                  description: tagData.description,
                  isFavorite: tagData.isFavorite || false,
                  isArchived: tagData.isArchived || false,
                  userId: session.user.id,
                },
              }),
            ]);
            imported.push(tagData.name);
          }
        } else {
          // Create new tag
          await prisma.tag.create({
            data: {
              name: tagData.name,
              slug,
              color: tagData.color,
              description: tagData.description,
              isFavorite: tagData.isFavorite || false,
              isArchived: tagData.isArchived || false,
              userId: session.user.id,
            },
          });
          imported.push(tagData.name);
        }
      } catch (error) {
        console.error(`Failed to import tag "${tagData.name}":`, error);
        errors.push(`Failed to import "${tagData.name}"`);
      }
    }

    return NextResponse.json({
      success: true,
      imported: imported.length,
      skipped: skipped.length,
      errors,
    });
  } catch (error) {
    console.error("Error importing tags:", error);
    return NextResponse.json(
      { error: "Failed to import tags" },
      { status: 500 }
    );
  }
}
