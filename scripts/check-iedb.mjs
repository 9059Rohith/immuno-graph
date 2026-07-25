const endpoint =
  process.env.IEDB_MHCI_URL ?? 'https://tools-cluster-interface.iedb.org/tools_api/mhci/';

const body = new URLSearchParams({
  method: 'recommended',
  sequence_text: 'ACDEFGHIKLMNPQRST',
  allele: 'HLA-A*02:01',
  length: '9',
});

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    accept: 'text/tsv, text/tab-separated-values, text/plain',
    'content-type': 'application/x-www-form-urlencoded',
    'user-agent': 'ImmunoGraph/0.1 (+https://tools.iedb.org/main/tools-api/)',
  },
  body,
});

const text = await response.text();

if (!response.ok) {
  throw new Error(`IEDB smoke check failed with HTTP ${response.status}.`);
}

const lines = text
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

if (lines.length < 2 || !lines[0]?.toLowerCase().includes('peptide')) {
  throw new Error('IEDB smoke check returned an unexpected TSV shape.');
}

console.log('IEDB smoke check passed.');
console.log(`Endpoint: ${endpoint}`);
console.log(`Rows including header: ${lines.length}`);
