import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";
import { z } from "zod";
import { slugify } from "@/lib/utils/text";

const importSchema = z.object({
  data: z.string(),
  format: z.enum(["json", "csv"]),
  strategy: z.enum(["merge", "replace", "skip"]).default("merge"),
});

interface ImportTag {
  name: string;
  color?: string | null;
  description?: string | null;
  parentName?: string | null;
  isFavorite?: boolean;
  isArchived?: boolean;
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { data, format, strategy } = importSchema.parse(body);

    let tagsToImport: ImportTag[] = [];

    if (format === "json") {
      tagsToImport = JSON.parse(data);
    } else {
      // Parse CSV
      const lines = data.split("\n");
      const headers = lines[0].split(",").map((h) => h.trim());

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
        const tag: ImportTag = {
          name: values[0],
          color: values[2] || null,
          description: values[3] || null,
          parentName: values[4] || null,
          isFavorite: values[5] === "true",
          isArchived: values[6] === "true",
        };
        tagsToImport.push(tag);
      }
    }

    const imported: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const tagData of tagsToImport) {
      try {
        // Check if tag exists
        const existingTag = await prisma.tag.findUnique({
          where: { slug: slugify(tagData.name) },
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
            // Delete and recreate
            await prisma.tag.delete({ where: { id: existingTag.id } });
            await prisma.tag.create({
              data: {
                name: tagData.name,
                slug: slugify(tagData.name),
                color: tagData.color,
                description: tagData.description,
                isFavorite: tagData.isFavorite || false,
                isArchived: tagData.isArchived || false,
              },
            });
            imported.push(tagData.name);
          }
        } else {
          // Create new tag
          await prisma.tag.create({
            data: {
              name: tagData.name,
              slug: slugify(tagData.name),
              color: tagData.color,
              description: tagData.description,
              isFavorite: tagData.isFavorite || false,
              isArchived: tagData.isArchived || false,
            },
          });
          imported.push(tagData.name);
        }
      } catch (error) {
        errors.push(`Failed to import "${tagData.name}": ${error}`);
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
