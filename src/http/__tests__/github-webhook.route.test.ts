import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { createGitHubWebhookHandler } from "../routes/github-webhook.route";

const payload = {
  action: "opened",
  pull_request: {
    number: 42,
    title: "[PROJ-123] Add login flow",
    html_url: "https://github.com/acme/easeorch/pull/42",
    merged: false,
    head: {
      ref: "feature/PROJ-123-add-login"
    },
    user: {
      login: "likhithraj"
    },
    body: "Preview: https://github.com/user-attachments/files/123/example.mp4"
  },
  repository: {
    name: "easeorch",
    full_name: "acme/easeorch",
    owner: {
      login: "acme"
    }
  }
};

function sign(secret: string, body: string): string {
  const digest = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${digest}`;
}

describe("POST /webhooks/github", () => {
  const secret = "webhook-secret";
  let webhookEvents: Array<{ id: string; deliveryId: string }> = [];
  let normalizedEvents: Array<{ id: string; webhookEventId: string }> = [];

  function createPrismaMock() {
    return {
      webhookEvent: {
        create: jest.fn(async ({ data }: { data: { deliveryId: string } }) => {
          if (webhookEvents.some((event) => event.deliveryId === data.deliveryId)) {
            throw { code: "P2002" };
          }

          const record = {
            id: `webhook-${webhookEvents.length + 1}`,
            deliveryId: data.deliveryId
          };

          webhookEvents.push(record);
          return { id: record.id };
        })
      },
      normalizedEvent: {
        create: jest.fn(
          async ({
            data
          }: {
            data: {
              webhookEventId: string;
              mediaLinks: Prisma.InputJsonValue;
            };
          }) => {
            const record = {
              id: `normalized-${normalizedEvents.length + 1}`,
              webhookEventId: data.webhookEventId
            };

            normalizedEvents.push(record);
            return { id: record.id };
          }
        )
      }
    };
  }

  function createResponseMock() {
    const response = {
      statusCode: 200,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      }
    };

    return response;
  }

  beforeEach(() => {
    webhookEvents = [];
    normalizedEvents = [];
  });

  test("rejects an invalid signature", async () => {
    const prisma = createPrismaMock();
    const handler = createGitHubWebhookHandler({
      prisma,
      githubWebhookSecret: secret,
      queue: {
        enqueueNormalizedEvent: jest.fn()
      }
    });
    const response = createResponseMock();

    await handler(
      {
        body: Buffer.from(JSON.stringify(payload)),
        header: (name: string) =>
          ({
            "X-GitHub-Delivery": "delivery-1",
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": "sha256=deadbeef"
          })[name]
      } as never,
      response as never
    );

    expect(response.statusCode).toBe(401);
    expect(webhookEvents).toHaveLength(0);
  });

  test("stores the first delivery and enqueues it", async () => {
    const enqueueNormalizedEvent = jest.fn();
    const prisma = createPrismaMock();
    const handler = createGitHubWebhookHandler({
      prisma,
      githubWebhookSecret: secret,
      queue: {
        enqueueNormalizedEvent
      }
    });
    const response = createResponseMock();

    const rawBody = JSON.stringify(payload);

    await handler(
      {
        body: Buffer.from(rawBody),
        header: (name: string) =>
          ({
            "X-GitHub-Delivery": "delivery-2",
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": sign(secret, rawBody)
          })[name]
      } as never,
      response as never
    );

    expect(response.statusCode).toBe(202);
    expect(webhookEvents).toHaveLength(1);
    expect(normalizedEvents).toHaveLength(1);
    expect(enqueueNormalizedEvent).toHaveBeenCalledTimes(1);
    expect(enqueueNormalizedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedEventId: expect.any(String)
      })
    );
  });

  test("skips a duplicate delivery", async () => {
    const enqueueNormalizedEvent = jest.fn();
    const prisma = createPrismaMock();
    const handler = createGitHubWebhookHandler({
      prisma,
      githubWebhookSecret: secret,
      queue: {
        enqueueNormalizedEvent
      }
    });
    const response = createResponseMock();
    const duplicateResponse = createResponseMock();

    const rawBody = JSON.stringify(payload);
    const signature = sign(secret, rawBody);

    await handler(
      {
        body: Buffer.from(rawBody),
        header: (name: string) =>
          ({
            "X-GitHub-Delivery": "delivery-3",
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": signature
          })[name]
      } as never,
      response as never
    );

    await handler(
      {
        body: Buffer.from(rawBody),
        header: (name: string) =>
          ({
            "X-GitHub-Delivery": "delivery-3",
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": signature
          })[name]
      } as never,
      duplicateResponse as never
    );

    expect(duplicateResponse.statusCode).toBe(200);
    expect(webhookEvents).toHaveLength(1);
    expect(normalizedEvents).toHaveLength(1);
    expect(enqueueNormalizedEvent).toHaveBeenCalledTimes(1);
  });
});
