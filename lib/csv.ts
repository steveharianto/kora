// RFC 4180 CSV serializer with formula injection sanitization

export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '';

  let str = String(value);

  // Strip excessive whitespace
  str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Prevent CSV Formula Injection (=, +, -, @, tab, carriage return)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes
  str = str.replace(/"/g, '""');

  return `"${str}"`;
}

export function generateCsvString(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(sanitizeCsvCell).join(',');
  const rowLines = rows.map((row) => row.map(sanitizeCsvCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}
