import crypto from "crypto";
import { verifyGitHubSignature } from "../github-signature";

const secret = "test-secret";
const payload = Buffer.from(JSON.stringify({ hello: "world" }));

function sign(body: Buffer): string {
  const digest = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${digest}`;
}

describe("verifyGitHubSignature", () => {
  test("accepts a valid x-hub-signature-256 header", () => {
    expect(
      verifyGitHubSignature({
        rawBody: payload,
        secret,
        signatureHeader: sign(payload)
      })
    ).toBe(true);
  });

  test("rejects an invalid signature", () => {
    expect(
      verifyGitHubSignature({
        rawBody: payload,
        secret,
        signatureHeader: "sha256=deadbeef"
      })
    ).toBe(false);
  });

  test("rejects a missing signature", () => {
    expect(
      verifyGitHubSignature({
        rawBody: payload,
        secret,
        signatureHeader: undefined
      })
    ).toBe(false);
  });
});
