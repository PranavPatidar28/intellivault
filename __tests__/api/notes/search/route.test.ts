/**
 * Tests for Semantic Search API
 */
import { GET } from "@/app/api/notes/search/route";
import { NextRequest } from "next/server";
import "../../../mocks/auth";
import { setAuthenticatedUser, setUnauthenticatedUser } from "../../../mocks/auth";
import { searchNotes } from "@/lib/ai/pinecone-service";

// Mock the pinecone service
jest.mock("@/lib/ai/pinecone-service", () => ({
  searchNotes: jest.fn(),
}));

// Mock next/headers
jest.mock("next/headers", () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

describe("Search API - GET /api/notes/search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 when user is not authenticated", async () => {
    setUnauthenticatedUser();
    const request = new NextRequest("http://localhost:3000/api/notes/search?q=test");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 when query is missing", async () => {
    setAuthenticatedUser();
    const request = new NextRequest("http://localhost:3000/api/notes/search");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Validation failed");
  });

  it("should return 400 when query is empty", async () => {
    setAuthenticatedUser();
    const request = new NextRequest("http://localhost:3000/api/notes/search?q=");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Validation failed");
  });

  it("should search notes and return results", async () => {
    setAuthenticatedUser();
    
    const mockResults = [
      {
        id: "note1",
        title: "Test Note",
        score: 0.9,
        preview: "Preview text",
        tags: [],
        updatedAt: new Date().toISOString(),
      }
    ];

    (searchNotes as jest.Mock).mockResolvedValue(mockResults);

    const request = new NextRequest("http://localhost:3000/api/notes/search?q=machine+learning");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results).toEqual(mockResults);
    expect(searchNotes).toHaveBeenCalledWith("test-user-id", "machine learning", 10);
  });

  it("should handle custom limit", async () => {
    setAuthenticatedUser();
    (searchNotes as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest("http://localhost:3000/api/notes/search?q=test&limit=5");
    await GET(request);

    expect(searchNotes).toHaveBeenCalledWith("test-user-id", "test", 5);
  });

  it("should handle service errors", async () => {
    setAuthenticatedUser();
    (searchNotes as jest.Mock).mockRejectedValue(new Error("Pinecone error"));

    const request = new NextRequest("http://localhost:3000/api/notes/search?q=test");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to perform search");
  });
});
