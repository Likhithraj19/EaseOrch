import { RealJiraAdapter } from "../real-jira-adapter";
import { RetryableError, NonRetryableError } from "../../errors";

const config = {
  baseUrl: "https://acme.atlassian.net/",
  email: "u@acme.com",
  apiToken: "tok"
};
const expectedAuth = "Basic " + Buffer.from("u@acme.com:tok").toString("base64");

function fetchMock() {
  return global.fetch as unknown as jest.Mock;
}

describe("RealJiraAdapter", () => {
  let adapter: RealJiraAdapter;

  beforeEach(() => {
    global.fetch = jest.fn();
    adapter = new RealJiraAdapter(config);
  });

  describe("addComment", () => {
    it("POSTs an ADF comment with basic auth and returns the comment id", async () => {
      fetchMock().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "10101" }), { status: 201 })
      );

      const result = await adapter.addComment("PROJ-123", "hello world");
      expect(result).toEqual({ externalId: "10101" });

      const [url, init] = fetchMock().mock.calls[0];
      expect(url).toBe(
        "https://acme.atlassian.net/rest/api/3/issue/PROJ-123/comment"
      );
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe(expectedAuth);

      const body = JSON.parse(init.body);
      expect(body.body.type).toBe("doc");
      expect(body.body.content[0].content[0].text).toBe("hello world");
    });

    it("maps 429 to RetryableError", async () => {
      fetchMock().mockResolvedValueOnce(new Response("rate limited", { status: 429 }));
      await expect(adapter.addComment("PROJ-1", "x")).rejects.toBeInstanceOf(
        RetryableError
      );
    });

    it("maps 404 to NonRetryableError", async () => {
      fetchMock().mockResolvedValueOnce(new Response("no issue", { status: 404 }));
      await expect(adapter.addComment("PROJ-1", "x")).rejects.toBeInstanceOf(
        NonRetryableError
      );
    });

    it("wraps network errors as RetryableError", async () => {
      fetchMock().mockRejectedValueOnce(new Error("ECONNRESET"));
      await expect(adapter.addComment("PROJ-1", "x")).rejects.toBeInstanceOf(
        RetryableError
      );
    });
  });

  describe("transitionIssue", () => {
    it("looks up the transition id by name then POSTs it", async () => {
      fetchMock()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              transitions: [
                { id: "31", name: "Done" },
                { id: "21", name: "In Progress" }
              ]
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      const result = await adapter.transitionIssue("PROJ-1", "Done");
      expect(result).toEqual({ externalId: "31" });

      const calls = fetchMock().mock.calls;
      expect(calls[0][1].method).toBe("GET");
      expect(calls[1][1].method).toBe("POST");
      expect(JSON.parse(calls[1][1].body)).toEqual({ transition: { id: "31" } });
    });

    it("throws NonRetryableError when the transition name is unavailable, without POSTing", async () => {
      fetchMock().mockResolvedValueOnce(
        new Response(
          JSON.stringify({ transitions: [{ id: "21", name: "In Progress" }] }),
          { status: 200 }
        )
      );

      await expect(
        adapter.transitionIssue("PROJ-1", "Done")
      ).rejects.toBeInstanceOf(NonRetryableError);
      expect(fetchMock().mock.calls).toHaveLength(1);
    });
  });
});
