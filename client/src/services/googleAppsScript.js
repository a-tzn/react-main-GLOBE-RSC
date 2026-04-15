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

// DEVELOPMENT API ENDPOINTS
// In local dev, prefer Vite proxy (/api/gas) to avoid browser CORS issues.
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzYvpILMHQaCZaNXurBChx8hthrSyj_FqdKtNcZiiFG61YwnynIIJBT58Lzz51mrBka0w/exec';
const API_BASE_URL = import.meta.env.VITE_GAS_API_URL || DEFAULT_GAS_URL;
const API_DEV_PROXY_PATH = import.meta.env.VITE_GAS_DEV_PROXY_PATH || '/api/gas';
const FORCE_DIRECT_GAS = String(import.meta.env.VITE_GAS_FORCE_DIRECT || '').toLowerCase() === 'true';
const HAS_ENV_GAS_URL = Boolean(import.meta.env.VITE_GAS_API_URL);
const USER_INFO_CACHE_KEY = 'gas_user_info_cache_v1';
const USER_INFO_CACHE_TTL_MS = 30 * 60 * 1000;

let userInfoMemoryCache = null;
let userInfoInFlight = null;

function getSessionStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isValidCachedUser(payload) {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      payload.timestamp &&
      payload.data &&
      (Date.now() - payload.timestamp) < USER_INFO_CACHE_TTL_MS
  );
}

function readCachedUserInfoInternal() {
  if (isValidCachedUser(userInfoMemoryCache)) {
    return userInfoMemoryCache.data;
  }

  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(USER_INFO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidCachedUser(parsed)) {
      storage.removeItem(USER_INFO_CACHE_KEY);
      return null;
    }
    userInfoMemoryCache = parsed;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCachedUserInfoInternal(userData) {
  if (!userData || typeof userData !== 'object') return;
  const payload = { timestamp: Date.now(), data: userData };
  userInfoMemoryCache = payload;

  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.setItem(USER_INFO_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // no-op: best-effort cache only
  }
}

async function postApi(payload) {
  const shouldUseDevProxy = import.meta.env.DEV && !FORCE_DIRECT_GAS && HAS_ENV_GAS_URL;
  const endpoint = shouldUseDevProxy ? API_DEV_PROXY_PATH : API_BASE_URL;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const raw = await response.text();

  if (!raw || !raw.trim()) {
    throw new Error(
      `Empty response from GAS endpoint (${endpoint}). This usually means auth/permission or deployment URL mismatch.`
    );
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    const snippet = raw.slice(0, 180).replace(/\s+/g, ' ');
    throw new Error(
      `Non-JSON response from GAS endpoint (${endpoint}). Status ${response.status}. Body starts with: ${snippet}`
    );
  }

  if (!response.ok) {
    const message = data?.error || `HTTP ${response.status}`;
    throw new Error(`GAS request failed: ${message}`);
  }

  return data;
}

/**
 * Store uploaded data to Google Sheets
 */
export function storeUploadedData(fileName, dataType, rawData, processedData, metadata = {}) {
  const runner = getGoogleScriptRunner();

  if (runner) {
    return promisifyGasCall('storeUploadedData', fileName, dataType, rawData, processedData, metadata)
      .then((result) => {
        if (!result.success) throw new Error(result.error || 'Failed to store data');
        return result;
      });
  }

  return postApi({
    action: 'storeData',
    fileName,
    dataType,
    rawData,
    processedData,
    metadata
  }).then((data) => {
    if (!data.success) throw new Error(data.error || 'Failed to store data');
    return data;
  });
}

/**
 * Retrieve uploaded data summary.
 * includeAll=true means global scope (all users).
 */
export function getUserUploadedDataSummary(limit = 50, dataType = '', includeAll = false) {
  const runner = getGoogleScriptRunner();

  if (runner) {
    // Use the bridge method that is guaranteed to exist in code.gs.
    // Some deployments may not expose getUploadedDataSummary directly.
    return promisifyGasCall('getUserUploadedDataSummary', limit, dataType, includeAll)
      .then((result) => {
        if (!result.success) throw new Error(result.error || 'Failed to retrieve data summary');
        return result.data;
      });
  }

  return postApi({
    action: 'getDataSummary',
    limit,
    dataType,
    includeAll
  }).then((data) => {
    if (!data.success) throw new Error(data.error || 'Failed to retrieve data summary');
    return data.data;
  });
}

/**
 * Retrieve specific data entry by ID.
 * includeAll=true allows loading globally shared history entries.
 */
export function getUploadedDataById(dataId, includeAll = false, dataType = '') {
  const runner = getGoogleScriptRunner();

  if (runner) {
    return promisifyGasCall('getUploadedDataById', dataId, includeAll, dataType)
      .then((result) => {
        if (!result.success) throw new Error(result.error || 'Failed to retrieve stored data');
        return result.data;
      });
  }

  return postApi({
    action: 'getDataById',
    dataId,
    includeAll,
    dataType
  }).then((data) => {
    if (!data.success) throw new Error(data.error || 'Failed to retrieve stored data');
    return data.data;
  });
}

/**
 * Retrieve the latest stored data for the current user (per-user scope).
 */
export function getLatestUserUploadedData(dataType = '') {
  const runner = getGoogleScriptRunner();

  if (runner) {
    return promisifyGasCall('getLatestUserUploadedData', dataType)
      .then((result) => {
        if (!result.success) throw new Error(result.error || 'Failed to retrieve latest stored data');
        return result.data;
      });
  }

  return postApi({
    action: 'getLatestData',
    dataType
  }).then((data) => {
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
      .then((result) => {
        if (!result.success) throw new Error(result.error || 'Failed to delete data');
        return result;
      });
  }

  return postApi({
    action: 'deleteData',
    dataId
  }).then((data) => {
    if (!data.success) throw new Error(data.error || 'Failed to delete data');
    return data;
  });
}

/**
 * Get current user information
 */
export function getUserInfo() {
  const cachedUserInfo = readCachedUserInfoInternal();
  if (cachedUserInfo) {
    return Promise.resolve(cachedUserInfo);
  }

  if (userInfoInFlight) {
    return userInfoInFlight;
  }

  const runner = getGoogleScriptRunner();
  const request = runner
    ? promisifyGasCall('getUserInfo')
        .then((result) => {
          if (!result.success) throw new Error(result.error || 'Failed to get user info');
          return result.data;
        })
    : postApi({ action: 'getUserInfo' }).then((data) => {
        if (!data.success) throw new Error(data.error || 'Failed to get user info');
        return data.data;
      });

  userInfoInFlight = request
    .then((userData) => {
      writeCachedUserInfoInternal(userData);
      return userData;
    })
    .finally(() => {
      userInfoInFlight = null;
    });

  return userInfoInFlight;
}

export function getCachedUserInfo() {
  return readCachedUserInfoInternal();
}

/**
 * Get last modified information (dashboard-level)
 */
export function getLastModifiedInfo(dataType = '') {
  const runner = getGoogleScriptRunner();

  if (runner) {
    return promisifyGasCall('getLastModifiedInfo', dataType)
      .then((result) => {
        if (!result.success) throw new Error(result.error || 'Failed to get last modified info');
        return result.data;
      });
  }

  return postApi({
    action: 'getLastModified',
    dataType
  }).then((data) => {
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
