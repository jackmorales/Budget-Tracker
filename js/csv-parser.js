/**
 * ANZ CSV Parser
 * No imports — standalone utility module.
 *
 * Column layout (no header row):
 *   0: Date        DD/MM/YYYY
 *   1: Amount      quoted, signed  e.g. "-395.50" or "1400.00"
 *   2: Bank description
 *   3: Payer/Payee full name
 *   4: Payer/Payee short name
 *   5: Phone (sparse, ignored)
 *   6: Reference
 *   7: User note
 */

/**
 * Parse a single CSV line, handling quoted fields and embedded commas.
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Peek ahead: escaped quote ("") stays in the field
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }

  // Push the last field (may be empty for trailing commas)
  fields.push(current);

  return fields;
}

/**
 * Parse ANZ CSV text into an array of transaction objects.
 * @param {string} csvText
 * @returns {Array<{
 *   date: Date,
 *   amount: number,
 *   bankDesc: string,
 *   payeeFull: string,
 *   payeeShort: string,
 *   reference: string,
 *   notes: string,
 *   category: string,
 *   allocation: string,
 *   split: boolean
 * }>}
 */
function parseANZCSV(csvText) {
  if (!csvText || !csvText.trim()) return [];

  const lines = csvText.split('\n');
  const transactions = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const cols = parseCSVLine(line);

    // Col 0: Date — DD/MM/YYYY
    const dateParts = (cols[0] || '').split('/');
    const day   = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10);
    const year  = parseInt(dateParts[2], 10);
    const date  = new Date(year, month - 1, day);

    // Col 1: Amount — strip any surrounding quotes then parse
    const amountRaw = (cols[1] || '').replace(/"/g, '').trim();
    const amount = parseFloat(amountRaw);

    transactions.push({
      date,
      amount,
      bankDesc:   (cols[2] || '').trim(),
      payeeFull:  (cols[3] || '').trim(),
      payeeShort: (cols[4] || '').trim(),
      reference:  (cols[6] || '').trim(),
      notes:      (cols[7] || '').trim(),
      category:   '',
      allocation: '',
      split:      false,
    });
  }

  return transactions;
}

export { parseANZCSV, parseCSVLine };
