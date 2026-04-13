/**
 * Globe RSC Network Delta Engine - Backend API
 * Version: 3.2 - Antigravity Edition (Scoped History, Safe Lock, Preview Slicing)
 */

const CONFIG = {
  DATA_SHEET_NAME: 'UploadedData',
  USERS_SHEET_NAME: 'Users',
  LAST_MODIFIED_SHEET_NAME: 'LastModified',
  DRIVE_FOLDER_NAME: 'GLOBE RSC',
  // Safer default: keep files private unless you explicitly want domain-link sharing.
  ALLOW_DOMAIN_LINK_SHARING: false
};

// --- WEB APP ENTRY ---

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

      case 'getData':
        response = getUserUploadedData(request.limit, request.dataType);
        break;

      case 'getDataSummary':
        response = getUploadedDataSummary(
          request.limit,
          request.dataType,
          parseBoolean(request.includeAll)
        );
        break;

      case 'getDataById':
        response = getUploadedDataById(
          request.dataId,
          parseBoolean(request.includeAll),
          request.dataType || ''
        );
        break;

      case 'getLatestData':
        response = getLatestUserUploadedData(request.dataType || '');
        break;

      case 'deleteData':
        response = deleteUploadedData(request.dataId);
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

// --- DRIVE STORAGE HELPERS ---

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
    try {
      file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      Logger.log('Sharing Error: ' + e.message);
    }
  }

  return file.getId();
}

function deleteFileFromDrive(fileId) {
  if (fileId && typeof fileId === 'string' && fileId.length > 20) {
    try {
      DriveApp.getFileById(fileId).setTrashed(true);
    } catch (e) {
      Logger.log('Failed to trash file: ' + e.message);
    }
  }
}

function getJsonFromDriveOrCell(cellValue, fallback) {
  const safeFallback = fallback || [];
  if (!cellValue) return safeFallback;

  const isDriveId = typeof cellValue === 'string' &&
    !cellValue.startsWith('[') &&
    !cellValue.startsWith('{');

  if (isDriveId) {
    try {
      const file = DriveApp.getFileById(cellValue);
      return JSON.parse(file.getBlob().getDataAsString());
    } catch (e) {
      return safeFallback;
    }
  }

  return safeJsonParse(cellValue, safeFallback);
}

// --- IDENTITY ---

