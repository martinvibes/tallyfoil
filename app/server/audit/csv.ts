export interface CsvRecord {
  /** 1-based line number in the source where the record starts. */
  line: number;
  fields: string[];
}

/**
 * Minimal RFC 4180 reader: comma separated, double-quoted fields may contain
 * commas, newlines and doubled quotes. Handles LF and CRLF line endings.
 */
export const parseCsv = (text: string): CsvRecord[] => {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  const endField = () => {
    fields.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    records.push({ line: recordLine, fields });
    fields = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        if (char === "\n") line++;
        field += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ",") endField();
    else if (char === "\r") continue;
    else if (char === "\n") {
      endRecord();
      line++;
      recordLine = line;
    } else field += char;
  }

  if (field !== "" || fields.length > 0) endRecord();
  return records;
};
