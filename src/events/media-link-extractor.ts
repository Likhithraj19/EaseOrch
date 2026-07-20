// Excludes whitespace, `)` (markdown image `![alt](url)`), and quotes / angle
// brackets so URLs embedded in HTML tags (`<video src="url">`, `<a href="url">`)
// don't capture the closing delimiter.
const URL_PATTERN = /https?:\/\/[^\s)"'<>]+/g;
const MEDIA_EXTENSIONS = /\.(png|jpe?g|gif|webp|mp4|mov|webm|txt|log|pdf)(\?|#|$)/i;

function normalizeUrl(url: string): string {
  return url.replace(/["'.,;:!?]+$/, "");
}

function isEvidenceLink(url: string): boolean {
  return url.includes("github.com/user-attachments/") || url.includes("/files/") || MEDIA_EXTENSIONS.test(url);
}

export function extractMediaLinks(body?: string | null): string[] {
  if (!body) {
    return [];
  }

  const urls = body.match(URL_PATTERN) ?? [];
  return Array.from(new Set(urls.map(normalizeUrl).filter(isEvidenceLink)));
}
