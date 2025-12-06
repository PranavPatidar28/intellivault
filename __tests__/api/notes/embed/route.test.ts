/**
 * Tests for Embedding API
 */
import { GET, POST } from "@/app/api/notes/embed/route";
import { NextRequest } from "next/server";
import "../../../mocks/auth";
import { setAuthenticatedUser, setUnauthenticatedUser } from "../../../mocks/auth";
import { 
  getQueueStatus, 
  processEmbeddingQueue,
  reembedAllNotes 
} from "@/lib/ai/embedding-sync";

// Mock the embedding service
jest.mock("@/lib/ai/embedding-sync", () => ({
  getQueueStatus: jest.fn(),
  processEmbeddingQueue: jest.fn(),
  reembedAllNotes: jest.fn(),
}));

// Mock pinecone health check
jest.mock("@/lib/ai/pinecone-service", () => ({
  checkPineconeHealth: jest.fn().mockResolvedValue({
    configured: true,
    accessible: true,
  }),
}));

// Mock next/headers
jest.mock("next/headers", () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

describe("Embed API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/notes/embed", () => {
    it("should return 401 when user is not authenticated", async () => {
      setUnauthenticatedUser();
      const request = new NextRequest("http://localhost:3000/api/notes/embed");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return queue status", async () => {
      setAuthenticatedUser();
      (getQueueStatus as jest.Mock).mockResolvedValue({
        pending: 5,
        processing: 0,
        ready: 10,
        error: 0,
        total: 15,
      });

      const request = new NextRequest("http://localhost:3000/api/notes/embed");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.queue).toEqual({
        pending: 5,
        processing: 0,
        ready: 10,
        error: 0,
        total: 15,
      });
      expect(getQueueStatus).toHaveBeenCalledWith("test-user-id");
    });
  });

  describe("POST /api/notes/embed", () => {
    it("should return 401 when user is not authenticated", async () => {
      setUnauthenticatedUser();
      const request = new NextRequest("http://localhost:3000/api/notes/embed", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      
      expect(response.status).toBe(401);
    });

    it("should process queue when requested", async () => {
      setAuthenticatedUser();
      (processEmbeddingQueue as jest.Mock).mockResolvedValue({
        processed: 2,
        succeeded: 2,
        failed: 0,
        results: [],
      });

      const request = new NextRequest("http://localhost:3000/api/notes/embed", {
        method: "POST",
        body: JSON.stringify({ processQueue: true, limit: 5 }),
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("Processed 2 notes");
      expect(processEmbeddingQueue).toHaveBeenCalledWith(5, "test-user-id");
    });

    it("should trigger re-embed all when requested", async () => {
      setAuthenticatedUser();
      (reembedAllNotes as jest.Mock).mockResolvedValue(10);

      const request = new NextRequest("http://localhost:3000/api/notes/embed", {
        method: "POST",
        body: JSON.stringify({ reembedAll: true }),
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("Queued 10 notes");
      expect(reembedAllNotes).toHaveBeenCalledWith("test-user-id");
    });
  });
});
