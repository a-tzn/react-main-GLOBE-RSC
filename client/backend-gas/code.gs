/*
  Globe RSC Network Delta Engine - Backend API (Version 4.0)
  Architecture: Hash Indexing, Reverse Pagination, & RAM Caching
 */

const CONFIG = {
  USERS_SHEET_NAME: 'Users',
  LAST_MODIFIED_SHEET_NAME: 'LastModified',
  DRIVE_FOLDER_NAME: 'GLOBE RSC',
  ALLOW_DOMAIN_LINK_SHARING: false
};

const CACHE = CacheService.getScriptCache();
const MAX_CACHE_VALUE_CHARS = 90000;

// Helper to route front-end 'dataType' to the correct system/sheet
function getSystemType(dataType) {
  const dt = String(dataType || '').toUpperCase();
  // If it's wireless/transport/SA, it goes to Site Alert. Otherwise Storm Masterlist.
  return (dt === 'WIRELESS' || dt === 'TRANSPORT' || dt === 'SA') ? 'SA' : 'SM';
}

function getSheetName(system) {
  return system === 'SM' ? 'SMUploadedData' : 'SAUploadedData';
}

function dataTypeMatches(rowDataType, requestedDataType) {
  const req = String(requestedDataType || '').trim().toLowerCase();
  if (!req) return true;
  return String(rowDataType || '').trim().toLowerCase() === req;
}


 // 1. WEB APP ENTRY (ROUTING)

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Globe RSC')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents || '{}');
    const action = request.action;
    const system = getSystemType(request.dataType);
    let response;

    switch (action) {
      case 'storeData':
        response = storeUploadedData(
          request.fileName,
          request.dataType,
          request.rawData,
          request.processedData,
          request.metadata
        );
        break;

      case 'getDataSummary':
        response = getUploadedDataSummaryFast(system, request.limit, request.dataType);
        break;

      case 'getDataById':
        response = getByIdFast(system, request.dataId);
        break;

      case 'getLatestData':
        response = getLatestDataFast(system, request.dataType);
        break;

      case 'getGlobalHistory':
        response = getGlobalHistory(request.limit);
        break;

      case 'deleteData':
        response = deleteUploadedData(system, request.dataId);
        break;

      case 'getUserInfo':
        response = getUserInfo();
        break;

      case 'getLastModified':
        response = getLastModifiedInfo(request.dataType || '');
        break;

      case 'initialize':
        response = initializeSpreadsheet();
        break;

      default:
        response = { success: false, error: 'Unknown Action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Request processing failed: ' + e.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}


// 2. V4.0 ENTERPRISE DATABASE ENGINE (READ)


function getLatestDataFast(system, dataType) {
  const userInfoRes = getUserInfo();
  if (!userInfoRes.success) return userInfoRes;
  const userId = userInfoRes.data.userId;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSheetName(system));
  if (!sheet) return { success: true, data: null };
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, data: null };

  const rowsToFetch = Math.min(lastRow - 1, 20);
  const startRow = lastRow - rowsToFetch + 1;
  const chunk = sheet.getRange(startRow, 1, rowsToFetch, 8).getValues();

  for (let i = chunk.length - 1; i >= 0; i--) {
    const row = chunk[i];
    if (row[1] === userId && dataTypeMatches(row[4], dataType)) {
      return packageRow(row); 
    }
  }
  return { success: true, data: null };
}

