/**
 * Pinecone Mock for Testing
 *
 * Provides a mock Pinecone client for unit tests.
 */

// Mock namespace functions
export const mockNamespace = {
  upsertRecords: jest.fn().mockResolvedValue(undefined),
  deleteMany: jest.fn().mockResolvedValue(undefined),
  searchRecords: jest.fn().mockResolvedValue({
    result: {
      hits: [],
    },
    usage: { embed_total_tokens: 0, read_units: 0 },
  }),
};

// Mock index functions
export const mockIndex = {
  namespace: jest.fn().mockReturnValue(mockNamespace),
  describeIndexStats: jest.fn().mockResolvedValue({
    namespaces: {},
    dimension: 1024,
    indexFullness: 0,
    totalRecordCount: 0,
  }),
};

// Mock Pinecone client
export const mockPineconeClient = {
  index: jest.fn().mockReturnValue(mockIndex),
};

// Helper to reset all mocks
export function resetPineconeMocks() {
  mockNamespace.upsertRecords.mockClear();
  mockNamespace.deleteMany.mockClear();
  mockNamespace.searchRecords.mockClear();
  mockIndex.namespace.mockClear();
  mockIndex.describeIndexStats.mockClear();
  mockPineconeClient.index.mockClear();
}

// Mock the Pinecone constructor
jest.mock("@pinecone-database/pinecone", () => ({
  Pinecone: jest.fn().mockImplementation(() => mockPineconeClient),
}));

export default mockPineconeClient;
