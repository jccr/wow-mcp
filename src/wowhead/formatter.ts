/**
 * Map quality IDs to standard WoW quality names.
 */
export const QUALITY_NAMES: Record<number, string> = {
  0: 'Poor (Grey)',
  1: 'Common (White)',
  2: 'Uncommon (Green)',
  3: 'Rare (Blue)',
  4: 'Epic (Purple)',
  5: 'Legendary (Orange)',
  6: 'Artifact (Gold)',
  7: 'Heirloom (Light Yellow)',
};

export function getQualityName(quality?: number): string | undefined {
  if (quality === undefined || quality < 0) return undefined;
  return QUALITY_NAMES[quality] ?? `Quality ${quality}`;
}

/**
 * Converts a raw HTML tooltip from Wowhead into clean Markdown / plaintext.
 */
export function formatTooltip(html?: string): string {
  if (!html) return '';

  let text = html;

  // Replace money formatting
  text = text.replace(/<span class="moneygold">(\d+)<\/span>/g, '$1g ');
  text = text.replace(/<span class="moneysilver">(\d+)<\/span>/g, '$1s ');
  text = text.replace(/<span class="moneycopper">(\d+)<\/span>/g, '$1c');

  // Strip HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Format table columns and rows
  text = text.replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, '  |  ');
  text = text.replace(/<\/tr>/gi, '\n');
  text = text.replace(/<tr[^>]*>/gi, '');
  text = text.replace(/<\/?table[^>]*>/gi, '\n');

  // Format breaks and blocks
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<p[^>]*>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<div[^>]*>/gi, '\n');
  text = text.replace(/<\/div>/gi, '');

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&plusmn;/g, '±');

  // Clean whitespace
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines.join('\n');
}
