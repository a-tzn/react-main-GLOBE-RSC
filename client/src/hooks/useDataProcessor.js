/**
 * Custom Hook: useDataProcessor
 * Unified data processing for both dashboards
 * Handles: file reading, parsing, grouping, filtering, sorting
 */

import { useState, useCallback } from 'react';
import {
  processWirelessAlarms,
  processTransportAlarms,
  processAlarmData
} from '../services/dataGrouper';
import { parseCsv, csvToObjects, parseJson, readFileAsText } from '../services/fileParsers';

/**
 * Main custom hook for data processing
 */
export function useDataProcessor() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Process file content based on type
   * @param {string} content File content (CSV or JSON string)
   * @param {string} type 'csv' or 'json'
   * @returns {Array<Object>}
   */
  const parseContent = useCallback((content, type = 'csv') => {
    try {
      if (type === 'json') {
        return parseJson(content);
      } else {
        const rows = parseCsv(content);
        return csvToObjects(rows);
      }
    } catch (err) {
      throw new Error(`Parse error: ${err.message}`);
    }
  }, []);

  /**
   * Read and parse a single file
   * @param {File} file Browser File object
   * @param {string} type 'csv' or 'json'
   * @returns {Promise<Array<Object>>}
   */
  const processFile = useCallback(async (file, type = 'csv') => {
    try {
      setIsLoading(true);
      setError(null);

      const content = await readFileAsText(file);
      const data = parseContent(content, type);

      return data;
    } catch (err) {
      const errorMsg = err.message || String(err);
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [parseContent]);

  /**
   * Process wireless alarms (SADashboard mode)
   * @param {Array} nmsData NMS file data
   * @param {Array} masterData Master file data
   * @returns {object} { success, data, error? }
   */
  const processWireless = useCallback((nmsData, masterData) => {
    try {
      const result = processWirelessAlarms(nmsData, masterData);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const errorMsg = err.message || String(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  /**
   * Process transport alarms (SADashboard mode)
   * @param {Array} data Transport alarm data
   * @returns {object} { success, data, error? }
   */
  const processTransport = useCallback((data) => {
    try {
      const result = processTransportAlarms(data);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const errorMsg = err.message || String(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  /**
   * Generic alarm processing with custom config
   * @param {Array} data Raw data
   * @param {Object} config Configuration object
   * @returns {object} { success, data, error? }
   */
  const processCustom = useCallback((data, config) => {
    try {
      const result = processAlarmData(data, config);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const errorMsg = err.message || String(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    parseContent,
    processFile,
    processWireless,
    processTransport,
    processCustom,
    clearError
  };
}

export default useDataProcessor;
