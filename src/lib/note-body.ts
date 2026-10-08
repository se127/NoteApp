function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const STORED_BLOCK = /^<(p|h[1-6]|ul|ol|hr|blockquote)(\s[^>]*)?>/i;

function isStoredHtml(body: string): boolean {
  return STORED_BLOCK.test(body);
}

export function bodyToHtml(body: string): string {
  const trimmed = body.trim();
  if (trimmed === "") return "";
  if (isStoredHtml(trimmed)) return trimmed;

  return trimmed
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}
