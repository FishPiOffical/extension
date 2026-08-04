export interface UrlRules {
  allowUrls?: string[];
  blockUrls?: string[];
}

export function matchUrl(pattern: string, currentHref: string, currentPath: string): boolean {
  const escapedPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp(`^${escapedPattern}$`);
  return regex.test(pattern.startsWith('/') ? currentPath : currentHref);
}

function matchesAny(patterns: string[] | undefined, currentHref: string, currentPath: string): boolean {
  return (patterns || []).some(pattern => matchUrl(pattern, currentHref, currentPath));
}

export function isUrlAllowed(
  currentHref: string,
  currentPath: string,
  authorUrls: string[] | undefined,
  globalRules: UrlRules,
  itemRules: UrlRules,
): boolean {
  if (matchesAny(globalRules.blockUrls, currentHref, currentPath)) return false;
  if (matchesAny(itemRules.blockUrls, currentHref, currentPath)) return false;

  const allowGroups = [authorUrls, globalRules.allowUrls, itemRules.allowUrls]
    .filter((patterns): patterns is string[] => Boolean(patterns?.length));

  return allowGroups.every(patterns => matchesAny(patterns, currentHref, currentPath));
}
