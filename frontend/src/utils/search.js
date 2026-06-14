export function normalizeSearchText(value) {
    return String(value ?? '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

export function matchesSearchQuery(query, ...values) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return true;

    return values.some((value) => normalizeSearchText(value).includes(normalizedQuery));
}