function getByIdFast(system, dataId) {
  const indexStr = CACHE.get("INDEX_" + system);
  const index = indexStr ? JSON.parse(indexStr) : {};

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSheetName(system));
  if (!sheet) return { success: false, error: "Database not initialized" };
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: "Empty database" };

  // 1. FAST PATH: Hash Index
  if (index[dataId]) {
    const rowIndex = index[dataId];
    if (rowIndex <= lastRow) {
      const row = sheet.getRange(rowIndex, 1, 1, 8).getValues()[0];
      if (row[0] === dataId) return packageRow(row);
    }
  }

  // 2. SAFE PATH: Chunked Reverse Pagination (2,000 rows at a time)
  const CHUNK_SIZE = 2000;
  let endRow = lastRow;

  while (endRow > 1) {
    const rowsToFetch = Math.min(CHUNK_SIZE, endRow - 1);
    const startRow = endRow - rowsToFetch + 1;
    const chunk = sheet.getRange(startRow, 1, rowsToFetch, 8).getValues();

    for (let i = chunk.length - 1; i >= 0; i--) {
      if (chunk[i][0] === dataId) {
        updateIndex(system, dataId, startRow + i);
        return packageRow(chunk[i]);
      }
    }
    endRow = startRow - 1; 
  }

  return { success: false, error: "Data not found after full scan" };
}

function getUploadedDataSummaryFast(system, limit, dataType) {
  const safeLimit = Number(limit || 50);
  const normalizedDataType = String(dataType || '').trim().toLowerCase();
  const cacheKey = `SUMMARY_${system}_${normalizedDataType || 'all'}_${safeLimit}`;
  
  const cachedStr = CACHE.get(cacheKey);
  if (cachedStr) return { success: true, data: JSON.parse(cachedStr) };

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSheetName(system));
  if (!sheet) return { success: true, data: [] };
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, data: [] };

  const rowsToFetch = Math.min(lastRow - 1, safeLimit);
  const startRow = lastRow - rowsToFetch + 1;
  const rows = sheet.getRange(startRow, 1, rowsToFetch, 8).getValues();
  const filteredRows = rows.filter(function(r) {
    return dataTypeMatches(r[4], dataType);
  });

  const result = filteredRows.reverse().map(function(r) {
    const meta = compactSummaryMetadata(safeJsonParse(r[7], {}));
    return {
      id: r[0],
      userId: r[1],
      uploadDate: r[2],
      fileName: r[3],
      dataType: r[4],
      metadata: meta,
      processedCount: meta.processedRecords || 0
    };
  });

  putCacheSafe(cacheKey, result, 30);
  return { success: true, data: result };
}

function getGlobalHistory(limit) {
  const safeLimit = Number(limit || 50);
  const cacheKey = `GLOBAL_HISTORY_${safeLimit}`;
  
  const cachedStr = CACHE.get(cacheKey);
  if (cachedStr) return { success: true, data: JSON.parse(cachedStr) };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let merged = [];

  const smSheet = ss.getSheetByName(getSheetName("SM"));
  const smLastRow = smSheet ? smSheet.getLastRow() : 0;
  if (smLastRow > 1) {
    const smData = smSheet.getRange(2, 1, smLastRow - 1, 8).getValues();
    const smTagged = smData.map(r => ({ id: r[0], system: "SM", uploadDate: r[2], fileName: r[3], dataType: r[4] }));
    merged = merged.concat(smTagged);
  }

  const saSheet = ss.getSheetByName(getSheetName("SA"));
  const saLastRow = saSheet ? saSheet.getLastRow() : 0;
  if (saLastRow > 1) {
    const saData = saSheet.getRange(2, 1, saLastRow - 1, 8).getValues();
    const saTagged = saData.map(r => ({ id: r[0], system: "SA", uploadDate: r[2], fileName: r[3], dataType: r[4] }));
    merged = merged.concat(saTagged);
  }

  merged.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  const finalResult = merged.slice(0, safeLimit);

  putCacheSafe(cacheKey, finalResult, 60);
  return { success: true, data: finalResult };
}

// 3. CORE WRITE ENGINE & CACHE MGMT

