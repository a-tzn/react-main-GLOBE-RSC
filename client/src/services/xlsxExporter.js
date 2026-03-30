/**
 * Universal XLSX Export Service
 * Handles exporting data to Excel with configurable field mappers
 * Manages column widths, formatting, and multiple sheet support
 */

import * as XLSX from 'xlsx';

/**
 * Generate column widths based on content
 * @param {Array<Object>} data - Array of data rows
 * @param {Array<string>} headers - Column header names
 * @returns {Array<{wch: number}>} Column width objects
 */
export function calculateColumnWidths(data, headers) {
  return headers.map(header => {
    let maxLength = header.length;

    data.forEach(row => {
      const cellValue = row[header] ? String(row[header]) : "";
      if (cellValue.length > maxLength) {
        maxLength = cellValue.length;
      }
    });

    return { wch: maxLength + 2 }; // Add padding
  });
}

/**
 * Create Excel workbook with single sheet
 * @param {Array<Object>} data - Rows to export
 * @param {string} sheetName - Name of the sheet
 * @returns {object} XLSX workbook object
 */
export function createWorkbook(data, sheetName = "Sheet1") {
  if (data.length === 0) {
    throw new Error("No data to export");
  }

  const headers = Object.keys(data[0]);
  const worksheet = XLSX.utils.json_to_sheet(data);
  const columnWidths = calculateColumnWidths(data, headers);

  worksheet["!cols"] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return workbook;
}

/**
 * Export rows with custom field mapping
 * @param {Array<Object>} rows - Data rows (with source field names)
 * @param {Object} fieldMapper - Maps source fields to export fields { "exportName": "sourceField" }
 * @param {string} fileName - Output file name (without extension)
 * @param {string} sheetName - Excel sheet name
 */
export function exportWithFieldMapper(rows, fieldMapper, fileName, sheetName = "Data") {
  if (rows.length === 0) {
    throw new Error("No rows to export");
  }

  // Transform rows using field mapper
  const exportRows = rows.map(row => {
    const mapped = {};
    for (const [exportKey, sourceKey] of Object.entries(fieldMapper)) {
      mapped[exportKey] = row[sourceKey] || "";
    }
    return mapped;
  });

  const workbook = createWorkbook(exportRows, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);

  return {
    success: true,
    fileName: `${fileName}.xlsx`,
    rowCount: rows.length
  };
}

/**
 * Export multiple result sets as separate sheets
 * @param {Object} sheetsData - { sheetName: { rows, fieldMapper } }
 * @param {string} fileName - Output file name
 */
export function exportMultiSheet(sheetsData, fileName) {
  const workbook = XLSX.utils.book_new();

  for (const [sheetName, { rows, fieldMapper }] of Object.entries(sheetsData)) {
    if (rows.length === 0) continue;

    const exportRows = rows.map(row => {
      const mapped = {};
      for (const [exportKey, sourceKey] of Object.entries(fieldMapper)) {
        mapped[exportKey] = row[sourceKey] || "";
      }
      return mapped;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const headers = Object.keys(exportRows[0]);
    worksheet["!cols"] = calculateColumnWidths(exportRows, headers);

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  XLSX.writeFile(workbook, `${fileName}.xlsx`);

  return {
    success: true,
    fileName: `${fileName}.xlsx`,
    sheetCount: Object.keys(sheetsData).length
  };
}

/**
 * Pre-built field mapper for StormMasterList exports
 */
export const SM_FIELD_MAPPER = {
  "Region": "region",
  "PLA ID": "plaId",
  "PLA Status": "plaStatus",
  "Area": "sArea",
  "Region ": "region",
  "Province": "prov",
  "Municipality": "mCity",
  "Barangay": "barangay",
  "Site Address": "sAdd",
  "Longitude": "lng",
  "Latitude": "lat",
  "Technology": "techGen",
  "Tech Name/ BTS": "nmsName",
  "Tech Description": "techDesc",
  "Tech Status": "techStatus",
  "Site Owner": "twrC",
  "Territory": "trt",
  "Hiroshima Severity": "hSvr",
  "Remarks": "remarks",
  "Remarks Status": "matchStatus"
};

/**
 * Pre-built field mapper for SiteAlert exports
 */
export const SA_FIELD_MAPPER = {
  "Alert Type": "alert",
  "PLA ID": "pla",
  "Site Name": "name",
  "Distinguished Name": "dn",
  "Count": "count",
  "Location Info": "li",
  "Alarm Source": "sn",
  "Severity": "severity"
};

export default {
  calculateColumnWidths,
  createWorkbook,
  exportWithFieldMapper,
  exportMultiSheet,
  SM_FIELD_MAPPER,
  SA_FIELD_MAPPER
};