function formatDisplayName(value) {
  if (!value) return '';
  return String(value)
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(function (part) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

function getUserInfo() {
  try {
    const user = Session.getActiveUser();
    const email = String(user.getEmail() || '').trim();

    let baseName = 'Workspace User';
    if (email) baseName = email.split('@')[0].replace(/[._0-9]/g, ' ');

    return {
      success: true,
      data: {
        userId: email || 'unknown-user',
        name: baseName,
        displayName: formatDisplayName(baseName),
        isAuthenticated: Boolean(email)
      }
    };
  } catch (e) {
    return { success: false, error: 'Authentication failed: ' + e.message };
  }
}

// --- SHEETS CORE ---

function initializeSpreadsheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetConfigs = [
      {
        name: CONFIG.DATA_SHEET_NAME,
        headers: ['id', 'userId', 'uploadDate', 'fileName', 'dataType', 'rawDataId', 'processedDataId', 'metadata']
      },
      {
        name: CONFIG.USERS_SHEET_NAME,
        headers: ['userId', 'name', 'displayName', 'lastAccess', 'uploadCount']
      },
      {
        name: CONFIG.LAST_MODIFIED_SHEET_NAME,
        headers: ['timestamp', 'userId', 'userName', 'userDisplayName', 'action', 'fileName', 'dataType', 'details']
      }
    ];

    sheetConfigs.forEach(function (cfg) {
      let sheet = ss.getSheetByName(cfg.name);
      if (!sheet) sheet = ss.insertSheet(cfg.name);
      ensureHeaderRow(sheet, cfg.headers);
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function storeUploadedData(fileName, dataType, rawData, processedData, metadata) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    lockAcquired = lock.tryLock(15000);
    if (!lockAcquired) {
      return { success: false, error: 'Database busy. Please try again.' };
    }

    initializeSpreadsheet();

    const userInfoRes = getUserInfo();
    if (!userInfoRes.success) return userInfoRes;
    const userInfo = userInfoRes.data;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = ss.getSheetByName(CONFIG.DATA_SHEET_NAME);

    const timestamp = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd_HHmmss');
    const safeEngineerName = String(userInfo.displayName || 'Workspace_User').replace(/[^a-zA-Z0-9]/g, '_');

    const rawId = saveJsonToDrive('RAW_' + safeEngineerName + '_' + timestamp + '.json', rawData);
    const procId = saveJsonToDrive('PROCESSED_' + safeEngineerName + '_' + timestamp + '.json', processedData);

    const cleanMetadata = metadata || {};
    cleanMetadata.engineerName = userInfo.displayName;
    if (Array.isArray(processedData)) {
      cleanMetadata.processedRecords = processedData.length;
      cleanMetadata.previewData = processedData.slice(0, 20);
    }

    dataSheet.appendRow([
      Utilities.getUuid(),
      userInfo.userId,
      new Date().toISOString(),
      fileName,
      dataType,
      rawId,
      procId,
      JSON.stringify(cleanMetadata)
    ]);

    updateUserStats(userInfo.userId, userInfo.name, userInfo.displayName, ss);
    updateLastModified(
      userInfo.userId,
      userInfo.name,
      userInfo.displayName,
      fileName,
      dataType,
      'upload',
      'Processed ' + (Array.isArray(processedData) ? processedData.length : 0) + ' rows',
      ss
    );

    cleanUpOldData(dataType, 15, ss);

    return { success: true, message: 'Stored successfully' };
  } catch (e) {
    return { success: false, error: 'Storage Error: ' + e.message };
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

// --- QUERY HELPERS ---

function getUserDataRows(userId, dataType, options) {
  const safeDataType = dataType || '';
  const opts = options || {};
  const includeAll = parseBoolean(opts.includeAll);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.DATA_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  return data.slice(1)
    .filter(function (row) {
      const userMatch = includeAll || row[1] === userId;
      const typeMatch = !safeDataType || row[4] === safeDataType;
      return userMatch && typeMatch;
    })
    .sort(function (a, b) {
      return new Date(b[2]).getTime() - new Date(a[2]).getTime();
    });
}

function buildStoredDataSummary(row) {
  const metadata = safeJsonParse(row[7], {});
  return {
    id: row[0],
    userId: row[1],
    uploadDate: row[2],
    fileName: row[3],
    dataType: row[4],
    metadata: metadata,
    processedCount: metadata.processedRecords || 0
  };
}

// --- FETCHERS ---

function getUserUploadedData(limit, dataType) {
  try {
    const lim = Number(limit || 50);
    const userInfoRes = getUserInfo();
    if (!userInfoRes.success) return userInfoRes;

    const rows = getUserDataRows(userInfoRes.data.userId, dataType || '', { includeAll: false })
      .slice(0, lim)
      .map(function (row) {
        return {
          id: row[0],
          userId: row[1],
          uploadDate: row[2],
          fileName: row[3],
          dataType: row[4],
          rawData: getJsonFromDriveOrCell(row[5], []),
          processedData: getJsonFromDriveOrCell(row[6], []),
          metadata: safeJsonParse(row[7], {})
        };
      });

    return { success: true, data: rows };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getUploadedDataSummary(limit, dataType, includeAll) {
  try {
    const lim = Number(limit || 50);
    const userInfoRes = getUserInfo();
    if (!userInfoRes.success) return userInfoRes;

    const rows = getUserDataRows(
      userInfoRes.data.userId,
      dataType || '',
      { includeAll: parseBoolean(includeAll) }
    );

    return {
      success: true,
      data: rows.slice(0, lim).map(buildStoredDataSummary)
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getUploadedDataById(dataId, includeAll, dataType) {
  try {
    const userInfoRes = getUserInfo();
    if (!userInfoRes.success) return userInfoRes;

    const rows = getUserDataRows(
      userInfoRes.data.userId,
      dataType || '',
      { includeAll: parseBoolean(includeAll) }
    );

    const row = rows.find(function (r) { return r[0] === dataId; });
    if (!row) return { success: false, error: 'Stored data not found or access denied' };

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
  } catch (e) {
    return { success: false, error: 'Failed to retrieve stored data: ' + e.message };
  }
}

function getLatestUserUploadedData(dataType) {
  try {
    const summary = getUploadedDataSummary(1, dataType || '', false);
    if (!summary.success) return summary;
    if (!summary.data || summary.data.length === 0) return { success: true, data: null };

    return getUploadedDataById(summary.data[0].id, false, dataType || '');
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getLastModifiedInfo(dataType) {
  try {
    initializeSpreadsheet();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.LAST_MODIFIED_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: null };

    const safeType = dataType || '';
    let latest = null;
    for (let i = data.length - 1; i >= 1; i--) {
      if (!safeType || data[i][6] === safeType) {
        latest = data[i];
        break;
      }
    }
    if (!latest) return { success: true, data: null };

    return {
      success: true,
      data: {
        timestamp: latest[0],
        userId: latest[1],
        userName: latest[2],
        userDisplayName: latest[3],
        action: latest[4],
        fileName: latest[5],
        dataType: latest[6],
        details: latest[7]
      }
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function deleteUploadedData(dataId) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    lockAcquired = lock.tryLock(10000);
    if (!lockAcquired) return { success: false, error: 'Database busy.' };

    const userInfoRes = getUserInfo();
    if (!userInfoRes.success) return userInfoRes;
    const userInfo = userInfoRes.data;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.DATA_SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === dataId && data[i][1] === userInfo.userId) {
        deleteFileFromDrive(data[i][5]);
        deleteFileFromDrive(data[i][6]);
        sheet.deleteRow(i + 1);
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

// --- LOGGING + CLEANUP ---

function updateUserStats(userId, name, displayName, spreadsheet) {
  try {
    const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === userId) {
        rowIndex = i + 1;
        break;
      }
    }

    const now = new Date().toISOString();
    if (rowIndex === -1) {
      sheet.appendRow([userId, name, displayName, now, 1]);
    } else {
      const currentCount = Number(data[rowIndex - 1][4] || 0);
      sheet.getRange(rowIndex, 2, 1, 4).setValues([[name, displayName, now, currentCount + 1]]);
    }
  } catch (e) {
    Logger.log('User Stats Error: ' + e.message);
  }
}

function updateLastModified(userId, userName, userDisplayName, fileName, dataType, action, details, spreadsheet) {
  try {
    const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.LAST_MODIFIED_SHEET_NAME);

    sheet.appendRow([
      new Date().toISOString(),
      userId,
      userName,
      userDisplayName,
      action,
      fileName,
      dataType,
      details
    ]);

    cleanUpLastModified(dataType, 50, ss);
  } catch (e) {
    Logger.log('LastModified Log Error: ' + e.message);
  }
}

function cleanUpLastModified(dataType, maxKeep, spreadsheet) {
  try {
    const safeMax = Number(maxKeep || 50);
    const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.LAST_MODIFIED_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    if (data.length <= safeMax + 1) return;

    const rows = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][6] === dataType) {
        rows.push({ index: i + 1, time: new Date(data[i][0]).getTime() });
      }
    }
    if (rows.length <= safeMax) return;

    rows.sort(function (a, b) { return b.time - a.time; });
    const toDelete = rows.slice(safeMax).sort(function (a, b) { return b.index - a.index; });

    toDelete.forEach(function (row) { sheet.deleteRow(row.index); });
  } catch (e) {
    Logger.log('FIFO Log Error: ' + e.message);
  }
}

function cleanUpOldData(dataType, maxKeep, spreadsheet) {
  try {
    const safeMax = Number(maxKeep || 15);
    const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.DATA_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    if (data.length <= safeMax + 1) return;

    const rows = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][4] === dataType) {
        rows.push({
          index: i + 1,
          time: new Date(data[i][2]).getTime(),
          rawId: data[i][5],
          procId: data[i][6]
        });
      }
    }
    if (rows.length <= safeMax) return;

    rows.sort(function (a, b) { return b.time - a.time; });
    const toDelete = rows.slice(safeMax).sort(function (a, b) { return b.index - a.index; });

    toDelete.forEach(function (row) {
      deleteFileFromDrive(row.rawId);
      deleteFileFromDrive(row.procId);
      sheet.deleteRow(row.index);
    });
  } catch (e) {
    Logger.log('FIFO Data Error: ' + e.message);
  }
}

// --- UTILS ---

function ensureHeaderRow(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value || JSON.stringify(fallback || {}));
  } catch (e) {
    return fallback;
  }
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

// --- BACKWARD COMPATIBILITY ---

function getUserUploadedDataSummary(limit, dataType) {
  return getUploadedDataSummary(limit || 50, dataType || '', false);
}