function storeUploadedData(fileName, dataType, rawData, processedData, metadata) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    lockAcquired = lock.tryLock(15000);
    if (!lockAcquired) return { success: false, error: 'Database busy. Please try again.' };

    initializeSpreadsheet();

    const userInfoRes = getUserInfo();
    if (!userInfoRes.success) return userInfoRes;
    const userInfo = userInfoRes.data;

    const system = getSystemType(dataType);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = ss.getSheetByName(getSheetName(system));

    const timestamp = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd_HHmmss');
    const safeEngineerName = String(userInfo.displayName || 'Workspace_User').replace(/[^a-zA-Z0-9]/g, '_');

    const rawId = saveJsonToDrive('RAW_' + safeEngineerName + '_' + timestamp + '.json', rawData);
    const procId = saveJsonToDrive('PROCESSED_' + safeEngineerName + '_' + timestamp + '.json', processedData);

    const cleanMetadata = metadata || {};
    cleanMetadata.engineerName = userInfo.displayName;
    if (Array.isArray(processedData)) cleanMetadata.processedRecords = processedData.length;

    // Save compact 20-row preview directly in metadata.
    if (Array.isArray(processedData)) {
      cleanMetadata.previewData = processedData.slice(0, 20).map(trimPreviewRow);
    }

    const newId = Utilities.getUuid();
    dataSheet.appendRow([
      newId,
      userInfo.userId,
      new Date().toISOString(),
      fileName,
      dataType,
      rawId,
      procId,
      JSON.stringify(cleanMetadata)
    ]);

    // Update Cache Index instantly for the next read
    updateIndex(system, newId, dataSheet.getLastRow());

    updateUserStats(userInfo.userId, userInfo.name, userInfo.displayName, ss);
    updateLastModified(userInfo.userId, userInfo.name, userInfo.displayName, fileName, dataType, 'upload', 'Processed ' + (Array.isArray(processedData) ? processedData.length : 0) + ' rows', ss);
    
    cleanUpOldData(system, 15, ss);
    invalidateCaches(system); // Flush old RAM!

    return { success: true, message: 'Stored successfully' };
  } catch (e) {
    return { success: false, error: 'Storage Error: ' + e.message };
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

function deleteUploadedData(system, dataId) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    lockAcquired = lock.tryLock(10000);
    if (!lockAcquired) return { success: false, error: 'Database busy.' };

    const userInfoRes = getUserInfo();
    if (!userInfoRes.success) return userInfoRes;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(getSheetName(system));
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === dataId && data[i][1] === userInfoRes.data.userId) {
        deleteFileFromDrive(data[i][5]);
        deleteFileFromDrive(data[i][6]);
        sheet.deleteRow(i + 1);
        invalidateCaches(system);
        return { success: true, message: 'Data deleted successfully' };
      }
    }
    return { success: false, error: 'Data not found or access denied' };
  } catch (e) {
    return { success: false, error: 'Failed to delete data: ' + e.message };
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

function invalidateCaches(system) {
  CACHE.remove(`SUMMARY_${system}_10`);
  CACHE.remove(`SUMMARY_${system}_50`);
  CACHE.remove(`GLOBAL_HISTORY_50`);
}

function updateIndex(system, dataId, rowIndex) {
  const cacheKey = "INDEX_" + system;
  let indexStr = CACHE.get(cacheKey);
  let index = indexStr ? JSON.parse(indexStr) : {};
  index[dataId] = rowIndex;
  CACHE.put(cacheKey, JSON.stringify(index), 21600);
}

function packageRow(row) {
  return {
    success: true,
    data: {
      id: row[0],
      userId: row[1],
      uploadDate: row[2],
      fileName: row[3],
      dataType: row[4],
      rawData: getJsonFromDriveOrCell(row[5], []),
      processedData: getJsonFromDriveOrCell(row[6], []),
      metadata: safeJsonParse(row[7], {})
    }
  };
}


// 4. DRIVE STORAGE & UTILS

function getOrCreateDataFolder() {
  const folders = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(CONFIG.DRIVE_FOLDER_NAME);
}

function saveJsonToDrive(fileName, dataObj) {
  if (!dataObj || (Array.isArray(dataObj) && dataObj.length === 0)) return '';
  const folder = getOrCreateDataFolder();
  const file = folder.createFile(fileName, JSON.stringify(dataObj), MimeType.PLAIN_TEXT);
  if (CONFIG.ALLOW_DOMAIN_LINK_SHARING) {
    try { file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  }
  return file.getId();
}

function deleteFileFromDrive(fileId) {
  if (fileId && typeof fileId === 'string' && fileId.length > 20) {
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
  }
}

function getJsonFromDriveOrCell(cellValue, fallback) {
  const safeFallback = fallback || [];
  if (!cellValue) return safeFallback;
  const isDriveId = typeof cellValue === 'string' && !cellValue.startsWith('[') && !cellValue.startsWith('{');
  if (isDriveId) {
    try {
      return JSON.parse(DriveApp.getFileById(cellValue).getBlob().getDataAsString());
    } catch (e) { return safeFallback; }
  }
  return safeJsonParse(cellValue, safeFallback);
}

function safeJsonParse(value, fallback) {
  try { return JSON.parse(value || JSON.stringify(fallback || {})); } 
  catch (e) { return fallback; }
}

function putCacheSafe(key, valueObj, ttlSeconds) {
  try {
    const serialized = JSON.stringify(valueObj);
    if (serialized.length <= MAX_CACHE_VALUE_CHARS) {
      CACHE.put(key, serialized, ttlSeconds);
    }
  } catch (e) {}
}

function trimPreviewRow(row) {
  if (!row || typeof row !== 'object') return row;
  const trimmed = {};
  const keys = Object.keys(row);

  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k === 'rawRows') continue; // very large field, not needed for sneak peek
    const v = row[k];
    if (typeof v === 'string') {
      trimmed[k] = v.length > 120 ? v.slice(0, 120) + '...' : v;
    } else {
      trimmed[k] = v;
    }
  }
  return trimmed;
}

