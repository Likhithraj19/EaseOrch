import { JiraAdapter, JiraExternalResult } from "./jira-adapter";
import { RetryableError, NonRetryableError } from "../errors";
import { classifyHttpError } from "../http-error";

export type RealJiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

type AdfNode = Record<string, unknown>;

// Split a single line into ADF inline nodes, wrapping any URL in a link mark
// so it renders as a clickable link in the Jira comment.
function lineToInlineNodes(line: string): AdfNode[] {
  if (line === "") return [];
  const nodes: AdfNode[] = [];
  let lastIndex = 0;
  for (const match of line.matchAll(URL_REGEX)) {
    const url = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) {
      nodes.push({ type: "text", text: line.slice(lastIndex, start) });
    }
    nodes.push({
      type: "text",
      text: url,
      marks: [{ type: "link", attrs: { href: url } }]
    });
    lastIndex = start + url.length;
  }
  if (lastIndex < line.length) {
    nodes.push({ type: "text", text: line.slice(lastIndex) });
  }
  return nodes;
}

// Convert a plain-text comment body into an ADF doc: one paragraph per line,
// with URLs auto-linked.
function bodyToAdf(body: string): AdfNode {
  return {
    type: "doc",
    version: 1,
    content: body.split("\n").map((line) => ({
      type: "paragraph",
      content: lineToInlineNodes(line)
    }))
  };
}

export class RealJiraAdapter implements JiraAdapter {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly timeoutMs: number;

  constructor(config: RealJiraConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.authHeader =
      "Basic " +
      Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(init.headers ?? {})
        },
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (err) {
      throw new RetryableError(`Jira request failed: ${path}`, err);
    }
  }

  async addComment(issueKey: string, body: string): Promise<JiraExternalResult> {
    const res = await this.request(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
      {
        method: "POST",
        body: JSON.stringify({
          body: bodyToAdf(body)
        })
      }
    );

    if (!res.ok) {
      throw classifyHttpError(
        res.status,
        `Jira addComment ${issueKey}`,
        await res.text()
      );
    }

    const json = (await res.json()) as { id: string };
    return { externalId: json.id };
  }

  async transitionIssue(
    issueKey: string,
    transitionName: string
  ): Promise<JiraExternalResult> {
    const path = `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`;

    const listRes = await this.request(path, { method: "GET" });
    if (!listRes.ok) {
      throw classifyHttpError(
        listRes.status,
        `Jira list transitions ${issueKey}`,
        await listRes.text()
      );
    }

    const { transitions } = (await listRes.json()) as {
      transitions: Array<{ id: string; name: string }>;
    };
    const match = transitions.find((t) => t.name === transitionName);
    if (!match) {
      throw new NonRetryableError(
        `Jira transition "${transitionName}" not available for ${issueKey}`
      );
    }

    const postRes = await this.request(path, {
      method: "POST",
      body: JSON.stringify({ transition: { id: match.id } })
    });
    if (!postRes.ok) {
      throw classifyHttpError(
        postRes.status,
        `Jira transition ${issueKey}`,
        await postRes.text()
      );
    }

    return { externalId: match.id };
  }
}
