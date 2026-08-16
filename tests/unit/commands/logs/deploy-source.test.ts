import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the debugFetch to capture the URL
const mockDebugFetch = vi.fn();
vi.mock("../../../../src/commands/logs/log-api.js", () => ({
  debugFetch: (...args: unknown[]) => mockDebugFetch(...(args as [])) as unknown,
}));

import { fetchDeployHistoricalLogs } from "../../../../src/commands/logs/sources/deploy.js";

describe("fetchDeployHistoricalLogs", () => {
  beforeEach(() => {
    mockDebugFetch.mockReset();
    mockDebugFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  test("constructs URL without duplicated /api/v1 prefix", async () => {
    const apiBase = "https://api.netlify.com/api/v1";
    await fetchDeployHistoricalLogs({
      apiBase,
      accessToken: "test-token",
      deployId: "abc123",
      from: 0,
      to: Date.now(),
    });

    const calledUrl = mockDebugFetch.mock.calls[0]?.[0] as string;
    // Should NOT have /api/v1/api/v1
    expect(calledUrl).not.toContain("/api/v1/api/v1");
    // Should have the correct URL format
    expect(calledUrl).toBe("https://api.netlify.com/api/v1/deploys/abc123/log");
  });

  test("works with apiBase that already ends with /api/v1", async () => {
    const apiBase = "https://api.netlify.com/api/v1";
    await fetchDeployHistoricalLogs({
      apiBase,
      accessToken: null,
      deployId: "def456",
      from: 0,
      to: Date.now(),
    });

    const calledUrl = mockDebugFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe("https://api.netlify.com/api/v1/deploys/def456/log");
  });

  test("returns empty array when response is not an array", async () => {
    mockDebugFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve("not an array"),
    });

    const result = await fetchDeployHistoricalLogs({
      apiBase: "https://api.netlify.com/api/v1",
      accessToken: null,
      deployId: "xyz789",
      from: 0,
      to: Date.now(),
    });

    expect(result).toEqual([]);
  });

  test("throws on non-ok response", async () => {
    mockDebugFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(
      fetchDeployHistoricalLogs({
        apiBase: "https://api.netlify.com/api/v1",
        accessToken: null,
        deployId: "bad123",
        from: 0,
        to: Date.now(),
      }),
    ).rejects.toThrow("Failed to fetch deploy logs: 404 Not Found");
  });
});