function compactSummaryMetadata(meta) {
  const safeMeta = meta && typeof meta === 'object' ? meta : {};
  const compact = {
    engineerName: safeMeta.engineerName || '',
    processedRecords: Number(safeMeta.processedRecords || 0),
    summaryStats: safeMeta.summaryStats || null
  };

  if (Array.isArray(safeMeta.previewData)) {
    compact.previewData = safeMeta.previewData.slice(0, 20).map(trimPreviewRow);
  } else {
    compact.previewData = [];
  }
  return compact;
}


// 5. IDENTITY & LOGGING

function formatDisplayName(value) {
  if (!value) return '';
  return String(value).split(/[\s._-]+/).filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
}

function getUserInfo() {
  try {
    const user = Session.getActiveUser();
    const email = String(user.getEmail() || '').trim();
    let baseName = email ? email.split('@')[0].replace(/[._0-9]/g, ' ') : 'Workspace User';
    return {
      success: true,
      data: { userId: email || 'unknown-user', name: baseName, displayName: formatDisplayName(baseName), isAuthenticated: Boolean(email) }
    };
  } catch (e) {
    return { success: false, error: 'Authentication failed: ' + e.message };
  }
}

function initializeSpreadsheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetConfigs = [
      { name: getSheetName('SM'), headers: ['id', 'userId', 'uploadDate', 'fileName', 'dataType', 'rawDataId', 'processedDataId', 'metadata'] },
      { name: getSheetName('SA'), headers: ['id', 'userId', 'uploadDate', 'fileName', 'dataType', 'rawDataId', 'processedDataId', 'metadata'] },
      { name: CONFIG.USERS_SHEET_NAME, headers: ['userId', 'name', 'displayName', 'lastAccess', 'uploadCount'] },
      { name: CONFIG.LAST_MODIFIED_SHEET_NAME, headers: ['timestamp', 'userId', 'userName', 'userDisplayName', 'action', 'fileName', 'dataType', 'details'] }
    ];

    sheetConfigs.forEach(cfg => {
      let sheet = ss.getSheetByName(cfg.name);
      if (!sheet) sheet = ss.insertSheet(cfg.name);
      if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers]);
    });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

