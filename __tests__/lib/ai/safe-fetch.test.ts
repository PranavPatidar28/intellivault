/**
 * Tests for safe-fetch.ts (SSRF-safe remote fetch helpers).
 *
 * Covers the pure IP-classification logic exhaustively, the data: URL decode
 * path (no network), and the network path (mocked DNS + fetch) including
 * redirect refusal, content-type enforcement, and byte-cap enforcement.
 */

import { lookup } from "node:dns/promises";
import {
  isBlockedIp,
  safeFetchImage,
  SafeFetchError,
} from "@/lib/ai/safe-fetch";

jest.mock("node:dns/promises", () => ({
  lookup: jest.fn(),
}));

const mockedLookup = lookup as unknown as jest.Mock;

// Build a minimal Response-like object that safeFetchImage consumes:
// .status, .ok, .headers.get(), .body.getReader().
function makeResponse(opts: {
  status?: number;
  headers?: Record<string, string>;
  chunks?: Uint8Array[];
  noBody?: boolean;
}) {
  const status = opts.status ?? 200;
  const headers = new Map(
    Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])
  );
  const chunks = opts.chunks ?? [];
  let i = 0;
  const reader = {
    read: jest.fn(async () => {
      if (i < chunks.length) return { done: false, value: chunks[i++] };
      return { done: true, value: undefined };
    }),
    cancel: jest.fn(async () => {}),
  };
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    body: opts.noBody ? null : { getReader: () => reader },
  };
}

describe("isBlockedIp", () => {
  describe("IPv4 blocked ranges", () => {
    it.each([
      ["0.0.0.0", "this-host"],
      ["10.1.2.3", "private 10/8"],
      ["127.0.0.1", "loopback"],
      ["169.254.169.254", "link-local metadata"],
      ["172.16.0.1", "private 172.16/12 low"],
      ["172.31.255.255", "private 172.16/12 high"],
      ["192.168.1.1", "private 192.168/16"],
      ["100.64.0.1", "CGNAT low"],
      ["100.127.255.255", "CGNAT high"],
      ["224.0.0.1", "multicast"],
      ["240.0.0.1", "reserved"],
    ])("blocks %s (%s)", (ip) => {
      expect(isBlockedIp(ip)).toBe(true);
    });

    it.each([
      "8.8.8.8",
      "1.1.1.1",
      "172.15.0.1", // just below private range
      "172.32.0.1", // just above private range
      "192.167.0.1",
      "100.63.255.255", // just below CGNAT
      "100.128.0.1", // just above CGNAT
      "11.0.0.1",
    ])("allows public address %s", (ip) => {
      expect(isBlockedIp(ip)).toBe(false);
    });
  });

  describe("IPv6 blocked ranges", () => {
    it.each([
      ["::1", "loopback"],
      ["::", "unspecified"],
      ["fc00::1", "unique-local fc00::/7"],
      ["fd12:3456::1", "unique-local fd"],
      ["fe80::1", "link-local"],
      ["::ffff:127.0.0.1", "v4-mapped loopback"],
      ["::ffff:10.0.0.1", "v4-mapped private"],
    ])("blocks %s (%s)", (ip) => {
      expect(isBlockedIp(ip)).toBe(true);
    });

    it.each([["2001:4860:4860::8888"], ["::ffff:8.8.8.8"]])(
      "allows public IPv6 %s",
      (ip) => {
        expect(isBlockedIp(ip)).toBe(false);
      }
    );

    it("strips zone id before classifying", () => {
      expect(isBlockedIp("fe80::1%eth0")).toBe(true);
    });
  });

  it("blocks anything that is not a valid IP literal", () => {
    expect(isBlockedIp("not-an-ip")).toBe(true);
    expect(isBlockedIp("example.com")).toBe(true);
    expect(isBlockedIp("")).toBe(true);
  });
});

