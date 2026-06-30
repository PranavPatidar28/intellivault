import { PrismaClient, Prisma } from "@/generated/prisma/client";

/**
 * Prisma error codes that indicate a transient connectivity problem rather
 * than a real query/data error. These are exactly the failures we see when a
 * serverless Postgres (Neon) compute instance is cold-starting: the first few
 * requests after the instance has auto-suspended can't reach the server until
 * it finishes resuming.
 *
 * - P1000: authentication failed (can briefly happen while resuming)
 * - P1001: can't reach database server
 * - P1002: database server reached but timed out
 * - P1008: operation timed out
 * - P1017: server has closed the connection
 */
const RETRYABLE_PRISMA_CODES = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1008",
  "P1017",
]);

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 200;
const MAX_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Decide whether an error thrown by Prisma is a transient connectivity error
 * worth retrying. A cold start surfaces either as an initialization error
 * (the client could never open a connection) or as a known request error with
 * one of the connectivity codes above.
 */
function isRetryableDbError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    // errorCode may be undefined; treat all init failures as retryable since
    // they mean we never reached a usable connection.
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_PRISMA_CODES.has(error.code);
  }

  return false;
}

/**
 * Run a DB operation, retrying with exponential backoff (plus jitter) while
 * the failure looks like a cold-start connectivity error. Non-transient errors
 * (constraint violations, bad queries, etc.) are rethrown immediately so we
 * never mask real bugs.
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  label = "db operation"
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableDbError(error) || attempt === MAX_RETRIES) {
        throw error;
      }

      const backoff = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
      const jitter = Math.floor(Math.random() * 100);
      const delay = backoff + jitter;

      console.warn(
        `[prisma] ${label} failed with transient DB error (attempt ${
          attempt + 1
        }/${MAX_RETRIES + 1}), retrying in ${delay}ms`,
        error instanceof Error ? error.message : error
      );

      await sleep(delay);
    }
  }

  // Unreachable in practice, but satisfies the type checker.
  throw lastError;
}

/**
 * Build a PrismaClient whose every model operation is transparently retried on
 * transient connectivity errors. Because better-auth shares this same client
 * instance, its session/account queries get the same cold-start resilience.
 */
function createPrismaClient() {
  return new PrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return withDbRetry(
            () => query(args),
            `${model ?? "raw"}.${operation}`
          );
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = global as unknown as {
  prisma: ExtendedPrismaClient;
};

const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Warm up / health-check the database connection. Issues a trivial `SELECT 1`
 * with the same retry policy as real queries, so calling this when a visitor
 * lands on the site triggers (and waits out) a Neon cold start before the user
 * hits an authenticated route. Returns true on success, false if the database
 * is still unreachable after retries.
 */
export async function pingDatabase(): Promise<boolean> {
  try {
    await withDbRetry(() => prisma.$queryRaw`SELECT 1`, "ping");
    return true;
  } catch (error) {
    console.error(
      "[prisma] database ping failed after retries",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

export default prisma;