function updateUserStats(userId, name, displayName, spreadsheet) {
  try {
    const sheet = spreadsheet.getSheetByName(CONFIG.USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === userId) { rowIndex = i + 1; break; }
    }
    const now = new Date().toISOString();
    if (rowIndex === -1) {
      sheet.appendRow([userId, name, displayName, now, 1]);
    } else {
      const currentCount = Number(data[rowIndex - 1][4] || 0);
      sheet.getRange(rowIndex, 2, 1, 4).setValues([[name, displayName, now, currentCount + 1]]);
    }
  } catch (e) {}
}

function updateLastModified(userId, userName, userDisplayName, fileName, dataType, action, details, spreadsheet) {
  try {
    const sheet = spreadsheet.getSheetByName(CONFIG.LAST_MODIFIED_SHEET_NAME);
    sheet.appendRow([new Date().toISOString(), userId, userName, userDisplayName, action, fileName, dataType, details]);
    cleanUpLastModified(dataType, 50, spreadsheet);
  } catch (e) {}
}

function getLastModifiedInfo(dataType) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.LAST_MODIFIED_SHEET_NAME);
    if (!sheet) return { success: true, data: null };
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: null };

    let latest = null;
    for (let i = data.length - 1; i >= 1; i--) {
      if (!dataType || data[i][6] === dataType) { latest = data[i]; break; }
    }
    if (!latest) return { success: true, data: null };

    return {
      success: true,
      data: { timestamp: latest[0], userId: latest[1], userName: latest[2], userDisplayName: latest[3], action: latest[4], fileName: latest[5], dataType: latest[6], details: latest[7] }
    };
  } catch (e) { return { success: false, error: e.message }; }
}

function cleanUpLastModified(dataType, maxKeep, spreadsheet) {
  try {
    const sheet = spreadsheet.getSheetByName(CONFIG.LAST_MODIFIED_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    if (data.length <= maxKeep + 1) return;

    const rows = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][6] === dataType) rows.push({ index: i + 1, time: new Date(data[i][0]).getTime() });
    }
    if (rows.length <= maxKeep) return;

    rows.sort((a, b) => b.time - a.time);
    const toDelete = rows.slice(maxKeep).sort((a, b) => b.index - a.index);
    toDelete.forEach(row => sheet.deleteRow(row.index));
  } catch (e) {}
}

function cleanUpOldData(system, maxKeep, spreadsheet) {
  try {
    const sheet = spreadsheet.getSheetByName(getSheetName(system));
    const data = sheet.getDataRange().getValues();
    if (data.length <= maxKeep + 1) return;

    const rows = [];
    for (let i = 1; i < data.length; i++) {
      rows.push({ index: i + 1, time: new Date(data[i][2]).getTime(), rawId: data[i][5], procId: data[i][6] });
    }
    if (rows.length <= maxKeep) return;

    rows.sort((a, b) => b.time - a.time);
    const toDelete = rows.slice(maxKeep).sort((a, b) => b.index - a.index);

    toDelete.forEach(row => {
      deleteFileFromDrive(row.rawId);
      deleteFileFromDrive(row.procId);
      sheet.deleteRow(row.index);
    });
  } catch (e) {}
}

// 6. V4.0 BACKWARD COMPATIBILITY BRIDGES
 
function getUserUploadedData(limit, dataType) {
  const system = getSystemType(dataType);
  return getUploadedDataSummaryFast(system, limit, dataType);
}

function getUserUploadedDataSummary(limit, dataType, includeAll) {
  const system = getSystemType(dataType);
  return getUploadedDataSummaryFast(system, limit, dataType);
}

function getUploadedDataById(dataId, includeAll, dataType) {
  const system = getSystemType(dataType);
  return getByIdFast(system, dataId);
}

function getLatestUserUploadedData(dataType) {
  const system = getSystemType(dataType);
  return getLatestDataFast(system, dataType);
}
