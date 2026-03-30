/**
 * Universal Data Grouping Service
 * Handles grouping alarms by composite keys with configurable threshold filtering
 * Works for both Wireless (SADashboard) and Transport (SMDashboard) alarm types
 */

const DATA_DELIMITER = "___";

/**
 * Flexible column lookup - matches against multiple possible column name variants
 * @param {Object} row - Single data row
 * @param {Array<string>} possibleNames - Array of possible column name variants
 * @returns {*} Column value or null if not found
 */
export function getColValue(row, possibleNames) {
  const keys = Object.keys(row);
  for (let i = 0; i < keys.length; i++) {
    const key = String(keys[i]).trim().toUpperCase();
    if (possibleNames.includes(key)) {
      return row[keys[i]];
    }
  }
  return null;
}

/**
 * Group data by composite key pattern
 * @param {Array} data - Array of data rows
 * @param {Array<Array<string>>} columnConfigs - Array of [fieldName, [possibleColumns]]
 * @returns {Object} { groupedData: Map, rawGroups: Object }
 */
export function groupByCompositeKey(data, columnConfigs) {
  const groupedAlarms = {};

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const keyParts = [];

    // Extract values for all configured columns
    for (const [, possibleNames] of columnConfigs) {
      const value = getColValue(row, possibleNames);
      if (!value) {
        keyParts.push(null); // Preserve position for null values
      } else {
        keyParts.push(String(value).trim());
      }
    }

    // If any critical field is missing, skip this row
    if (keyParts.some(part => part === null)) {
      continue;
    }

    const key = keyParts.join(DATA_DELIMITER);

    if (!groupedAlarms[key]) {
      groupedAlarms[key] = [];
    }
    groupedAlarms[key].push(row);
  }

  return groupedAlarms;
}

/**
 * Filter grouped data by minimum count threshold
 * @param {Object} groupedData - Grouped data from groupByCompositeKey
 * @param {number} minCount - Minimum alarm count to include
 * @param {Array<string>} fieldNames - Original field names for reconstruction
 * @returns {Array} Array of filtered alarm records with count and rawRows
 */
export function filterByCountThreshold(groupedData, minCount = 10, fieldNames = []) {
  const filtered = [];

  for (const key in groupedData) {
    const rawRowsArray = groupedData[key];
    const count = rawRowsArray.length;

    if (count >= minCount) {
      const parts = key.split(DATA_DELIMITER);

      // Create result object with original field names as keys
      const result = { count, rawRows: rawRowsArray };

      for (let i = 0; i < fieldNames.length; i++) {
        result[fieldNames[i]] = parts[i];
      }

      filtered.push(result);
    }
  }

  return filtered;
}

/**
 * Sort grouped alarms by count (descending)
 * @param {Array} data - Array of alarm records
 * @returns {Array} Sorted array
 */
export function sortByCount(data) {
  return data.sort((a, b) => b.count - a.count);
}

/**
 * Complete grouping pipeline: group → filter → sort
 * @param {Array} data - Raw data array
 * @param {Object} config - Configuration object
 * @param {Array<Array>} config.columnConfigs - Column extraction configs
 * @param {Array<string>} config.fieldNames - Field names for output
 * @param {number} config.minCount - Minimum count threshold (default: 10)
 * @returns {object} { success, data, error? }
 */
export function processAlarmData(data, config = {}) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Data is empty or not an array");
    }

    const {
      columnConfigs = [],
      fieldNames = [],
      minCount = 10
    } = config;

    if (columnConfigs.length === 0) {
      throw new Error("Column configurations required");
    }

    const grouped = groupByCompositeKey(data, columnConfigs);
    const filtered = filterByCountThreshold(grouped, minCount, fieldNames);
    const sorted = sortByCount(filtered);

    return {
      success: true,
      data: sorted
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
}

/**
 * Wireless alarm processing (SADashboard)
 * Preserves the original SADashboard matching behavior:
 * - group by alarm + DN + supplementary info
 * - keep only groups with 10+ repetitions
 * - match BCF alarms against 2G DN entries
 * - match MRBTS alarms against MRBTS entries
 * - use supplementary info as alert text when it is non-numeric
 */
