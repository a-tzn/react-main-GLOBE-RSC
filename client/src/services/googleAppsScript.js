// UNIFIED DEPLOYMENT SUPPORT
// When running in Google Apps Script (GAS HTML Service), use google.script.run
// When running in development, use fetch() to the GAS API endpoint

/**
 * Get the google.script.run object if available (in GAS environment)
 */
function getGoogleScriptRunner() {
  return window.google?.script?.run || null;
}

/**
 * Check if running in GAS environment
 */
export function hasGoogleScriptRuntime() {
  return Boolean(getGoogleScriptRunner());
}

/**
 * Promisify google.script.run async calls
 */
function promisifyGasCall(functionName, ...args) {
  const runner = getGoogleScriptRunner();
  if (!runner) {
    throw new Error('google.script.run is not available');
  }
  
  return new Promise((resolve, reject) => {
    runner.withSuccessHandler(resolve).withFailureHandler(reject)[functionName](...args);
  });
}

// 🚀 DEVELOPMENT API ENDPOINT
// UPDATE THIS URL when you create a new GAS deployment
const API_BASE_URL = 'https://script.google.com/a/macros/umindanao.edu.ph/s/AKfycbwZbMC8pCRlYw_uORG-c55zSdNVKfZeRdxPH18sefsRi5XUg_D5CkMoz_HZ4PMWFXc7ZA/exec';

/**
 * Store uploaded data to Google Sheets
 */
export function storeUploadedData(fileName, dataType, rawData, processedData, metadata = {}) {
  const runner = getGoogleScriptRunner();
  
  if (runner) {
    return promisifyGasCall('storeUploadedData', fileName, dataType, rawData, processedData, metadata)
      .then(result => {
        if (!result.success) throw new Error(result.error || 'Failed to store data');
        return result;
      });
  }
  
  return fetch(API_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'storeData',
      fileName,
      dataType,
      rawData,
      processedData,
      metadata
    })
  })
  .then(response => response.json())
  .then(data => {
    if (!data.success) throw new Error(data.error || 'Failed to store data');
    return data;
  });
}

/**
 * Retrieve user's uploaded data from Google Sheets
 */
export function getUserUploadedData(limit = 20, dataType = '') {
  const runner = getGoogleScriptRunner();
  
  if (runner) {
    return promisifyGasCall('getUserUploadedData', limit, dataType)
      .then(result => {
        if (!result.success) throw new Error(result.error || 'Failed to retrieve data');
        return result.data;
      });
  }
  
  return fetch(API_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'getData',
      limit,
      dataType
    })
  })
  .then(response => response.json())
  .then(data => {
    if (!data.success) throw new Error(data.error || 'Failed to retrieve data');
    return data.data;
  });
}

/**
 * Retrieve summary of user's uploaded data (Filtered by Dashboard)
 */
export function getUserUploadedDataSummary(limit = 20, dataType = '') {
  const runner = getGoogleScriptRunner();

  if (runner) {
    return promisifyGasCall('getUserUploadedDataSummary', limit, dataType)
      .then(result => {
        if (!result.success) throw new Error(result.error || 'Failed to retrieve data summary');
        return result.data;
      });
  }

  return fetch(API_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'getDataSummary',
      limit,
      dataType
    })
  })
  .then(response => response.json())
  .then(data => {
    if (!data.success) throw new Error(data.error || 'Failed to retrieve data summary');
    return data.data;
  });
}

/**
 * Retrieve specific data entry by ID
 */
export function getUploadedDataById(dataId) {
  const runner = getGoogleScriptRunner();

  if (runner) {
    return promisifyGasCall('getUploadedDataById', dataId)
      .then(result => {
        if (!result.success) throw new Error(result.error || 'Failed to retrieve stored data');
        return result.data;
      });
  }

  return fetch(API_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'getDataById',
      dataId
    })
  })
  .then(response => response.json())
  .then(data => {
    if (!data.success) throw new Error(data.error || 'Failed to retrieve stored data');
    return data.data;
  });
}

