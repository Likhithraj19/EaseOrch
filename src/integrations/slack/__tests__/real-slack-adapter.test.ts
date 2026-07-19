import { RealSlackAdapter } from "../real-slack-adapter";
import { RetryableError, NonRetryableError } from "../../errors";

function fetchMock() {
  return global.fetch as unknown as jest.Mock;
}

describe("RealSlackAdapter", () => {
  let adapter: RealSlackAdapter;

  beforeEach(() => {
    global.fetch = jest.fn();
    adapter = new RealSlackAdapter({ botToken: "xoxb-123" });
  });

  it("POSTs channel+text with bearer auth and returns ts", async () => {
    fetchMock().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, ts: "1700000000.000100" }), {
        status: 200
      })
    );

    const result = await adapter.sendMessage("#dev", "hi");
    expect(result).toEqual({ externalId: "1700000000.000100" });

    const [url, init] = fetchMock().mock.calls[0];
    expect(url).toBe("https://slack.com/api/chat.postMessage");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer xoxb-123");
    expect(JSON.parse(init.body)).toEqual({ channel: "#dev", text: "hi" });
  });

  it("maps ok:false ratelimited to RetryableError", async () => {
    fetchMock().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "ratelimited" }), {
        status: 200
      })
    );
    await expect(adapter.sendMessage("#dev", "hi")).rejects.toBeInstanceOf(
      RetryableError
    );
  });

  it("maps ok:false channel_not_found to NonRetryableError", async () => {
    fetchMock().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "channel_not_found" }), {
        status: 200
      })
    );
    await expect(adapter.sendMessage("#dev", "hi")).rejects.toBeInstanceOf(
      NonRetryableError
    );
  });

  it("maps a 5xx transport status to RetryableError", async () => {
    fetchMock().mockResolvedValueOnce(new Response("upstream", { status: 503 }));
    await expect(adapter.sendMessage("#dev", "hi")).rejects.toBeInstanceOf(
      RetryableError
    );
  });

  it("wraps network errors as RetryableError", async () => {
    fetchMock().mockRejectedValueOnce(new Error("ETIMEDOUT"));
    await expect(adapter.sendMessage("#dev", "hi")).rejects.toBeInstanceOf(
      RetryableError
    );
  });
});
