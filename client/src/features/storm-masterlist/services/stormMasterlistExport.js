import * as XLSX from 'xlsx';
import { cityToProvinceMap } from '../../../MainApp/MapDictionary/TelecomDictionaries';
import { calculateColumnWidths } from '../../../services/xlsxExporter';
import { parseLocationData, getShortRegionByProvince } from '../../../utils/telecom';

const EXPORT_STATUS_ORDER = ['NEW', 'MISMATCH', 'REMOVED', 'UNCHANGED'];

function sortRowsForExport(rows) {
  return [...rows].sort((a, b) => {
    const orderA = EXPORT_STATUS_ORDER.indexOf(a.matchStatus);
    const orderB = EXPORT_STATUS_ORDER.indexOf(b.matchStatus);
    if (orderA !== orderB) return orderA - orderB;

    const baseA = a.baseLocation || '';
    const baseB = b.baseLocation || '';
    return baseA.localeCompare(baseB, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function buildStormMasterlistExportRows(rows, exportCategory) {
  const filteredRows = exportCategory === 'ALL'
    ? rows.filter((row) => row.matchStatus !== 'REMOVED')
    : rows.filter((row) => row.matchStatus === exportCategory);

  return sortRowsForExport(filteredRows).map((row) => {
    const geo = parseLocationData(row.baseLocation);

    let region = getShortRegionByProvince(row.prov);
    if (!region && geo.province) region = getShortRegionByProvince(geo.province);
    if (!region && row.mCity) {
      const cleanCity = String(row.mCity).toUpperCase().trim();
      const fallbackProvince = cityToProvinceMap[cleanCity];
      if (fallbackProvince) region = getShortRegionByProvince(fallbackProvince);
    }

    return {
      Region: 'MIN',
      'PLA ID': row.plaId === 'NEW_SITE' ? '' : (row.plaId || ''),
      'PLA Status': '',
      Area: row.sArea || '',
      'Region ': (row.region || geo.region || region) || '',
      Province: (row.prov || geo.province) || '',
      Municipality: (row.mCity || geo.city) || '',
      Barangay: '',
      'Site Address': row.sAdd || '',
      Longitude: row.lng || '',
      Latitude: row.lat || '',
      Technology: row.techGen || 'UDM Only',
      'Tech Name/ BTS': row.nmsName || row.techName,
      'Tech Description': '',
      'Tech Status': '',
      'Site Owner': row.twrC || geo.siteCode || 'GLOBE TELECOM',
      Territory: row.trt || '',
      'Hiroshima Severity': row.hSvr || '',
      Remarks: row.remarks || '',
      'Remarks Status': row.matchStatus || ''
    };
  });
}

export function exportStormMasterlist(rows, exportCategory) {
  const exportRows = buildStormMasterlistExportRows(rows, exportCategory);
  if (exportRows.length === 0) {
    throw new Error(`There are no "${exportCategory}" sites to export.`);
  }

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const headers = Object.keys(exportRows[0]);
  worksheet['!cols'] = calculateColumnWidths(exportRows, headers);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Masterlist Data');

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `StormMasterlist_${exportCategory === 'ALL' ? 'Complete' : exportCategory}_${dateStr}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  return {
    success: true,
    fileName,
    rowCount: exportRows.length
  };
}

export default {
  buildStormMasterlistExportRows,
  exportStormMasterlist
};
