function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isStoredHtml(body: string): boolean {
  return /^<(p|h[1-6])(\s[^>]*)?>/i.test(body);
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
