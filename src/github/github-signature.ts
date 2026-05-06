import crypto from "crypto";

type VerifyGitHubSignatureParams = {
  rawBody: Buffer;
  secret: string;
  signatureHeader?: string;
};

export function verifyGitHubSignature({
  rawBody,
  secret,
  signatureHeader
}: VerifyGitHubSignatureParams): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expectedDigest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const actualDigest = signatureHeader.slice("sha256=".length);

  if (expectedDigest.length !== actualDigest.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expectedDigest), Buffer.from(actualDigest));
}
