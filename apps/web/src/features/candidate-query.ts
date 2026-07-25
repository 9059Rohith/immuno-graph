export function candidateListParams(search: URLSearchParams, track: string) {
  const params = new URLSearchParams();
  const allowed = [
    'category',
    'sourceStatus',
    'allele',
    'minScore',
    'maxScore',
    'search',
    'hasWarnings',
    'cursor',
  ];
  params.set('track', track);
  params.set('sort', search.get('sort') ?? 'rank');
  params.set('limit', search.get('limit') ?? '50');
  for (const key of allowed) {
    const value = search.get(key);
    if (value !== null && value.trim() !== '') params.set(key, value);
  }
  return params;
}
