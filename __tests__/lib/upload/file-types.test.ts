/**
 * Unit tests for file type validation utilities
 */

import {
    FILE_TYPE_CONFIG,
    getFileCategory,
    isSupportedMimeType,
    getMaxFileSize,
    formatFileSize,
    validateFile,
    getAcceptString,
    getFileExtension,
    generateBlobPathname,
} from "@/lib/upload/file-types";

describe("file-types", () => {
    describe("getFileCategory", () => {
        it("should identify image MIME types", () => {
            expect(getFileCategory("image/jpeg")).toBe("IMAGE");
            expect(getFileCategory("image/png")).toBe("IMAGE");
            expect(getFileCategory("image/gif")).toBe("IMAGE");
            expect(getFileCategory("image/webp")).toBe("IMAGE");
        });

        it("should reject SVG (excluded for XSS safety)", () => {
            expect(isSupportedMimeType("image/svg+xml")).toBe(false);
            expect(() => getFileCategory("image/svg+xml")).toThrow();
        });

        it("should identify video MIME types", () => {
            expect(getFileCategory("video/mp4")).toBe("VIDEO");
            expect(getFileCategory("video/webm")).toBe("VIDEO");
            expect(getFileCategory("video/quicktime")).toBe("VIDEO");
        });

        it("should identify audio MIME types", () => {
            expect(getFileCategory("audio/mpeg")).toBe("AUDIO");
            expect(getFileCategory("audio/wav")).toBe("AUDIO");
            expect(getFileCategory("audio/ogg")).toBe("AUDIO");
            expect(getFileCategory("audio/webm")).toBe("AUDIO");
        });

        it("should identify document MIME types", () => {
            expect(getFileCategory("application/pdf")).toBe("DOCUMENT");
            expect(getFileCategory("application/msword")).toBe("DOCUMENT");
            expect(
                getFileCategory(
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                )
            ).toBe("DOCUMENT");
            expect(getFileCategory("text/plain")).toBe("DOCUMENT");
            expect(getFileCategory("text/markdown")).toBe("DOCUMENT");
        });

        it("should throw for unsupported MIME types", () => {
            expect(() => getFileCategory("application/octet-stream")).toThrow(
                "Unsupported file type"
            );
            expect(() => getFileCategory("application/x-executable")).toThrow(
                "Unsupported file type"
            );
        });
    });

    describe("isSupportedMimeType", () => {
        it("should return true for supported types", () => {
            expect(isSupportedMimeType("image/jpeg")).toBe(true);
            expect(isSupportedMimeType("video/mp4")).toBe(true);
            expect(isSupportedMimeType("audio/mpeg")).toBe(true);
            expect(isSupportedMimeType("application/pdf")).toBe(true);
        });

        it("should return false for unsupported types", () => {
            expect(isSupportedMimeType("application/octet-stream")).toBe(false);
            expect(isSupportedMimeType("application/x-executable")).toBe(false);
            expect(isSupportedMimeType("")).toBe(false);
        });
    });

    describe("getMaxFileSize", () => {
        it("should return correct max size for each category", () => {
            expect(getMaxFileSize("IMAGE")).toBe(5 * 1024 * 1024); // 5MB
            expect(getMaxFileSize("VIDEO")).toBe(20 * 1024 * 1024); // 20MB
            expect(getMaxFileSize("AUDIO")).toBe(20 * 1024 * 1024); // 20MB
            expect(getMaxFileSize("DOCUMENT")).toBe(10 * 1024 * 1024); // 10MB
        });
    });

    describe("formatFileSize", () => {
        it("should format bytes correctly", () => {
            expect(formatFileSize(0)).toBe("0 Bytes");
            expect(formatFileSize(500)).toBe("500 Bytes");
            expect(formatFileSize(1024)).toBe("1 KB");
            expect(formatFileSize(1536)).toBe("1.5 KB");
            expect(formatFileSize(1024 * 1024)).toBe("1 MB");
            expect(formatFileSize(5.5 * 1024 * 1024)).toBe("5.5 MB");
            expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
        });
    });

    describe("validateFile", () => {
        it("should validate a valid image file", () => {
            const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
            Object.defineProperty(file, "size", { value: 1024 * 1024 }); // 1MB
            const result = validateFile(file);
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it("should reject unsupported file types", () => {
            const file = new File(["test"], "test.exe", {
                type: "application/x-executable",
            });
            const result = validateFile(file);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain("not supported");
        });

        it("should reject files exceeding size limit", () => {
            const file = new File(["test"], "large.jpg", { type: "image/jpeg" });
            Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 }); // 10MB > 5MB limit
            const result = validateFile(file);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain("exceeds maximum");
        });

        it("should validate video files within limit", () => {
            const file = new File(["test"], "video.mp4", { type: "video/mp4" });
            Object.defineProperty(file, "size", { value: 5 * 1024 * 1024 }); // 5MB < 10MB limit
            const result = validateFile(file);
            expect(result.isValid).toBe(true);
        });
    });

    describe("getAcceptString", () => {
        it("should return all accept strings when no categories specified", () => {
            const result = getAcceptString();
            expect(result).toContain("image/*");
            expect(result).toContain("video/*");
            expect(result).toContain("audio/*");
            expect(result).toContain(".pdf");
        });

        it("should return only specified categories", () => {
            const result = getAcceptString(["IMAGE", "DOCUMENT"]);
            expect(result).toContain("image/*");
            expect(result).toContain(".pdf");
            expect(result).not.toContain("video/*");
            expect(result).not.toContain("audio/*");
        });
    });

    describe("getFileExtension", () => {
        it("should extract file extensions correctly", () => {
            expect(getFileExtension("test.jpg")).toBe(".jpg");
            expect(getFileExtension("document.PDF")).toBe(".pdf");
            expect(getFileExtension("file.tar.gz")).toBe(".gz");
            expect(getFileExtension("noextension")).toBe("");
        });
    });

    describe("generateBlobPathname", () => {
        it("should generate a unique pathname with user ID", () => {
            const pathname = generateBlobPathname("image.jpg", "user123");
            expect(pathname).toMatch(/^uploads\/user123\/\d+-\w+\.jpg$/);
        });

        it("should preserve file extension", () => {
            const pathname = generateBlobPathname("document.pdf", "user456");
            expect(pathname).toMatch(/\.pdf$/);
        });

        it("should handle files without extension", () => {
            const pathname = generateBlobPathname("noext", "user789");
            expect(pathname).toMatch(/^uploads\/user789\/\d+-\w+$/);
        });
    });

    describe("FILE_TYPE_CONFIG", () => {
        it("should have all required categories", () => {
            expect(FILE_TYPE_CONFIG).toHaveProperty("IMAGE");
            expect(FILE_TYPE_CONFIG).toHaveProperty("VIDEO");
            expect(FILE_TYPE_CONFIG).toHaveProperty("AUDIO");
            expect(FILE_TYPE_CONFIG).toHaveProperty("DOCUMENT");
        });

        it("should have required properties for each category", () => {
            for (const category of Object.values(FILE_TYPE_CONFIG)) {
                expect(category).toHaveProperty("mimeTypes");
                expect(category).toHaveProperty("extensions");
                expect(category).toHaveProperty("maxSize");
                expect(category).toHaveProperty("accept");
                expect(Array.isArray(category.mimeTypes)).toBe(true);
                expect(Array.isArray(category.extensions)).toBe(true);
                expect(typeof category.maxSize).toBe("number");
                expect(typeof category.accept).toBe("string");
            }
        });
    });
});