export function processWirelessAlarms(nmsData, masterData) {
  try {
    if (!Array.isArray(nmsData) || nmsData.length === 0) {
      throw new Error("NMS data is empty");
    }
    if (!Array.isArray(masterData) || masterData.length === 0) {
      throw new Error("Master data is empty");
    }

    const groupedAlarms = {};
    for (let i = 0; i < nmsData.length; i++) {
      const row = nmsData[i];
      const alarm = getColValue(row, ["ALARM TEXT", "Alarm Text"]);
      const dn = getColValue(row, ["DISTINGUISHED NAME", "Distinguished Name"]);
      const si = getColValue(row, ["SUPPLEMENTARY INFORMATION", "supplementary information"]);

      if (!dn || !alarm || !si) {
        continue;
      }

      const key = [alarm, dn, si].join(DATA_DELIMITER);
      if (!groupedAlarms[key]) {
        groupedAlarms[key] = [];
      }
      groupedAlarms[key].push(row);
    }

    const filtered = [];
    for (const key in groupedAlarms) {
      const rawRowsArray = groupedAlarms[key];
      const count = rawRowsArray.length;

      if (count >= 10) {
        const parts = key.split(DATA_DELIMITER);
        filtered.push({
          alarm: parts[0],
          dn: parts[1],
          si: parts[2],
          count,
          rawRows: rawRowsArray
        });
      }
    }

    const map2G = {};
    const mapMRBTS = {};
    for (let j = 0; j < masterData.length; j++) {
      const row = masterData[j];
      const dn2g = getColValue(row, ["2G DN", "2GDN"]);
      if (dn2g) {
        map2G[String(dn2g).trim().toUpperCase()] = row;
      }

      const mrbts = getColValue(row, ["MRBTS ID", "MRBTS"]);
      if (mrbts) {
        mapMRBTS[String(mrbts).trim().toUpperCase()] = row;
      }
    }

    const result = [];
    for (let i = 0; i < filtered.length; i++) {
      const item = filtered[i];
      const dn = String(item.dn).toUpperCase();
      const alarm = item.alarm;
      const si = String(item.si).toUpperCase();

      if (dn.includes("BCF")) {
        const cleanDn = dn.split("/").slice(0, 3).join("/");

        for (const key in map2G) {
          if (cleanDn.includes(key) || key.includes(cleanDn)) {
            const row = map2G[key];
            result.push({
              alert: !isNaN(Number(si)) ? alarm : si,
              pla: getColValue(row, ["PLA ID", "PLA_ID"]),
              name: getColValue(row, ["BCF NAME", "BCF_NAME"]),
              dn: item.dn,
              count: item.count,
              rawRows: item.rawRows
            });
            break;
          }
        }
      } else if (dn.includes("MRBTS")) {
        const cleanDn = dn.split("/").slice(0, 2).join("/");

        for (const key in mapMRBTS) {
          if (cleanDn.includes(key) || key.includes(cleanDn)) {
            const row = mapMRBTS[key];
            result.push({
              alert: !isNaN(Number(si)) ? alarm : si,
              pla: getColValue(row, ["PLA ID", "PLA_ID"]),
              name: getColValue(row, ["PROPOSED LTE NAME", "Proposed LTE Name"]),
              dn: item.dn,
              count: item.count,
              rawRows: item.rawRows
            });
            break;
          }
        }
      }
    }

    return {
      success: true,
      data: sortByCount(result)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
}

/**
 * Transport alarm processing (SADashboard)
 * Preserves the original SADashboard transport defaults so rows are
 * still counted even when some columns are missing.
 */
export function processTransportAlarms(data) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Transport data is empty");
    }

    const groupedAlarms = {};
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const alarm = getColValue(row, ["NAME"]) || "Unknown Alarm";
      const li = getColValue(row, ["LOCATION INFO"]) || "N/A";
      const sn = getColValue(row, ["ALARM SOURCE"]) || "Unknown Site";
      const severity = getColValue(row, ["SEVERITY"]) || "N/A";

      if (alarm === "Unknown Alarm" && sn === "Unknown Site") {
        continue;
      }

      const key = [alarm, li, sn, severity].join(DATA_DELIMITER);
      if (!groupedAlarms[key]) {
        groupedAlarms[key] = [];
      }
      groupedAlarms[key].push(row);
    }

    const filtered = [];
    for (const key in groupedAlarms) {
      const rawRowsArray = groupedAlarms[key];
      const count = rawRowsArray.length;

      if (count >= 10) {
        const parts = key.split(DATA_DELIMITER);
        filtered.push({
          alarm: parts[0],
          li: parts[1],
          sn: parts[2],
          severity: parts[3],
          count,
          rawRows: rawRowsArray
        });
      }
    }

    return {
      success: true,
      data: sortByCount(filtered)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
}

export default {
  getColValue,
  groupByCompositeKey,
  filterByCountThreshold,
  sortByCount,
  processAlarmData,
  processWirelessAlarms,
  processTransportAlarms,
  DATA_DELIMITER
};
