/**
 * Tests for Embedding Sync Service
 *
 * Tests the orchestration between Prisma and Pinecone.
 * Uses inline mocks to avoid hoisting issues.
 */

describe("Embedding Sync Service", () => {
  // Define mocks inline
  const mockNote = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  };

  const mockNamespace = {
    upsertRecords: jest.fn(),
    deleteMany: jest.fn(),
    searchRecords: jest.fn(),
  };

  const mockIndex = {
    namespace: jest.fn(() => mockNamespace),
    describeIndexStats: jest.fn(),
  };

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let embedNote: typeof import("@/lib/ai/embedding-sync").embedNote;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let processEmbeddingQueue: typeof import("@/lib/ai/embedding-sync").processEmbeddingQueue;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let markNoteForReembedding: typeof import("@/lib/ai/embedding-sync").markNoteForReembedding;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let getQueueStatus: typeof import("@/lib/ai/embedding-sync").getQueueStatus;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let reembedAllNotes: typeof import("@/lib/ai/embedding-sync").reembedAllNotes;

  beforeAll(() => {
    // Setup all mocks before requiring the module
    jest.doMock("@/env", () => ({
      env: {
        PINECONE_API_KEY: "test-api-key",
        PINECONE_INDEX_HOST: "https://test-index.pinecone.io",
      },
    }));

    jest.doMock("@/lib/prisma", () => ({
      __esModule: true,
      default: { note: mockNote },
    }));

    jest.doMock("@pinecone-database/pinecone", () => ({
      Pinecone: jest.fn(() => ({
        index: jest.fn(() => mockIndex),
      })),
    }));

    jest.doMock("@/generated/prisma/client", () => ({
      EmbeddingStatus: {
        PENDING: "PENDING",
        PROCESSING: "PROCESSING",
        READY: "READY",
        ERROR: "ERROR",
        DELETED: "DELETED",
      },
    }));

    // Now require the module
    const embeddingSync = require("@/lib/ai/embedding-sync");
    embedNote = embeddingSync.embedNote;
    processEmbeddingQueue = embeddingSync.processEmbeddingQueue;
    markNoteForReembedding = embeddingSync.markNoteForReembedding;
    getQueueStatus = embeddingSync.getQueueStatus;
    reembedAllNotes = embeddingSync.reembedAllNotes;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockNamespace.upsertRecords.mockResolvedValue(undefined);
    mockNamespace.deleteMany.mockResolvedValue(undefined);
  });

  describe("embedNote", () => {
    const testNote = {
      id: "note123",
      userId: "user456",
      title: "Test Note",
      contentText: "This is the content of the test note that will be embedded.",
      embeddingStatus: "PENDING",
      chunkCount: null,
      tags: [{ name: "tag1" }, { name: "tag2" }],
    };

    it("should embed a note successfully", async () => {
      mockNote.findFirst.mockResolvedValueOnce(testNote);
      mockNote.updateMany.mockResolvedValueOnce({ count: 1 }); // claim
      mockNote.update.mockResolvedValue({
        ...testNote,
        embeddingStatus: "READY",
      });

      const result = await embedNote("note123");

      expect(result.status).toBe("success");
      expect(result.noteId).toBe("note123");
      expect(result.chunkCount).toBeGreaterThanOrEqual(1);

      // Should atomically claim the note by transitioning it to PROCESSING
      expect(mockNote.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "note123",
            embeddingStatus: { not: "PROCESSING" },
          }),
          data: { embeddingStatus: "PROCESSING" },
        })
      );
    });

    it("should enforce ownership when userId is provided", async () => {
      mockNote.findFirst.mockResolvedValueOnce(null);

      const result = await embedNote("note123", { userId: "other-user" });

      expect(result.status).toBe("error");
      expect(result.error).toBe("Note not found");
      expect(mockNote.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "note123",
            userId: "other-user",
          }),
        })
      );
    });

    it("should return error if note not found", async () => {
      mockNote.findFirst.mockResolvedValueOnce(null);

      const result = await embedNote("nonexistent");

      expect(result.status).toBe("error");
      expect(result.error).toBe("Note not found");
    });

    it("should skip if note is already being processed", async () => {
      mockNote.findFirst.mockResolvedValueOnce({
        ...testNote,
        embeddingStatus: "PROCESSING",
      });
      mockNote.updateMany.mockResolvedValueOnce({ count: 0 }); // claim fails

      const result = await embedNote("note123");

      expect(result.status).toBe("skipped");
      expect(result.error).toContain("already being processed");
    });

    it("should delete existing vectors before re-embedding", async () => {
      mockNote.findFirst.mockResolvedValueOnce({
        ...testNote,
        chunkCount: 3,
      });
      mockNote.updateMany.mockResolvedValueOnce({ count: 1 }); // claim
      mockNote.update.mockResolvedValue(testNote);

      await embedNote("note123");

      // Should delete old chunks
      expect(mockNamespace.deleteMany).toHaveBeenCalledWith([
        "note123_chunk_0",
        "note123_chunk_1",
        "note123_chunk_2",
      ]);
    });

    it("should mark note as ERROR on failure", async () => {
      mockNote.findFirst.mockResolvedValueOnce(testNote);
      mockNote.updateMany.mockResolvedValueOnce({ count: 1 }); // claim
      mockNote.update.mockResolvedValue(testNote);
      mockNamespace.upsertRecords.mockRejectedValueOnce(new Error("Pinecone failed"));

      const result = await embedNote("note123");

      expect(result.status).toBe("error");
      expect(mockNote.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            embeddingStatus: "ERROR",
          }),
        })
      );
    });
  });

  describe("processEmbeddingQueue", () => {
    it("should process pending notes", async () => {
      mockNote.findMany.mockResolvedValueOnce([
        { id: "note1", userId: "user1", embeddingStatus: "PENDING" },
        { id: "note2", userId: "user1", embeddingStatus: "PENDING" },
      ]);

      // Mock embedNote's findFirst + claim for each note
      mockNote.findFirst
        .mockResolvedValueOnce({
          id: "note1",
          userId: "user1",
          title: "Note 1",
          contentText: "Content 1",
          embeddingStatus: "PENDING",
          chunkCount: null,
          tags: [],
        })
        .mockResolvedValueOnce({
          id: "note2",
          userId: "user1",
          title: "Note 2",
          contentText: "Content 2",
          embeddingStatus: "PENDING",
          chunkCount: null,
          tags: [],
        });

      mockNote.updateMany.mockResolvedValue({ count: 1 });
      mockNote.update.mockResolvedValue({});

      const result = await processEmbeddingQueue(10, "user1");

      expect(result.processed).toBe(2);
      expect(result.results).toHaveLength(2);
    });

    it("should respect limit parameter", async () => {
      mockNote.findMany.mockResolvedValueOnce([
        { id: "note1", userId: "user1", embeddingStatus: "PENDING" },
      ]);
      mockNote.findFirst.mockResolvedValueOnce({
        id: "note1",
        userId: "user1",
        title: "Note 1",
        contentText: "Content",
        embeddingStatus: "PENDING",
        chunkCount: null,
        tags: [],
      });
      mockNote.updateMany.mockResolvedValue({ count: 1 });
      mockNote.update.mockResolvedValue({});

      await processEmbeddingQueue(1);

      expect(mockNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
        })
      );
    });

    it("should filter by user ID if provided", async () => {
      mockNote.findMany.mockResolvedValueOnce([]);

      await processEmbeddingQueue(10, "specific-user");

      expect(mockNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({ userId: "specific-user" }),
            ]),
          }),
        })
      );
    });
  });

  describe("markNoteForReembedding", () => {
    it("should update note status to PENDING", async () => {
      mockNote.update.mockResolvedValueOnce({});

      await markNoteForReembedding("note123");

      expect(mockNote.update).toHaveBeenCalledWith({
        where: { id: "note123" },
        data: { embeddingStatus: "PENDING" },
      });
    });
  });

  describe("getQueueStatus", () => {
    it("should return counts for all statuses", async () => {
      mockNote.count
        .mockResolvedValueOnce(5)  // pending
        .mockResolvedValueOnce(1)  // processing
        .mockResolvedValueOnce(20) // ready
        .mockResolvedValueOnce(2)  // error
        .mockResolvedValueOnce(28); // total

      const status = await getQueueStatus();

      expect(status).toEqual({
        pending: 5,
        processing: 1,
        ready: 20,
        error: 2,
        total: 28,
      });
    });

    it("should filter by user ID if provided", async () => {
      mockNote.count.mockResolvedValue(0);

      await getQueueStatus("user123");

      expect(mockNote.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user123",
          }),
        })
      );
    });
  });

  describe("reembedAllNotes", () => {
    it("should mark all user notes as PENDING", async () => {
      mockNote.updateMany.mockResolvedValueOnce({ count: 15 });

      const count = await reembedAllNotes("user123");

      expect(count).toBe(15);
      expect(mockNote.updateMany).toHaveBeenCalledWith({
        where: { userId: "user123" },
        data: { embeddingStatus: "PENDING" },
      });
    });
  });
});
