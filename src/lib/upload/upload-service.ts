/**
 * Server-side upload service using Vercel Blob Storage
 */

import { put, del } from "@vercel/blob";
import prisma from "@/lib/prisma";
import {
    getFileCategory,
    validateFile,
    generateBlobPathname,
    type FileCategory,
} from "@/lib/upload/file-types";
import { FileType } from "@/generated/prisma/client";

export interface UploadResult {
    id: string;
    url: string;
    pathname: string;
    filename: string;
    mimeType: string;
    fileType: FileType;
    size: number;
}

/**
 * Convert FileCategory to Prisma FileType enum
 */
function categoryToFileType(category: FileCategory): FileType {
    switch (category) {
        case "IMAGE":
            return FileType.IMAGE;
        case "VIDEO":
            return FileType.VIDEO;
        case "AUDIO":
            return FileType.AUDIO;
        case "DOCUMENT":
            return FileType.DOCUMENT;
    }
}

/**
 * Upload a file to Vercel Blob Storage and create a database record
 * 
 * @param file - The file to upload
 * @param userId - The ID of the user uploading the file
 * @param noteId - Optional note ID to associate the file with
 * @returns The upload result with file metadata
 */
export async function uploadFile(
    file: File,
    userId: string,
    noteId?: string
): Promise<UploadResult> {
    // Validate file
    const validation = validateFile(file);
    if (!validation.isValid) {
        throw new Error(validation.error);
    }

    const category = getFileCategory(file.type);
    const pathname = generateBlobPathname(file.name, userId);

    // Upload to Vercel Blob
    const blob = await put(pathname, file, {
        access: "public",
        addRandomSuffix: false,
    });

    // Create database record
    const attachment = await prisma.mediaAttachment.create({
        data: {
            url: blob.url,
            pathname: blob.pathname,
            filename: file.name,
            mimeType: file.type,
            fileType: categoryToFileType(category),
            size: file.size,
            userId,
            noteId,
        },
    });

    return {
        id: attachment.id,
        url: attachment.url,
        pathname: attachment.pathname,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        fileType: attachment.fileType,
        size: attachment.size,
    };
}

/**
 * Delete a file from Vercel Blob Storage and remove the database record
 * 
 * @param url - The URL of the file to delete
 * @param userId - The ID of the user requesting deletion (for ownership verification)
 */
export async function deleteFile(url: string, userId: string): Promise<void> {
    // Find the attachment and verify ownership
    const attachment = await prisma.mediaAttachment.findUnique({
        where: { url },
    });

    if (!attachment) {
        throw new Error("File not found");
    }

    if (attachment.userId !== userId) {
        throw new Error("You do not have permission to delete this file");
    }

    // Delete from Vercel Blob
    await del(url);

    // Remove database record
    await prisma.mediaAttachment.delete({
        where: { id: attachment.id },
    });
}

/**
 * Get all attachments for a user with optional filtering
 */
export async function getUserAttachments(
    userId: string,
    options?: {
        noteId?: string;
        fileType?: FileType;
        limit?: number;
        offset?: number;
    }
): Promise<UploadResult[]> {
    const attachments = await prisma.mediaAttachment.findMany({
        where: {
            userId,
            ...(options?.noteId && { noteId: options.noteId }),
            ...(options?.fileType && { fileType: options.fileType }),
        },
        orderBy: { createdAt: "desc" },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
    });

    return attachments.map((a) => ({
        id: a.id,
        url: a.url,
        pathname: a.pathname,
        filename: a.filename,
        mimeType: a.mimeType,
        fileType: a.fileType,
        size: a.size,
    }));
}

/**
 * Associate an attachment with a note
 */
export async function linkAttachmentToNote(
    attachmentId: string,
    noteId: string,
    userId: string
): Promise<void> {
    const attachment = await prisma.mediaAttachment.findUnique({
        where: { id: attachmentId },
    });

    if (!attachment) {
        throw new Error("Attachment not found");
    }

    if (attachment.userId !== userId) {
        throw new Error("You do not have permission to modify this attachment");
    }

    await prisma.mediaAttachment.update({
        where: { id: attachmentId },
        data: { noteId },
    });
}