/**
 * Retrieve the absolute latest data entry (Filtered by Dashboard)
 */
export function getLatestUserUploadedData(dataType = '') {
  const runner = getGoogleScriptRunner();

  if (runner) {
    return promisifyGasCall('getLatestUserUploadedData', dataType)
      .then(result => {
        if (!result.success) throw new Error(result.error || 'Failed to retrieve latest stored data');
        return result.data;
      });
  }

  return fetch(API_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'getLatestData',
      dataType
    })
  })
  .then(response => response.json())
  .then(data => {
    if (!data.success) throw new Error(data.error || 'Failed to retrieve latest stored data');
    return data.data;
  });
}

/**
 * Delete specific uploaded data
 */
export function deleteUploadedData(dataId) {
  const runner = getGoogleScriptRunner();
  
  if (runner) {
    return promisifyGasCall('deleteUploadedData', dataId)
      .then(result => {
        if (!result.success) throw new Error(result.error || 'Failed to delete data');
        return result;
      });
  }
  
  return fetch(API_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'deleteData',
      dataId
    })
  })
  .then(response => response.json())
  .then(data => {
    if (!data.success) throw new Error(data.error || 'Failed to delete data');
    return data;
  });
}

/**
 * Get current user information
 */
export function getUserInfo() {
  const runner = getGoogleScriptRunner();
  
  if (runner) {
    return promisifyGasCall('getUserInfo')
      .then(result => {
        if (!result.success) throw new Error(result.error || 'Failed to get user info');
        return result.data;
      });
  }
  
  return fetch(API_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'getUserInfo'
    })
  })
  .then(response => response.json())
  .then(data => {
    if (!data.success) throw new Error(data.error || 'Failed to get user info');
    return data.data;
  });
}

/**
 * Get last modified information (Filtered by Dashboard)
 */
export function getLastModifiedInfo(dataType = '') {
  const runner = getGoogleScriptRunner();
  
  if (runner) {
    return promisifyGasCall('getLastModifiedInfo', dataType)
      .then(result => {
        if (!result.success) throw new Error(result.error || 'Failed to get last modified info');
        return result.data;
      });
  }
  
  return fetch(API_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'getLastModified',
      dataType
    })
  })
  .then(response => response.json())
  .then(data => {
    if (!data.success) throw new Error(data.error || 'Failed to get last modified info');
    return data.data;
  });
}

// --- LEGACY FUNCTIONS (for backward compatibility) ---

export function processCSVComparisonRemote(file1Text, file2Text) {
  return new Promise((resolve, reject) => {
    const runner = getGoogleScriptRunner();
    if (!runner) {
      reject(new Error('Google Apps Script runtime is unavailable.'));
      return;
    }

    runner
      .withSuccessHandler((responseRaw) => {
        try {
          const response = typeof responseRaw === 'string' ? JSON.parse(responseRaw) : responseRaw;
          if (response?.success) {
            resolve(response.data);
            return;
          }
          reject(new Error(response?.error || 'Unknown Apps Script response error.'));
        } catch (error) {
          reject(error);
        }
      })
      .withFailureHandler((error) => {
        reject(error instanceof Error ? error : new Error(error?.message || String(error)));
      })
      .processCSVComparison(file1Text, file2Text);
  });
}

export function processAIAgentCommandRemote(userMessage, dataString) {
  return new Promise((resolve, reject) => {
    const runner = getGoogleScriptRunner();
    if (!runner) {
      reject(new Error('Google Apps Script runtime is unavailable.'));
      return;
    }

    runner
      .withSuccessHandler(resolve)
      .withFailureHandler((error) => {
        reject(error instanceof Error ? error : new Error(error?.message || String(error)));
      })
      .processAIAgentCommand(userMessage, dataString);
  });
}

export default {
  hasGoogleScriptRuntime,
  processCSVComparisonRemote,
  processAIAgentCommandRemote
};