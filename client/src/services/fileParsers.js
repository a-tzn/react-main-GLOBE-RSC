export function parseCsv(text) {
  if (!text || !text.trim()) return [];

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') continue;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function csvToObjects(rows) {
  if (rows.length < 2) return [];

  const headers = rows[0];
  const dataRows = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.join('').trim() === '') continue;

    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j] || '';
    }
    dataRows.push(obj);
  }

  return dataRows;
}

export function parseJson(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    throw new Error(`JSON parse error: ${error.message}`);
  }
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => resolve(evt.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export default {
  parseCsv,
  csvToObjects,
  parseJson,
  readFileAsText
};
