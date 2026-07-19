/**
 * Local end-to-end trigger: signs a sample GitHub pull_request webhook and
 * POSTs it to the running API, so you can exercise the real Jira/Slack
 * adapters without GitHub or a tunnel.
 *
 * Usage:
 *   npx tsx scripts/send-test-webhook.ts                 # PR opened, key EO-1
 *   npx tsx scripts/send-test-webhook.ts merged EO-1     # PR merged, key EO-1
 *   npx tsx scripts/send-test-webhook.ts opened PROJ-42  # PR opened, key PROJ-42
 *
 * Reads GITHUB_WEBHOOK_SECRET and PORT from .env.
 */
import "dotenv/config";
import crypto from "crypto";

const action = (process.argv[2] ?? "opened").toLowerCase(); // "opened" | "merged"
const jiraKey = process.argv[3] ?? "EO-1";

const secret = process.env.GITHUB_WEBHOOK_SECRET ?? "replace-me";
const port = process.env.PORT ?? "3000";
const url = `http://localhost:${port}/webhooks/github`;

const isMerged = action === "merged";

const payload = {
  action: isMerged ? "closed" : "opened",
  pull_request: {
    number: 1,
    title: `${jiraKey} wire up real adapters`,
    html_url: "https://github.com/acme/easeorch/pull/1",
    merged: isMerged,
    merged_at: isMerged ? new Date().toISOString() : null,
    body: "Test PR body from send-test-webhook.ts",
    head: { ref: `feat/${jiraKey}-real-adapters` },
    user: { login: "octocat" }
  },
  repository: {
    name: "easeorch",
    full_name: "acme/easeorch",
    owner: { login: "acme" }
  }
};

const rawBody = Buffer.from(JSON.stringify(payload), "utf8");
const signature =
  "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
// Unique per run so the delivery-ID dedup never rejects a repeat test.
const deliveryId = crypto.randomUUID();

async function main() {
  console.log(`→ POST ${url}`);
  console.log(`  action=${payload.action} merged=${isMerged} jiraKey=${jiraKey}`);
  console.log(`  delivery=${deliveryId}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "pull_request",
      "X-GitHub-Delivery": deliveryId,
      "X-Hub-Signature-256": signature
    },
    body: rawBody
  });

  const text = await res.text();
  console.log(`← ${res.status} ${res.statusText}: ${text}`);

  if (!res.ok) {
    process.exitCode = 1;
    return;
  }
  console.log(
    "\nAccepted. Watch the WORKER terminal for adapter calls, then check Jira + Slack."
  );
}

main().catch((err) => {
  console.error("send-test-webhook failed:", err);
  process.exitCode = 1;
});