describe("safeFetchImage - data URLs", () => {
  beforeEach(() => jest.clearAllMocks());

  it("decodes a base64 image data URL without touching the network", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const url = `data:image/png;base64,${png.toString("base64")}`;
    const res = await safeFetchImage(url);
    expect(res.mimeType).toBe("image/png");
    expect(res.buffer.equals(png)).toBe(true);
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it("decodes a non-base64 (url-encoded) image data URL", async () => {
    const url = `data:image/svg+xml,${encodeURIComponent("<svg/>")}`;
    const res = await safeFetchImage(url);
    expect(res.mimeType).toBe("image/svg+xml");
    expect(res.buffer.toString("utf-8")).toBe("<svg/>");
  });

  it("rejects a malformed data URL", async () => {
    await expect(safeFetchImage("data:")).rejects.toThrow(SafeFetchError);
  });

  it("rejects a non-image data URL", async () => {
    const url = `data:text/plain;base64,${Buffer.from("hi").toString("base64")}`;
    await expect(safeFetchImage(url)).rejects.toThrow("data URL is not an image");
  });

  it("rejects a data URL whose decoded bytes exceed maxBytes", async () => {
    const big = Buffer.alloc(100).toString("base64");
    await expect(
      safeFetchImage(`data:image/png;base64,${big}`, { maxBytes: 10 })
    ).rejects.toThrow("Image too large");
  });
});

describe("safeFetchImage - URL validation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects an unparseable URL", async () => {
    await expect(safeFetchImage("http://")).rejects.toThrow(SafeFetchError);
  });

  it("rejects a non-http(s) protocol", async () => {
    await expect(safeFetchImage("ftp://example.com/x.png")).rejects.toThrow(
      /Unsupported protocol/
    );
  });

  it("rejects an IP-literal host in a blocked range", async () => {
    await expect(
      safeFetchImage("http://169.254.169.254/latest/meta-data")
    ).rejects.toThrow("Blocked address");
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it("allows an IP-literal host that is public (then proceeds to fetch)", async () => {
    const fetchMock = jest.fn(async () =>
      makeResponse({
        headers: { "content-type": "image/png" },
        chunks: [new Uint8Array([1, 2, 3])],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await safeFetchImage("http://8.8.8.8/x.png");
    expect(res.mimeType).toBe("image/png");
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it("blocks when DNS resolves to a private address", async () => {
    mockedLookup.mockResolvedValue([{ address: "10.0.0.5" }]);
    await expect(safeFetchImage("http://evil.example/x.png")).rejects.toThrow(
      "Blocked address"
    );
  });

  it("treats a DNS lookup failure as resolution failure", async () => {
    mockedLookup.mockRejectedValue(new Error("nope"));
    await expect(safeFetchImage("http://evil.example/x.png")).rejects.toThrow(
      "DNS resolution failed"
    );
  });

  it("treats an empty DNS result as resolution failure", async () => {
    mockedLookup.mockResolvedValue([]);
    await expect(safeFetchImage("http://evil.example/x.png")).rejects.toThrow(
      "DNS resolution failed"
    );
  });
});

describe("safeFetchImage - network response handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLookup.mockResolvedValue([{ address: "93.184.216.34" }]);
  });

  it("returns buffer + mimeType on a successful image response", async () => {
    global.fetch = jest.fn(async () =>
      makeResponse({
        headers: { "content-type": "image/jpeg; charset=binary" },
        chunks: [new Uint8Array([1, 2]), new Uint8Array([3, 4])],
      })
    ) as unknown as typeof fetch;

    const res = await safeFetchImage("http://example.com/x.jpg");
    expect(res.mimeType).toBe("image/jpeg");
    expect(Array.from(res.buffer)).toEqual([1, 2, 3, 4]);
  });

  it("refuses to follow a 3xx redirect", async () => {
    global.fetch = jest.fn(async () =>
      makeResponse({ status: 302, headers: { location: "http://10.0.0.1" } })
    ) as unknown as typeof fetch;

    await expect(safeFetchImage("http://example.com/x.png")).rejects.toThrow(
      "Refusing to follow redirect"
    );
  });

  it("throws on a non-ok upstream status", async () => {
    global.fetch = jest.fn(async () =>
      makeResponse({ status: 404 })
    ) as unknown as typeof fetch;

    await expect(safeFetchImage("http://example.com/x.png")).rejects.toThrow(
      "Upstream returned 404"
    );
  });

  it("rejects a non-image content-type", async () => {
    global.fetch = jest.fn(async () =>
      makeResponse({ headers: { "content-type": "text/html" } })
    ) as unknown as typeof fetch;

    await expect(safeFetchImage("http://example.com/x.png")).rejects.toThrow(
      "Response is not an image"
    );
  });

  it("rejects when declared content-length exceeds maxBytes", async () => {
    global.fetch = jest.fn(async () =>
      makeResponse({
        headers: { "content-type": "image/png", "content-length": "999999" },
      })
    ) as unknown as typeof fetch;

    await expect(
      safeFetchImage("http://example.com/x.png", { maxBytes: 10 })
    ).rejects.toThrow("Image too large");
  });

  it("rejects when streamed bytes exceed maxBytes", async () => {
    global.fetch = jest.fn(async () =>
      makeResponse({
        headers: { "content-type": "image/png" },
        chunks: [new Uint8Array(8), new Uint8Array(8)],
      })
    ) as unknown as typeof fetch;

    await expect(
      safeFetchImage("http://example.com/x.png", { maxBytes: 10 })
    ).rejects.toThrow("Image too large");
  });

  it("throws when the response has no readable body", async () => {
    global.fetch = jest.fn(async () =>
      makeResponse({ headers: { "content-type": "image/png" }, noBody: true })
    ) as unknown as typeof fetch;

    await expect(safeFetchImage("http://example.com/x.png")).rejects.toThrow(
      "Empty response body"
    );
  });

  it("passes redirect:manual and an Accept header to fetch", async () => {
    const fetchMock = jest.fn(async () =>
      makeResponse({
        headers: { "content-type": "image/png" },
        chunks: [new Uint8Array([1])],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await safeFetchImage("http://example.com/x.png");
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.redirect).toBe("manual");
    expect(init.headers).toMatchObject({ Accept: "image/*" });
    expect(init.signal).toBeDefined();
  });
});
