import { useState, useMemo, useEffect, useRef, useDeferredValue, useTransition } from 'react';
import localforage from 'localforage';
import useDarkMode from '../../hooks/useDarkMode';
import useSearchDebounce from '../../hooks/useSearchDebounce';
import useSmartProgress from '../../hooks/useSmartProgress';
import AnalyticsDashboard from '../../Dashboard/AnalyticsDashboard';
import MapVisualizer from '../../Map/MapVisualizer';
import globeLogoDark from '../../assets/Globe_LogoW.png';
import globeLogoLight from '../../assets/Globe_LogoB.png';
import checkDark from '../../assets/checkDark.png';
import checkLight from '../../assets/checkLight.png';
import verifiedDark from '../../assets/verifiedDark.png';
import verifiedLight from '../../assets/verifiedLight.png';
import glitterDark from '../../assets/glitterDark.png';
import glitterLight from '../../assets/glitterLight.png';
import removedDark from '../../assets/removedDark.png';
import removedLight from '../../assets/removedLight.png';
import warningDark from '../../assets/warningDark.png';
import warningLight from '../../assets/warningLight.png';
import search from '../../assets/search.png';
import fileDark from '../../assets/fileDark.png';
import fileLight from '../../assets/fileLight.png';

import { useNavigate } from "react-router-dom";
import { FixedSizeList as List } from 'react-window';

import DashboardLayout from '../../components/DashboardLayout';
import DashboardHeaderActions from '../../components/common/DashboardHeaderActions';
import useStormMasterlistProcessor from '../../features/storm-masterlist/hooks/useStormMasterlistProcessor';
import { exportStormMasterlist } from '../../features/storm-masterlist/services/stormMasterlistExport';
import {
  storeUploadedData,
  getUserUploadedDataSummary,
  getUploadedDataById,
  getUserInfo,
  getLastModifiedInfo,
  getCachedUserInfo
} from '../../services/googleAppsScript';
import '../../styles/Dashboard_styles.css';
import './SM_styles.css';

const ICONS = {
  checkDark, checkLight, verifiedDark, verifiedLight,
  glitterDark, glitterLight, removedDark, removedLight,
  warningDark, warningLight, search, fileDark, fileLight
};

export default function SMDashboard() {
  const [monitorFile1, setMonitorFile1] = useState(null);
  const [monitorFile2, setMonitorFile2] = useState(null);
  const [results, setResults] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isStoredDataLoading, setIsStoredDataLoading] = useState(false);
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true);
  const [isRefreshingSavedData, setIsRefreshingSavedData] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const navigate = useNavigate();
  const [isDarkMode, toggleTheme] = useDarkMode();
  const { searchTerm, setSearchTerm, debouncedTerm, isPending: isSearchPending } = useSearchDebounce();
  const { isLoading, isAiLoading, scanFiles, runAiCommand } = useStormMasterlistProcessor();
  const [isAiLoadingFallback, setIsAiLoadingFallback] = useState(false);
  const isAiLoadingVisible = isAiLoading || isAiLoadingFallback;
  const pageIsLoading = isLoading || isNavigating || isStoredDataLoading || isInitialDataLoading;
  const globalDatabaseSyncing = isInitialDataLoading || isRefreshingSavedData || isStoredDataLoading;
  const databaseProgress = useSmartProgress(globalDatabaseSyncing);
  const historyLoadProgress = useSmartProgress(isStoredDataLoading);
  const cacheKey = 'storm_masterlist_cache_v1';
  const cacheMetaKey = `${cacheKey}_meta`;
  const cacheDataKey = `${cacheKey}_full`;
  const CACHE_TTL_MS = 5 * 60 * 1000;

  const buildStormSummaryStats = (rows) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    const siteMap = new Map();
    safeRows.forEach((row) => {
      const key = row?.baseLocation;
      if (key && !siteMap.has(key)) siteMap.set(key, row?.matchStatus);
    });

    const statusValues = Array.from(siteMap.values());
    return {
      total: siteMap.size,
      unchanged: statusValues.filter((status) => status === 'UNCHANGED').length,
      new: statusValues.filter((status) => status === 'NEW').length,
      removed: statusValues.filter((status) => status === 'REMOVED').length,
      mismatch: statusValues.filter((status) => status === 'MISMATCH').length
    };
  };

  // Backend integration state
  const [storedData, setStoredData] = useState([]);
  const [userInfo, setUserInfo] = useState(() => getCachedUserInfo());
  const [lastModifiedInfo, setLastModifiedInfo] = useState(null);
  const [persistedSummaryStats, setPersistedSummaryStats] = useState(null);

  const [showPreviewMenu, setShowPreviewMenu] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [selectedSite, setSelectedSite] = useState({ lat: 7.05568, lng: 125.5469, zoom: 15 });
  const [showBigMap, setShowBigMap] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedRowDetails, setSelectedRowDetails] = useState(null);
  const [mainListSize, setMainListSize] = useState({ width: '100%', height: 600 });
  const [workerFilteredIndices, setWorkerFilteredIndices] = useState([]);
  const [workerReady, setWorkerReady] = useState(false);
  const [isWorkerBusy, setIsWorkerBusy] = useState(false);
  const [isFilterPending, startFilterTransition] = useTransition();

  const [aiCommand, setAiCommand] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  const [themeModal, setThemeModal] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    input: false,
    inputValue: '',
    confirmText: 'OK',
    cancelText: null,
    onConfirm: null,
    onCancel: null
  });

  const showThemeModal = ({ title, message, type = 'info', input = false, inputValue = '', confirmText = 'OK', cancelText = null, onConfirm = null, onCancel = null }) => {
    setThemeModal({ visible: true, title, message, type, input, inputValue, confirmText, cancelText, onConfirm, onCancel });
  };

  const closeThemeModal = () => setThemeModal(prev => ({ ...prev, visible: false, inputValue: '' }));

  const handleThemeModalConfirm = () => {
    if (themeModal.input) {
      themeModal.onConfirm?.(themeModal.inputValue);
    } else {
      themeModal.onConfirm?.();
    }
    closeThemeModal();
  };

  const handleThemeModalCancel = () => {
    themeModal.onCancel?.();
    closeThemeModal();
  };

  // Glass Toast Notification State
  const [toast, setToast] = useState({ visible: false, title: '', message: '', type: 'info', isClosing: false });
  const toastTimeoutRef = useRef(null);
  const toastStartTimeRef = useRef(0);
  const toastRemainingTimeRef = useRef(5000);

  const showToast = (title, message, type = 'info') => {
    setToast({ visible: true, title, message, type, isClosing: false });
    toastRemainingTimeRef.current = 5000;
    toastStartTimeRef.current = Date.now();
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => closeToast(), 5000);
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, isClosing: true }));
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false, isClosing: false }));
    }, 500); 
  };

  const handleToastMouseEnter = () => {
    if (toast.isClosing) return;
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      const elapsed = Date.now() - toastStartTimeRef.current;
      toastRemainingTimeRef.current = Math.max(0, toastRemainingTimeRef.current - elapsed);
    }
  };

  const handleToastMouseLeave = () => {
    if (toast.isClosing) return;
    toastStartTimeRef.current = Date.now();
    toastTimeoutRef.current = setTimeout(() => closeToast(), toastRemainingTimeRef.current);
  };

  const [loadedDataSource, setLoadedDataSource] = useState(null);
  const [isTableRevealActive, setIsTableRevealActive] = useState(false);
  const wasDatabaseSyncingRef = useRef(false);

  const applyStoredProcessedData = (item) => {
    if (!item) return;
    const safeProcessedData = Array.isArray(item.processedData)
      ? item.processedData.filter((row) => row && typeof row === 'object')
      : [];
    setResults(safeProcessedData);
    setPersistedSummaryStats(item.metadata?.summaryStats || null);
    setFilterStatus('ALL');
    setSelectedRowDetails(null);
    setShowHistoryPanel(false);
    
    setLoadedDataSource({
      date: new Date(item.uploadDate || Date.now()).toLocaleDateString(),
      time: new Date(item.uploadDate || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      engineerName: item.metadata?.engineerName || 'Unknown User'
    });
  };
  
  const [chatHistory, setChatHistory] = useState([
    { sender: 'ai', text: "Hello Adrian! I'm your veRiSynC AI Copilot. Ask me to list sites or update remarks!" }
  ]);
  const chatContainerRef = useRef(null);
  const sidebarTopRef = useRef(null);
  const listContainerRef = useRef(null);
  const filterWorkerRef = useRef(null);
  const filterRequestIdRef = useRef(0);
  const workerPerfRef = useRef(new Map());

  const currentLogo = isDarkMode ? globeLogoDark : globeLogoLight;

  const saveDashboardCache = async ({
    nextUserInfo = null,
    nextStoredData = [],
    nextLastModifiedInfo = null,
    latestStoredData = null,
    latestPreviewData = [],
    nextSummaryStats = null
  }) => {
    const timestamp = Date.now();
    await localforage.setItem(cacheMetaKey, {
      userInfo: nextUserInfo,
      storedData: nextStoredData,
      lastModifiedInfo: nextLastModifiedInfo,
      latestPreviewData: Array.isArray(latestPreviewData) ? latestPreviewData : [],
      persistedSummaryStats: nextSummaryStats,
      timestamp
    });

    if (latestStoredData) {
      await localforage.setItem(cacheDataKey, {
        latestStoredData,
        timestamp
      });
    }
  };

  useEffect(() => {
    if (sidebarTopRef.current) {
      sidebarTopRef.current.scrollLeft = 0;
    }
  }, [showHistoryPanel, selectedRowDetails]);

  useEffect(() => {
    const isDatabaseSyncing = isInitialDataLoading || isStoredDataLoading || isRefreshingSavedData;
    if (wasDatabaseSyncingRef.current && !isDatabaseSyncing && results.length > 0) {
      setIsTableRevealActive(true);
      const timeout = setTimeout(() => setIsTableRevealActive(false), 360);
      return () => clearTimeout(timeout);
    }
    if (isDatabaseSyncing) {
      setIsTableRevealActive(false);
    }
    wasDatabaseSyncingRef.current = isDatabaseSyncing;
  }, [isInitialDataLoading, isStoredDataLoading, isRefreshingSavedData, results.length]);

  useEffect(() => {
    if (!listContainerRef.current || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setMainListSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    observer.observe(listContainerRef.current);
    return () => observer.disconnect();
  }, [results.length]);

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      setWorkerReady(false);
      return undefined;
    }

    const worker = new Worker(new URL('../../workers/tableFilter.worker.js', import.meta.url), { type: 'module' });
    filterWorkerRef.current = worker;
    setWorkerReady(true);

    worker.onmessage = (event) => {
      const payload = event.data || {};
      const perfMeta = workerPerfRef.current.get(payload.requestId);
      if (perfMeta) {
        workerPerfRef.current.delete(payload.requestId);
      }
      if (payload.type === 'RESULT_STORM' && payload.requestId === filterRequestIdRef.current) {
        if (perfMeta) {
          const durationMs = performance.now() - perfMeta.startedAt;
          console.info(
            `[Perf][Storm][Worker] ${durationMs.toFixed(1)}ms | rows=${perfMeta.rowCount} | matched=${Array.isArray(payload.indices) ? payload.indices.length : 0} | term="${perfMeta.term}" | filter=${perfMeta.filterStatus}`
          );
        }
        setWorkerFilteredIndices(Array.isArray(payload.indices) ? payload.indices : []);
        setIsWorkerBusy(false);
      }
      if (payload.type === 'WORKER_ERROR' && payload.requestId === filterRequestIdRef.current) {
        if (perfMeta) {
          const durationMs = performance.now() - perfMeta.startedAt;
          console.warn(
            `[Perf][Storm][Worker][Error] ${durationMs.toFixed(1)}ms | rows=${perfMeta.rowCount} | term="${perfMeta.term}" | filter=${perfMeta.filterStatus}`
          );
        }
        setIsWorkerBusy(false);
      }
    };

    worker.onerror = () => {
      setWorkerReady(false);
      setIsWorkerBusy(false);
    };

    return () => {
      worker.terminate();
      filterWorkerRef.current = null;
      setWorkerReady(false);
    };
  }, []);
  // Load user info and stored data on mount
  useEffect(() => {
    let isMounted = true;
    const bootLoaderTimeout = setTimeout(() => {
      if (isMounted) setIsInitialDataLoading(false);
    }, 1500);

    const loadUserData = async () => {
      // 1. INSTANT CACHE LOAD (IndexedDB - 0 Seconds)
      let hasFreshCache = false;
      const summaryPromise = getUserUploadedDataSummary(10, 'storm-masterlist', true);
      const lastModifiedPromise = getLastModifiedInfo('storm-masterlist');
      const userInfoPromise = getUserInfo().catch((err) => {
        console.warn('Failed to refresh user info:', err);
        return null;
      });

      try {
        const cachedMeta = await localforage.getItem(cacheMetaKey);
        const isFresh = Boolean(cachedMeta?.timestamp) && (Date.now() - cachedMeta.timestamp) < CACHE_TTL_MS;

        if (isFresh && isMounted) {
          hasFreshCache = true;
          setUserInfo(cachedMeta.userInfo || getCachedUserInfo() || null);
          setStoredData(cachedMeta.storedData || []);
          setLastModifiedInfo(cachedMeta.lastModifiedInfo || null);
          setPersistedSummaryStats(cachedMeta.persistedSummaryStats || null);

          if (Array.isArray(cachedMeta.latestPreviewData) && cachedMeta.latestPreviewData.length > 0) {
            setResults(cachedMeta.latestPreviewData);
          }

          localforage.getItem(cacheDataKey).then((cachedData) => {
            const sameSnapshot = cachedData?.timestamp && cachedMeta?.timestamp && cachedData.timestamp === cachedMeta.timestamp;
            if (isMounted && sameSnapshot && cachedData?.latestStoredData) {
              applyStoredProcessedData(cachedData.latestStoredData);
            }
          }).catch((err) => {
            console.warn('IndexedDB Full Cache Read Failed', err);
          });

          setIsInitialDataLoading(false);
        } else if (cachedMeta && !isFresh) {
          await Promise.all([
            localforage.removeItem(cacheMetaKey),
            localforage.removeItem(cacheDataKey)
          ]);
        } else if (!cachedMeta) {
          await localforage.removeItem(cacheDataKey);
        }
      } catch (err) {
        console.warn('IndexedDB Read Failed', err);
      }

      // 2. FETCH SUMMARY & PREVIEW (Google Sheets)
      try {
        setIsRefreshingSavedData(true);

        const [storedDataList, lastModified] = await Promise.all([
          summaryPromise,
          lastModifiedPromise
        ]);

        if (!isMounted) return;

        setStoredData(storedDataList);
        setLastModifiedInfo(lastModified);

        const latestSummary = storedDataList.length > 0 ? storedDataList[0] : null;
        const previewData = Array.isArray(latestSummary?.metadata?.previewData) ? latestSummary.metadata.previewData : [];
        const summaryStats = latestSummary?.metadata?.summaryStats || null;

        if (!hasFreshCache && previewData.length > 0) {
          setResults(previewData);
          setPersistedSummaryStats(summaryStats);
          setIsInitialDataLoading(false);
        } else if (!hasFreshCache) {
          setPersistedSummaryStats(null);
          setIsInitialDataLoading(false);
        }

        const userData = await userInfoPromise;
        if (isMounted && userData) {
          setUserInfo(userData);
        }

        // 3. SILENT DRIVE FETCH (Google Drive - Background)
        if (latestSummary) {
          const fullData = await getUploadedDataById(latestSummary.id, true, 'storm-masterlist');

          if (isMounted && fullData) {
            applyStoredProcessedData(fullData);

            await saveDashboardCache({
              nextUserInfo: userData || getCachedUserInfo() || null,
              nextStoredData: storedDataList,
              nextLastModifiedInfo: lastModified,
              latestStoredData: fullData,
              latestPreviewData: previewData,
              nextSummaryStats: fullData?.metadata?.summaryStats || summaryStats
            });
          }
        }
      } catch (err) {
        console.error('Failed to load user data:', err);
      } finally {
        if (isMounted) {
          setIsRefreshingSavedData(false);
          setIsInitialDataLoading(false);
        }
      }
    };

    loadUserData();

    return () => {
      isMounted = false;
      clearTimeout(bootLoaderTimeout);
    };
  }, []);

  const handleFileChange = (e, setFileState) => {
    const file = e.target.files[0];
    if (file) setFileState(file);
  };

  const handleAiExecute = async () => {
    if (!aiCommand.trim()) return;
    
    const userMessage = aiCommand.trim();
    setChatHistory(prev => [...prev, { sender: 'user', text: userMessage }]);
    setAiCommand("");

    const { messages, updatedResults } = await runAiCommand(userMessage, results);
    if (updatedResults) {
      setResults(updatedResults);
    }
    if (messages.length > 0) {
      setChatHistory(prev => [...prev, ...messages]);
    }
    if (typeof window !== 'undefined' && window.__SM_LEGACY_AI_DEBUG__) {

    if (window.google && window.google.script) {
      
      const ignoreWords = [
        "CHANGE", "UPDATE", "SET", "MODIFY", "STATUS", "MAKE", "PUT", "ADD",
        "TO", "FROM", "THE", "IN", "OF", "ON", "FOR", "AND", "WITH",
        "VERIFIED", "NEW", "MISMATCH", "REMOVED", "UNCHANGED", 
        "SITE", "SITES", "REMARK", "REMARKS", "ID", "PLA", "BCF", "NAME",
        "PLEASE", "CAN", "YOU", "COULD", "WOULD", "JUST", "HELP", "ME", "WANT", "NEED",
        "LIST", "SHOW", "FIND", "COUNT", "ALL"
      ];
      
      const searchWords = userMessage
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, ' ') 
        .split(' ')
        .filter(w => w.length > 2 && !ignoreWords.includes(w));
        
      let relevantData = [];
      if (searchWords.length > 0) {
        relevantData = results.filter(r => {
          const rowData = `${r.plaId} ${r.baseLocation} ${r.nmsName}`.toUpperCase();
          return searchWords.some(word => rowData.includes(word));
        });
      }

      let finalDataToSend = relevantData.length > 0 ? relevantData.slice(0, 250) : results.slice(0, 50);

      const lightweightData = finalDataToSend.map(r => ({
        plaId: r.plaId,
        matchStatus: r.matchStatus,
        baseLocation: r.baseLocation,
        nmsName: r.nmsName,
        remarks: r.remarks
      }));

      const dataString = JSON.stringify(lightweightData);
      setIsAiLoadingFallback(true);

      window.google.script.run
        .withSuccessHandler((aiResponse) => {
          setIsAiLoadingFallback(false);
          
          if (!aiResponse) {
            setChatHistory(prev => [...prev, { sender: 'system', text: "AI returned an empty response.", isError: true }]);
            return;
          }

          if (aiResponse.error) {
            setChatHistory(prev => [...prev, { sender: 'system', text: `System Error: ${aiResponse.error}`, isError: true }]);
            return;
          }
          
          const replyText = aiResponse.reply || aiResponse.response || aiResponse.message || aiResponse.text;
          
          if (replyText) {
            setChatHistory(prev => [...prev, { sender: 'ai', text: replyText }]);
          } else if (!aiResponse.mutations || aiResponse.mutations.length === 0) {
            setChatHistory(prev => [...prev, { sender: 'ai', text: `[Raw Output]: ${JSON.stringify(aiResponse)}` }]);
          }

          if (aiResponse.mutations && Array.isArray(aiResponse.mutations) && aiResponse.mutations.length > 0) {
            try {
              let actualChangesCount = 0;
              const updatedResults = results.map(row => {
                const change = aiResponse.mutations.find(c => c && c.plaId === row.plaId);
                if (change && change.updates) {
                  actualChangesCount++;
                  const safeStatus = change.updates.matchStatus || row.matchStatus || 'UNCHANGED';
                  const safeRemarks = change.updates.remarks ? `(AI) ${change.updates.remarks}` : row.remarks;
                  
                  return { 
                    ...row, 
                    matchStatus: safeStatus, 
                    remarks: safeRemarks 
                  };
                }
                return row; 
              });
              
              if (actualChangesCount > 0) {
                setResults(updatedResults);
                setChatHistory(prev => [...prev, { sender: 'system', text: `Successfully applied updates to ${actualChangesCount} rows.` }]);
              }
            } catch {
              setChatHistory(prev => [...prev, { sender: 'system', text: `Table protected from corrupted AI data.`, isError: true }]);
            }
          }
        })
        .withFailureHandler((err) => {
          setIsAiLoadingFallback(false);
          setChatHistory(prev => [...prev, { sender: 'system', text: `Network Timeout: ${err.message || err}`, isError: true }]);
        })
        .processAIAgentCommand(userMessage, dataString);
    } else {
      setTimeout(() => {
        setIsAiLoadingFallback(false);
        setChatHistory(prev => [...prev, { sender: 'ai', text: "I'm running locally. Google Apps Script is offline." }]);
      }, 1000);
    }
    }
  };

  const handleSpecificExport = (exportCategory) => {
    setShowExportMenu(false);
    if (results.length === 0) {
      return showThemeModal({
        title: 'No Data',
        message: 'No data available to export.',
        type: 'warning',
        confirmText: 'OK'
      });
    }

    try {
      exportStormMasterlist(results, exportCategory);
    } catch (error) {
      showThemeModal({
        title: 'Export Error',
        message: error.message || String(error),
        type: 'error',
        confirmText: 'OK'
      });
    }
  };

  const handleScan = async () => {
    if (!monitorFile1 || !monitorFile2) {
      return showThemeModal({
        title: 'Missing CSV Files',
        message: 'Please upload both CSV files before scanning.',
        type: 'warning',
        confirmText: 'OK'
      });
    }

    const engineerName = userInfo?.displayName || userInfo?.name || "Workspace User";

    setResults([]);
    setFilterStatus('ALL');
    setSelectedRowDetails(null);
    setShowAiPanel(false);
    setLoadedDataSource(null);

    try {
      const data = await scanFiles(monitorFile1, monitorFile2);
      const safeData = Array.isArray(data) ? data.filter((row) => row && typeof row === 'object') : [];
      const summaryStats = buildStormSummaryStats(safeData);
      setResults(safeData);
      setPersistedSummaryStats(summaryStats);

      const fileNames = `${monitorFile1.name} + ${monitorFile2.name}`;

      storeUploadedData(
        fileNames,
        'storm-masterlist',
        [],
        safeData,
        {
          totalRecords: safeData.length,
          processedRecords: safeData.length,
          dashboardMode: 'storm-masterlist',
          timestamp: new Date().toISOString(),
          engineerName: engineerName,
          summaryStats
        }
      )
        .then(async () => {
          const [updatedStoredData, lastModified] = await Promise.all([
            getUserUploadedDataSummary(10, 'storm-masterlist', true),
            getLastModifiedInfo('storm-masterlist')
          ]);
          setStoredData(updatedStoredData);
          setLastModifiedInfo(lastModified);
          saveDashboardCache({
            nextUserInfo: userInfo || getCachedUserInfo() || null,
            nextStoredData: updatedStoredData,
            nextLastModifiedInfo: lastModified,
            latestStoredData: {
              processedData: safeData,
              fileName: fileNames,
              metadata: { summaryStats }
            },
            latestPreviewData: safeData,
            nextSummaryStats: summaryStats
          }).catch((err) => console.warn('IndexedDB Write Failed', err));
        })
        .catch((storeError) => {
          console.error('Failed to store data:', storeError);
          showThemeModal({
            title: 'Save Warning',
            message: 'Data was processed successfully but failed to save to the database. You can still view the results.',
            type: 'warning',
            confirmText: 'OK'
          });
        });
    } catch (error) {
      showThemeModal({
        title: 'Scan Error',
        message: "Error: " + (error.message || error),
        type: 'error',
        confirmText: 'OK'
      });
    }
  };

  const handleRefreshStoredData = async () => {
    try {
      const [updatedStoredData, lastModified] = await Promise.all([
        getUserUploadedDataSummary(10, 'storm-masterlist', true),
        getLastModifiedInfo('storm-masterlist')
      ]);
      setStoredData(updatedStoredData);
      setLastModifiedInfo(lastModified);
      saveDashboardCache({
        nextUserInfo: userInfo || getCachedUserInfo() || null,
        nextStoredData: updatedStoredData,
        nextLastModifiedInfo: lastModified,
        latestPreviewData: results,
        nextSummaryStats: persistedSummaryStats
      }).catch((err) => console.warn('IndexedDB Write Failed', err));
    } catch (error) {
      console.error('Failed to refresh stored data:', error);
    }
  };

  const handleLoadStoredData = async (item) => {
    try {
      setIsStoredDataLoading(true);
      const fullItem = await getUploadedDataById(item.id, true, 'storm-masterlist');
      applyStoredProcessedData(fullItem);
      saveDashboardCache({
        nextUserInfo: userInfo || getCachedUserInfo() || null,
        nextStoredData: storedData,
        nextLastModifiedInfo: lastModifiedInfo,
        latestStoredData: fullItem,
        latestPreviewData: fullItem?.metadata?.previewData || results,
        nextSummaryStats: fullItem?.metadata?.summaryStats || persistedSummaryStats
      }).catch((err) => console.warn('IndexedDB Write Failed', err));
      
      const dateStr = new Date(fullItem.uploadDate || Date.now()).toLocaleDateString();
      const timeStr = new Date(fullItem.uploadDate || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const engName = fullItem.metadata?.engineerName || 'Unknown User';

      showToast(
        'Data Loaded',
        `Date: ${dateStr}\nTime: ${timeStr}\nRan by: ${engName}`,
        'success'
      );
    } catch (error) {
      console.error('Failed to load stored data:', error);
      showToast('Load Failed', 'Failed to load stored data.', 'error');
    } finally {
      setIsStoredDataLoading(false);
    }
  };

  const renderHistoryLoadingSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ background: 'var(--bg-primary)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <span>Loading data from history...</span>
          <span>{Math.round(historyLoadProgress)}%</span>
        </div>
        <div className="smart-progress-track">
          <div className="smart-progress-fill" style={{ width: `${historyLoadProgress}%` }}></div>
        </div>
      </div>
      {[...Array(4)].map((_, idx) => (
        <div
          key={`sm-history-skeleton-${idx}`}
          style={{
            background: 'var(--bg-primary)',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid var(--border-light)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div className="skeleton-bar" style={{ width: '62%', height: '12px', borderRadius: '4px' }}></div>
            <div className="skeleton-bar" style={{ width: '22%', height: '10px', borderRadius: '4px' }}></div>
          </div>
          <div className="skeleton-bar" style={{ width: '78%', height: '10px', borderRadius: '4px', marginBottom: '10px' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="skeleton-bar" style={{ width: '42%', height: '10px', borderRadius: '4px' }}></div>
            <div className="skeleton-bar" style={{ width: '66px', height: '24px', borderRadius: '12px' }}></div>
          </div>
        </div>
      ))}
    </div>
  );

  const computedStats = useMemo(() => {
    const siteMap = new Map();
    results.forEach(r => {
      // FIX: Use baseLocation as the true unique identifier for sites
      const key = r.baseLocation; 
      if (!siteMap.has(key)) siteMap.set(key, r.matchStatus);
    });

    const statusValues = Array.from(siteMap.values());

    return {
      total: siteMap.size,
      unchanged: statusValues.filter(s => s === 'UNCHANGED').length,
      new: statusValues.filter(s => s === 'NEW').length,
      removed: statusValues.filter(s => s === 'REMOVED').length,
      mismatch: statusValues.filter(s => s === 'MISMATCH').length,
    };
  }, [results]);
  const stats = persistedSummaryStats || computedStats;

  const deferredSearchTerm = useDeferredValue(debouncedTerm);
  const fallbackFilteredIndices = useMemo(() => {
    // Fallback path for environments where Web Workers are unavailable.
    if (workerReady) return [];

    const term = String(deferredSearchTerm || '').trim().toLowerCase();
    const statusOrder = ['NEW', 'MISMATCH', 'UNCHANGED', 'REMOVED'];
    const indexedRows = results.map((row, index) => ({ row, index }));
    const statusFiltered = filterStatus === 'ALL'
      ? indexedRows
      : indexedRows.filter(({ row }) => row.matchStatus === filterStatus);

    return statusFiltered
      .filter(({ row }) => {
        if (!term) return true;
        const searchable = [row.plaId, row.baseLocation, row.remarks, row.nmsName]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase())
          .join(' ');
        return searchable.includes(term);
      })
      .sort((a, b) => {
        const orderA = statusOrder.indexOf(a.row.matchStatus);
        const orderB = statusOrder.indexOf(b.row.matchStatus);
        if (orderA !== orderB) return orderA - orderB;
        const baseA = a.row.baseLocation || '';
        const baseB = b.row.baseLocation || '';
        const baseCompare = baseA.localeCompare(baseB, undefined, { numeric: true, sensitivity: 'base' });
        if (baseCompare === 0) return (a.row.nmsName || '').localeCompare(b.row.nmsName || '');
        return baseCompare;
      })
      .map(({ index }) => index);
  }, [results, filterStatus, deferredSearchTerm, workerReady]);

  useEffect(() => {
    if (!workerReady || !filterWorkerRef.current) return;
    filterWorkerRef.current.postMessage({ type: 'INIT_STORM', rows: results });
  }, [results, workerReady]);

  useEffect(() => {
    if (!workerReady || !filterWorkerRef.current) return;
    const requestId = ++filterRequestIdRef.current;
    const term = String(deferredSearchTerm || '');
    workerPerfRef.current.set(requestId, {
      startedAt: performance.now(),
      rowCount: results.length,
      term,
      filterStatus
    });
    setIsWorkerBusy(true);
    filterWorkerRef.current.postMessage({
      type: 'QUERY_STORM',
      requestId,
      term,
      filterStatus
    });
  }, [workerReady, deferredSearchTerm, filterStatus, results.length]);

  const allResultIndices = useMemo(() => results.map((_, index) => index), [results]);
  const visibleResultIndices = useMemo(() => {
    if (!workerReady) return fallbackFilteredIndices;
    // Bypass worker only when showing full, unfiltered results with no search term.
    if (
      workerFilteredIndices.length === 0 &&
      results.length > 0 &&
      !deferredSearchTerm &&
      filterStatus === 'ALL'
    ) {
      return allResultIndices;
    }
    return workerFilteredIndices;
  }, [workerReady, fallbackFilteredIndices, workerFilteredIndices, results.length, deferredSearchTerm, filterStatus, allResultIndices]);
  const deferredVisibleResultIndices = useDeferredValue(visibleResultIndices);
  const filteredResults = useMemo(
    () => deferredVisibleResultIndices.map((index) => results[index]).filter(Boolean),
    [deferredVisibleResultIndices, results]
  );
  const mapFilteredResults = useDeferredValue(filteredResults);

  const isSearchUpdating = isSearchPending || deferredSearchTerm !== debouncedTerm || isWorkerBusy || isFilterPending;

  const getPreviewLabel = (status) => {
    switch(status) {
      case 'ALL': return 'Storm Masterlist';
      case 'NEW': return 'New Sites Only';
      case 'REMOVED': return 'Removed Only';
      case 'MISMATCH': return 'Mismatches Only';
      case 'UNCHANGED': return 'Unchanged Only';
      default: return status;
    }
  };

  const handleFilterStatusChange = (nextStatus) => {
    startFilterTransition(() => {
      setFilterStatus(nextStatus);
    });
  };

  const VirtualizedRow = ({ index, style }) => {
    const resultIndex = visibleResultIndices[index];
    const row = results[resultIndex];
    if (!row) return null;

    const isExactRow = selectedSite?.nmsName === row.nmsName;
    const isSameGroup = selectedSite?.baseLocation === row.baseLocation && !isExactRow;

    const nextRow = results[visibleResultIndices[index + 1]];
    const prevRow = results[visibleResultIndices[index - 1]];
    const isLastOfGroup = !nextRow || nextRow.baseLocation !== row.baseLocation;
    const isFirstOfGroup = !prevRow || prevRow.baseLocation !== row.baseLocation;

    const rowStyle = {
      ...style,
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      boxSizing: 'border-box',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      borderBottom: isLastOfGroup
        ? (isDarkMode ? '2px solid var(--border-color)' : '2px solid rgba(15, 23, 42, 0.18)')
        : (isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15, 23, 42, 0.14)'),
      fontSize: '0.9rem'
    };

    if (isExactRow) rowStyle.backgroundColor = 'rgba(0, 123, 255, 0.2)';
    else if (isSameGroup) rowStyle.backgroundColor = 'rgba(128, 128, 128, 0.15)';

    const columnStyle = {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      paddingRight: '15px',
      boxSizing: 'border-box'
    };

    return (
      <div
        style={rowStyle}
        className="row-hover"
        onClick={() => {
          const lat = parseFloat(row.lat);
          const lng = parseFloat(row.lng);
          setSelectedSite({ lat, lng, id: row.plaId, baseLocation: row.baseLocation, nmsName: row.nmsName, zoom: 18 });
          setSelectedRowDetails(row);
        }}
      >
        <div style={{ ...columnStyle, width: '12%', fontWeight: 'bold' }}>
          {isFirstOfGroup ? (row.plaId === 'NEW_SITE' ? 'N/A' : row.plaId) : ''}
        </div>
        <div style={{ ...columnStyle, width: '12%' }}>
          {isFirstOfGroup && (
            <span className={`status-badge ${row.matchStatus.toLowerCase()}`}>
              {row.matchStatus}
            </span>
          )}
        </div>
        <div style={{ ...columnStyle, width: '19%', fontWeight: '500' }}>
          {isFirstOfGroup ? row.baseLocation : ''}
        </div>
        <div style={{ ...columnStyle, width: '12%', fontWeight: 'bold', color: row.techGen?.includes('5G') ? '#28a745' : (row.techGen?.includes('4G') ? '#007bff' : '#666') }}>
          {row.techGen}
        </div>
        <div style={{ ...columnStyle, width: '25%', fontFamily: 'monospace', color: '#1a73e8', fontWeight: 'bold' }}>
          {row.nmsName}
        </div>
        <div style={{ ...columnStyle, width: '20%', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {isFirstOfGroup ? row.remarks : ''}
        </div>
      </div>
    );
  };

  const handleNavigate = (path) => {
    setIsNavigating(true);
    setTimeout(() => {
      navigate(path);
    }, 1000); 
  };

  // ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ 1. ALL VARIABLES MUST BE DEFINED FIRST
  const currentUserName = userInfo?.displayName || userInfo?.name || "Workspace User";
  const currentUserEmail = userInfo?.userId || "user@globe.com.ph"; 
  
  const engineerName = currentUserName || "Workspace User";
  const userInitial = engineerName.charAt(0).toUpperCase();
  const firstName = (engineerName.split(' ')[0] || '').toUpperCase();

  const lastModifiedName = lastModifiedInfo?.userDisplayName || lastModifiedInfo?.userName || "";
  const lastModifiedTimestamp = lastModifiedInfo?.timestamp
    ? new Date(lastModifiedInfo.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : "No previous sync";

  const myProcessedData = storedData
    ? storedData.filter(
        (item) => item.userId === currentUserEmail || item.metadata?.engineerName === engineerName
      )
    : [];

  // ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ 2. HEADER ACTIONS CREATED SECOND (Now it can safely read the variables above!)
const exportOptions = [
  { label: 'Storm Masterlist', value: 'ALL' },
  { label: 'New Sites Only', value: 'NEW' },
  { label: 'Removed Only', value: 'REMOVED' },
  { label: 'Mismatches Only', value: 'MISMATCH' },
  { label: 'Unchanged Only', value: 'UNCHANGED' }
];

const headerActions = (
  <DashboardHeaderActions
    lastModifiedText={lastModifiedName ? `${lastModifiedTimestamp} | ${lastModifiedName}` : lastModifiedTimestamp}
    exportDisabled={results?.length === 0}
    showExportMenu={showExportMenu}
    onToggleExport={() => setShowExportMenu(!showExportMenu)}
    onCloseExport={() => setShowExportMenu(false)}
    exportOptions={exportOptions}
    onSelectExport={(value) => handleSpecificExport(value)}
    isDarkMode={isDarkMode}
    onToggleTheme={toggleTheme}
    showUserDropdown={showUserDropdown}
    onToggleUserDropdown={() => setShowUserDropdown(!showUserDropdown)}
    onCloseUserDropdown={() => setShowUserDropdown(false)}
    userName={engineerName}
    userEmail={currentUserEmail}
    userInitial={userInitial}
    firstName={firstName}
    recentItems={myProcessedData}
    onLoadRecentItem={handleLoadStoredData}
  />
);

  return (
    <DashboardLayout
      isLoading={isNavigating} 
      logo={currentLogo}
      onLogoClick={() => handleNavigate("/")}
      headerActions={headerActions}
    >
      <main className="main-layout">
        
        <aside className="sidebar" style={{ width: '320px', minWidth: '320px', flexShrink: 0 }}>
          
          <div className="sidebar-top-section" ref={sidebarTopRef} style={{ width: '100%', flex: showHistoryPanel ? '1' : '1', display: 'flex', flexDirection: 'column' }}>
            
            <div className={`sidebar-carousel ${showHistoryPanel ? 'show-history' : (selectedRowDetails ? 'show-details' : '')}`} style={{ flex: 1 }}>
              
              <div className="carousel-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.1rem' }}>Data Input</h3>
                
                <div className="upload-group">
                  <span className="input-label">NMS CSV</span>
                  <div className="file-drop-area">
                    <img src={isDarkMode ? fileDark : fileLight} className="upload-icon" alt="icon" style={{ width: '20px' }} />
                    <span className="file-msg">{monitorFile1 ? monitorFile1.name : "Drag & drop or click"}</span>
                    <input className="file-input" type="file" accept=".csv" onChange={(e) => handleFileChange(e, setMonitorFile1)} />
                  </div>
                </div>
                
                <div className="upload-group">
                  <span className="input-label">UDM CSV</span>
                  <div className="file-drop-area">
                    <img src={isDarkMode ? fileDark : fileLight} className="upload-icon" alt="icon" style={{ width: '20px' }} />
                    <span className="file-msg">{monitorFile2 ? monitorFile2.name : "Drag & drop or click"}</span>
                    <input className="file-input" type="file" accept=".csv" onChange={(e) => handleFileChange(e, setMonitorFile2)} />
                  </div>
                </div>

                {/* ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ 3. marginTop: 'auto' forces this button to the absolute bottom of the empty space! */}
                <button className="btn primary-filled scan-btn full-width" onClick={handleScan} disabled={isLoading} style={{ marginTop: 'auto', padding: '12px' }}>
                  <img src={search} alt="Scan" className="btn-icon" style={{ width: '16px' }} />
                  <span>{isLoading ? "Scanning..." : "Scan Files"}</span>
                </button>
              </div>

              <div className="carousel-panel">
                <div className="details-header">
                  <button className="back-btn" onClick={() => setSelectedRowDetails(null)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Site Details</h3>
                </div>
                
                {selectedRowDetails && (
                  <div className="details-content">
                    <div>
                      <span className="input-label">PLA_ID</span>
                      <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
                        {selectedRowDetails.plaId === "NEW_SITE" ? "N/A" : selectedRowDetails.plaId}
                      </div>
                    </div>
                    <div>
                      <span className="input-label">Status</span>
                      <div style={{ marginTop: '6px' }}>
                        <span className={`status-badge ${(selectedRowDetails?.matchStatus || 'UNCHANGED').toLowerCase()}`}>
                          {selectedRowDetails?.matchStatus || 'UNCHANGED'}
                        </span>
                      </div>
                    </div>
                    <div className="details-box">
                      <span className="input-label">Tech Name (String)</span>
                      <div style={{ fontWeight: 'bold', marginTop: '4px', wordBreak: 'break-word' }}>
                        {selectedRowDetails.nmsName || selectedRowDetails.baseLocation}
                      </div>
                    </div>
                    <div className="details-box">
                      <span className="input-label">System Remarks</span>
                      <div style={{ fontWeight: 'bold', marginTop: '4px', wordBreak: 'break-word', color: selectedRowDetails.matchStatus === 'MISMATCH' ? '#d97706' : '' }}>
                        {selectedRowDetails.remarks}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="carousel-panel">
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Data History</h3>
                    <button onClick={handleRefreshStoredData} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--color-info)', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', padding: '5px 10px', borderRadius: '4px', outline: 'none' }}>Refresh</button>
                  </div>

                  {userInfo && (
                    <div style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', marginBottom: '15px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Logged in as:</div>
                      <div style={{ fontWeight: 'bold', color: 'var(--brand-purple)' }}>{currentUserName}</div>
                    </div>
                  )}

                  {lastModifiedInfo && lastModifiedInfo.timestamp && (
                    <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', marginBottom: '15px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>Last Data Modification:</div>
                      <div style={{ fontWeight: 'bold', color: 'var(--color-danger)' }}>{lastModifiedName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {lastModifiedInfo.action} • {lastModifiedInfo.fileName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {new Date(lastModifiedInfo.timestamp).toLocaleString()}
                      </div>
                    </div>
                  )}

                  <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden'}}>
                    {isStoredDataLoading ? (
                      renderHistoryLoadingSkeleton()
                    ) : storedData.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {storedData.map((item, index) => (
                          <div key={item.id} style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => handleLoadStoredData(item)} className="row-hover">
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                              <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.9rem', flex: 1, marginRight: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.fileName}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                {new Date(item.uploadDate).toLocaleDateString()}
                              </div>
                            </div>
                            
                            {/* ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ ADDED THE ENGINEER NAME DISPLAY HERE */}
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                              Ran by: <span style={{color: 'var(--text-primary)', fontWeight: '600'}}>{item.metadata?.engineerName || "Workspace User"}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontSize: '0.8rem', color: 'var(--color-info)' }}>
                                {item.dataType} • {item.processedCount ?? item.metadata?.processedRecords ?? 0} results
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--bg-primary)', background: 'var(--text-primary)', fontWeight: 'bold', padding: '4px 10px', borderRadius: '12px' }}>
                                Load Data
                              </div>
                            </div>

                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>[📁]</div>
                        <div>No stored data found</div>
                        <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>Process some data to see it here</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="carousel-panel" style={{ padding: 0, display: 'none' }}>
                <div style={{ padding: '2rem 1.5rem 1rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '12px', background: isDarkMode ? 'rgba(17, 28, 68, 0.95)' : 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(24px)', position: 'sticky', top: 0, zIndex: 10 }}>
                  <button className="back-btn" onClick={() => setShowAiPanel(false)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                    <span style={{ fontSize: '1.4rem' }}>AI</span> veRiSynC AI
                  </h3>
                </div>
                
                <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {chatHistory.map((msg, idx) => (
                    <div key={idx} style={{ 
                      alignSelf: msg.sender === 'user' ? 'flex-end' : (msg.sender === 'system' ? 'center' : 'flex-start'),
                      maxWidth: msg.sender === 'system' ? '100%' : '85%',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <div style={{
                        padding: msg.sender === 'system' ? '6px 12px' : '10px 14px',
                        borderRadius: msg.sender === 'user' ? '16px 16px 0 16px' : (msg.sender === 'system' ? '20px' : '16px 16px 16px 0'),
                        background: msg.sender === 'user' ? 'var(--brand-purple)' : (msg.sender === 'system' ? 'rgba(13, 177, 92, 0.15)' : 'var(--bg-input)'),
                        color: msg.sender === 'user' ? 'white' : (msg.sender === 'system' ? '#0db15c' : (msg.isError ? '#f02849' : 'var(--text-primary)')),
                        fontSize: msg.sender === 'system' ? '0.75rem' : '0.85rem',
                        lineHeight: '1.4',
                        border: msg.sender === 'ai' ? '1px solid var(--border-light)' : 'none',
                        fontWeight: msg.sender === 'system' ? 'bold' : 'normal'
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  
                  {isAiLoadingVisible && (
                    <div style={{ alignSelf: 'flex-start', background: 'var(--bg-input)', padding: '10px 14px', borderRadius: '16px 16px 16px 0', border: '1px solid var(--border-light)' }}>
                      <span style={{ display: 'inline-block', animation: 'logo-pulse 1s infinite', fontSize: '0.85rem' }}>Thinking...</span>
                    </div>
                  )}
                </div>

                <div style={{ padding: '1rem 1.5rem 1.5rem 1.5rem', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '10px', position: 'sticky', bottom: 0, background: 'var(--bg-card)' }}>
                  <textarea 
                    placeholder="Message Gemini..." 
                    value={aiCommand}
                    onChange={(e) => setAiCommand(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAiExecute();
                      }
                    }}
                    style={{ 
                      flex: 1, 
                      minHeight: '40px',
                      maxHeight: '100px',
                      padding: '10px 14px',
                      borderRadius: '20px',
                      background: 'var(--bg-input)', 
                      border: '1px solid var(--border-color)', 
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      resize: 'none',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      lineHeight: '1.4'
                    }}
                  />
                  <button 
                    onClick={handleAiExecute}
                    disabled={isAiLoadingVisible || !aiCommand.trim()}
                    className="btn primary-filled"
                    style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>
              </div>
              
            </div>
          </div>

          <div className="sidebar-map-wrapper" style={{ display: showHistoryPanel ? 'none' : 'flex' }}>
            <div className="mini-map">
              
              {/* ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ MOVED INSIDE THE MAP */}
              <div className="map-floating-header">
                <span className="floating-title">Site Visualizer</span>
                <button className="floating-btn" onClick={() => setShowBigMap(true)} aria-label="Expand map">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M4 8V4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20 16v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20 8h-4V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 20H4v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {!showHistoryPanel && (
                <MapVisualizer selectedSite={selectedSite} filteredResults={mapFilteredResults} isExpanded={false} />
              )}
            </div>
          </div>

        </aside>

        <section className="content-area">

          <div 
            className={`history-side-tab ${showHistoryPanel ? 'active' : ''}`}
            onClick={() => {
              setShowHistoryPanel(!showHistoryPanel);
              if (!showHistoryPanel) {
                setSelectedRowDetails(null);
                setShowAiPanel(false);
              }
            }}
          >
            <span style={{ fontSize: '0.7rem', transform: 'rotate(90deg)' }}>[📁]</span>
            <span className="history-tab-text">{showHistoryPanel ? "CLOSE" : "HISTORY"}</span>
          </div>

          <div 
            className={`ai-side-tab ${showAiPanel ? 'active' : ''}`}
            style={{ display: 'none' }}
            onClick={() => {
              setShowAiPanel(!showAiPanel);
              if (!showAiPanel) {
                setSelectedRowDetails(null);
                setShowHistoryPanel(false);
              }
            }}
          >
            <span style={{ fontSize: '1rem', transform: 'rotate(90deg)' }}>{showAiPanel ? "OK" : "</>"}</span>
            <span className="ai-tab-text">{showAiPanel ? "CLOSE" : "veRiSynC AI"}</span>
          </div>

          <div className="output-card">
            <div className="dashboard-container">
              {((isInitialDataLoading || isLoading || isStoredDataLoading) && results.length === 0) ? (
                <div className={`analytics-bar-card luxury-glass ${results.length > 0 ? 'compact-mode' : ''}`} style={{ flex: 1.5, minWidth: '250px', maxWidth: '300px' }}>
                  <div className="bar-header" style={{ marginBottom: '8px' }}>
                    <span className="chart-title" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', margin: 0, letterSpacing: '0.5px' }}>DELTA BREAKDOWN</span>
                  </div>
                  <div className="stacked-bar-wrapper skeleton-bar" style={{ height: '8px', width: '100%', borderRadius: '4px' }}></div>
                </div>
              ) : (
                <AnalyticsDashboard data={results} activeFilter={filterStatus} onFilterChange={handleFilterStatusChange} isDarkMode={isDarkMode} />
              )}
              <div className={`cards-section ${results.length > 0 ? 'compact-mode' : ''}`}>
                
                {/* 1. TOTAL CARD */}
                <div className={`stat-card luxury-glass total ${filterStatus === 'ALL' ? 'active' : ''} ${results.length > 0 ? 'compact-mode' : ''}`} onClick={() => handleFilterStatusChange('ALL')} style={{cursor: 'pointer'}}>
                  {((isInitialDataLoading || isLoading || isStoredDataLoading) && results.length === 0) ? (
                    <>
                      <div className="stat-icon skeleton-bar" style={{ borderRadius: '50%' }}></div>
                      <div className="stat-label skeleton-bar" style={{ width: '90px', height: '14px', borderRadius: '4px', color: 'transparent', margin: results.length > 0 ? '0' : '0 0 8px 0' }}></div>
                      <div className="stat-value skeleton-bar" style={{ width: '40px', height: '28px', borderRadius: '6px', color: 'transparent' }}></div>
                    </>
                  ) : (
                    <>
                      <img src={isDarkMode ? ICONS.checkDark : ICONS.checkLight} className="stat-icon" alt="Total" />
                      <div className="stat-label">Total Validated</div>
                      <div className="stat-value">{stats.total}</div>
                    </>
                  )}
                </div>

                {/* 2. UNCHANGED CARD */}
                <div className={`stat-card luxury-glass unchanged ${filterStatus === 'UNCHANGED' ? 'active' : ''} ${results.length > 0 ? 'compact-mode' : ''}`} onClick={() => handleFilterStatusChange('UNCHANGED')} style={{cursor: 'pointer'}}>
                  {((isInitialDataLoading || isLoading || isStoredDataLoading) && results.length === 0) ? (
                    <>
                      <div className="stat-icon skeleton-bar" style={{ borderRadius: '50%' }}></div>
                      <div className="stat-label skeleton-bar" style={{ width: '70px', height: '14px', borderRadius: '4px', color: 'transparent', margin: results.length > 0 ? '0' : '0 0 8px 0' }}></div>
                      <div className="stat-value skeleton-bar" style={{ width: '40px', height: '28px', borderRadius: '6px', color: 'transparent' }}></div>
                    </>
                  ) : (
                    <>
                      <img src={isDarkMode ? ICONS.verifiedDark : ICONS.verifiedLight} className="stat-icon" alt="Verified" />
                      <div className="stat-label">Verified</div>
                      <div className="stat-value">{stats.unchanged}</div>
                    </>
                  )}
                </div>

                {/* 3. NEW CARD */}
                <div className={`stat-card luxury-glass new ${filterStatus === 'NEW' ? 'active' : ''} ${results.length > 0 ? 'compact-mode' : ''}`} onClick={() => handleFilterStatusChange('NEW')} style={{cursor: 'pointer'}}>
                  {((isInitialDataLoading || isLoading || isStoredDataLoading) && results.length === 0) ? (
                    <>
                      <div className="stat-icon skeleton-bar" style={{ borderRadius: '50%' }}></div>
                      <div className="stat-label skeleton-bar" style={{ width: '85px', height: '14px', borderRadius: '4px', color: 'transparent', margin: results.length > 0 ? '0' : '0 0 8px 0' }}></div>
                      <div className="stat-value skeleton-bar" style={{ width: '40px', height: '28px', borderRadius: '6px', color: 'transparent' }}></div>
                    </>
                  ) : (
                    <>
                      <img src={isDarkMode ? ICONS.glitterDark : ICONS.glitterLight} className="stat-icon" alt="New" />
                      <div className="stat-label">New In NMS</div>
                      <div className="stat-value">{stats.new}</div>
                    </>
                  )}
                </div>

                {/* 4. REMOVED CARD */}
                <div className={`stat-card luxury-glass removed ${filterStatus === 'REMOVED' ? 'active' : ''} ${results.length > 0 ? 'compact-mode' : ''}`} onClick={() => handleFilterStatusChange('REMOVED')} style={{cursor: 'pointer'}}>
                  {((isInitialDataLoading || isLoading || isStoredDataLoading) && results.length === 0) ? (
                    <>
                      <div className="stat-icon skeleton-bar" style={{ borderRadius: '50%' }}></div>
                      <div className="stat-label skeleton-bar" style={{ width: '65px', height: '14px', borderRadius: '4px', color: 'transparent', margin: results.length > 0 ? '0' : '0 0 8px 0' }}></div>
                      <div className="stat-value skeleton-bar" style={{ width: '40px', height: '28px', borderRadius: '6px', color: 'transparent' }}></div>
                    </>
                  ) : (
                    <>
                      <img src={isDarkMode ? ICONS.removedDark : ICONS.removedLight} className="stat-icon" alt="Removed" />
                      <div className="stat-label">Removed</div>
                      <div className="stat-value">{stats.removed}</div>
                    </>
                  )}
                </div>

                {/* 5. MISMATCH CARD */}
                <div className={`stat-card luxury-glass mismatch ${filterStatus === 'MISMATCH' ? 'active' : ''} ${results.length > 0 ? 'compact-mode' : ''}`} onClick={() => handleFilterStatusChange('MISMATCH')} style={{cursor: 'pointer'}}>
                  {((isInitialDataLoading || isLoading || isStoredDataLoading) && results.length === 0) ? (
                    <>
                      <div className="stat-icon skeleton-bar" style={{ borderRadius: '50%' }}></div>
                      <div className="stat-label skeleton-bar" style={{ width: '80px', height: '14px', borderRadius: '4px', color: 'transparent', margin: results.length > 0 ? '0' : '0 0 8px 0' }}></div>
                      <div className="stat-value skeleton-bar" style={{ width: '40px', height: '28px', borderRadius: '6px', color: 'transparent' }}></div>
                    </>
                  ) : (
                    <>
                      <img src={isDarkMode ? ICONS.warningDark : ICONS.warningLight} className="stat-icon" alt="Warning" />
                      <div className="stat-label">Discrepancy</div>
                      <div className="stat-value">{stats.mismatch}</div>
                    </>
                  )}
                </div>

              </div>
            </div>

            <div className="table-toolbar">
              <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  className="preview-dropdown-container"
                  onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setShowPreviewMenu(false); }}
                  tabIndex={-1}
                  style={{ position: 'relative' }}
                >
                  <button
                    className="preview-toggle-btn"
                    onClick={() => setShowPreviewMenu(!showPreviewMenu)}
                    disabled={results.length === 0}
                    style={{
                      opacity: results.length === 0 ? 0.5 : 1,
                      cursor: results.length === 0 ? 'not-allowed' : 'pointer',
                      outline: 'none',
                      maxWidth: '100%'
                    }}
                  >
                    <span style={{ color: isDarkMode ? '#ffffff' : 'var(--text-primary)' }}>
                      Preview Data:
                    </span>{' '}
                    <span style={{ fontWeight: 'bold', color: isDarkMode ? '#ffffff' : 'var(--brand-purple)' }}>
                      {getPreviewLabel(filterStatus)}
                    </span>
                  </button>

                  {showPreviewMenu && (
                    <div className="preview-menu">
                      <button onClick={() => { handleFilterStatusChange('ALL'); setShowPreviewMenu(false); }}>Storm Masterlist</button>
                      <button onClick={() => { handleFilterStatusChange('NEW'); setShowPreviewMenu(false); }}>New Sites Only</button>
                      <button onClick={() => { handleFilterStatusChange('REMOVED'); setShowPreviewMenu(false); }}>Removed Only</button>
                      <button onClick={() => { handleFilterStatusChange('MISMATCH'); setShowPreviewMenu(false); }}>Mismatches Only</button>
                      <button onClick={() => { handleFilterStatusChange('UNCHANGED'); setShowPreviewMenu(false); }}>Unchanged Only</button>
                    </div>
                  )}
                </div>

                {loadedDataSource && results.length > 0 && (
                  <div
                    className="loaded-data-badge"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      background: 'var(--bg-input)',
                      borderRadius: '20px',
                      border: '1px solid var(--border-light)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ color: 'var(--text-secondary)', flexShrink: 0 }}
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span style={{ fontSize: '0.75em', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Ran by: <span style={{ color: 'var(--brand-purple)', fontWeight: 600, marginRight: '4px' }}>{loadedDataSource.engineerName}</span>
                      | <span style={{ color: 'var(--text-primary)', fontWeight: 600, marginLeft: '4px' }}>{loadedDataSource.date} {loadedDataSource.time}</span>
                    </span>
                  </div>
                )}
              </div>

              <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 0, maxWidth: '320px', width: '100%' }}>
                <input
                  type="text"
                  className="search-bar"
                  placeholder="Search ID or Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={results.length === 0}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    opacity: results.length === 0 ? 0.5 : 1,
                    cursor: results.length === 0 ? 'not-allowed' : 'text',
                    paddingRight: '92px'
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    opacity: (isSearchUpdating || ((isInitialDataLoading || isLoading || isStoredDataLoading) && results.length > 0)) ? 1 : 0,
                    pointerEvents: 'none',
                    transition: 'opacity 0.12s ease'
                  }}
                >
                  {isSearchUpdating ? 'Searching...' : 'Syncing...'}
                </span>
              </div>
            </div>
                      <div className="output-box" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
                        <div className="table-wrapper" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', padding: '16px 20px', fontWeight: 600, borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.18)', background: isDarkMode ? 'linear-gradient(180deg, rgba(17, 28, 68, 0.95) 0%, rgba(17, 28, 68, 0.85) 100%)' : 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.75) 100%)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                            <div style={{ width: '12%', paddingRight: '15px' }}>PLA_ID</div>
                            <div style={{ width: '12%', paddingRight: '15px' }}>Status</div>
                            <div style={{ width: '19%', paddingRight: '15px' }}>Base Name</div>
                            <div style={{ width: '12%', paddingRight: '15px', color: '#1a73e8' }}>Technology</div>
                            <div style={{ width: '25%', paddingRight: '15px', color: '#1a73e8' }}>BCF NAME</div>
                            <div style={{ width: '20%', paddingRight: '15px' }}>Remarks</div>
                          </div>
                          <div ref={listContainerRef} style={{ flex: 1, width: '100%', overflow: 'hidden', position: 'relative' }}>
                      {(() => {
                        const isProcessing = isInitialDataLoading || isLoading || isStoredDataLoading;
                        const isDatabaseSyncing = isInitialDataLoading || isStoredDataLoading || isRefreshingSavedData;
                        const hasData = results && results.length > 0;
                        const showOverlaySkeleton = isStoredDataLoading || isTableRevealActive;
                        const isActiveLoading = isProcessing || isDatabaseSyncing;
                        const emptyStateTitle = isDatabaseSyncing
                          ? 'Searching database...'
                          : isLoading
                            ? 'Processing uploaded data...'
                            : 'No Data Available';
                        const emptyStateSubtitle = isDatabaseSyncing
                          ? 'Importing data from the processed history.'
                          : isLoading
                            ? 'Preparing your latest processed results.'
                            : 'Upload your masterlist to populate the table.';

                        // STATE 1: DATA IS READY (Seamless background sync)
                        if (hasData) {
                          return (
                            <div className={isTableRevealActive ? 'table-content-reveal' : ''} style={{ position: 'relative', width: '100%', height: '100%' }}>
                              <List 
                                height={mainListSize.height} 
                                itemCount={visibleResultIndices.length} 
                                itemSize={58} // SM Dashboard uses 58px rows
                                width={mainListSize.width} 
                                overscanCount={10} 
                                className="custom-scrollbar"
                              >
                                {VirtualizedRow}
                              </List>
                              {showOverlaySkeleton && (
                                <div
                                  className={`table-skeleton-overlay ${isTableRevealActive && !isDatabaseSyncing ? 'fade-out' : ''}`}
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    zIndex: 20,
                                    background: isDarkMode ? 'rgba(17, 28, 68, 0.38)' : 'rgba(248, 250, 252, 0.75)',
                                    backdropFilter: 'blur(3px)',
                                    WebkitBackdropFilter: 'blur(3px)',
                                    pointerEvents: 'none'
                                  }}
                                >
                                  {[...Array(8)].map((_, i) => (
                                    <div
                                      key={`sm-table-overlay-skeleton-${i}`}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0 20px',
                                        height: '58px',
                                        borderBottom: '1px solid rgba(128,128,128,0.05)',
                                        boxSizing: 'border-box'
                                      }}
                                    >
                                      <div style={{ width: '12%', paddingRight: '15px' }}><div className="skeleton-bar" style={{ height: '12px', width: '60%', borderRadius: '4px' }}></div></div>
                                      <div style={{ width: '23%', paddingRight: '15px' }}><div className="skeleton-bar" style={{ height: '12px', width: '80%', borderRadius: '4px' }}></div></div>
                                      <div style={{ width: '20%', paddingRight: '15px' }}><div className="skeleton-bar" style={{ height: '12px', width: '70%', borderRadius: '4px' }}></div></div>
                                      <div style={{ width: '37%', paddingRight: '15px' }}><div className="skeleton-bar" style={{ height: '12px', width: '90%', borderRadius: '4px' }}></div></div>
                                      <div style={{ width: '8%', paddingRight: '15px', display: 'flex', justifyContent: 'center' }}><div className="skeleton-bar" style={{ height: '24px', width: '30px', borderRadius: '12px' }}></div></div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }

                        // STATE 2 & 3: LOADING OR EMPTY
                        return (
                          <div className={!isActiveLoading ? 'skeleton-idle' : ''} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                            
                            {/* The Skeleton Rows */}
                            {[...Array(8)].map((_, i) => (
                              <div key={i} style={{ 
                                display: 'flex', alignItems: 'center', padding: '0 20px', height: '58px', /* Matched to 58px */
                                borderBottom: "1px solid rgba(128,128,128,0.05)", boxSizing: 'border-box' 
                              }}>
                                <div style={{ width: '12%', paddingRight: '15px' }}><div className="skeleton-bar" style={{ height: '12px', width: '60%', borderRadius: '4px' }}></div></div>
                                <div style={{ width: '23%', paddingRight: '15px' }}><div className="skeleton-bar" style={{ height: '12px', width: '80%', borderRadius: '4px' }}></div></div>
                                <div style={{ width: '20%', paddingRight: '15px' }}><div className="skeleton-bar" style={{ height: '12px', width: '70%', borderRadius: '4px' }}></div></div>
                                <div style={{ width: '37%', paddingRight: '15px' }}><div className="skeleton-bar" style={{ height: '12px', width: '90%', borderRadius: '4px' }}></div></div>
                                <div style={{ width: '8%', paddingRight: '15px', display: 'flex', justifyContent: 'center' }}><div className="skeleton-bar" style={{ height: '24px', width: '30px', borderRadius: '12px' }}></div></div>
                              </div>
                            ))}

                            <div style={{ 
                              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                              background: 'var(--glass-blur)', backdropFilter: 'blur(3px)', zIndex: 10 
                            }}>
                                <div style={{ 
                                  background: 'var(--bg-card)', padding: '20px 40px', borderRadius: '12px', 
                                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)', border: '1px solid var(--border-color)',
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px'
                                }}>
                                  <img src={isDarkMode ? fileDark : fileLight} alt="No Data" style={{ width: '40px', opacity: 0.5 }} />
                                  <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.1rem' }}>{emptyStateTitle}</span>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{emptyStateSubtitle}</span>
                                  {isDatabaseSyncing && (
                                    <div style={{ width: '100%', minWidth: '220px', marginTop: '2px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                        <span>Syncing...</span>
                                        <span>{Math.round(databaseProgress)}%</span>
                                      </div>
                                      <div className="smart-progress-track">
                                        <div className="smart-progress-fill" style={{ width: `${databaseProgress}%` }}></div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                            </div>

                          </div>
                        );
                      })()}
                    </div>

                        </div>
                      </div>

                    </div>
                  </section>
                </main>

                {themeModal.visible && (
                  <div className="theme-modal-overlay" onClick={handleThemeModalCancel}>
                    <div className="theme-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                      <div className="theme-modal-header">
                        <h3>{themeModal.title}</h3>
                        <button className="theme-modal-close" onClick={handleThemeModalCancel} aria-label="Close">x</button>
                      </div>
                      <div className="theme-modal-body">
                        <p>{themeModal.message}</p>
                        {themeModal.input && (
                          <input
                            type="text"
                            value={themeModal.inputValue}
                            onChange={(e) => setThemeModal(prev => ({ ...prev, inputValue: e.target.value }))}
                            className="theme-modal-input"
                            placeholder="Enter your name"
                          />
                        )}
                      </div>
                      <div className="theme-modal-actions">
                        {themeModal.cancelText && (
                          <button className="theme-modal-button secondary" onClick={handleThemeModalCancel}>
                            {themeModal.cancelText}
                          </button>
                        )}
                        <button className="theme-modal-button primary" onClick={handleThemeModalConfirm}>
                          {themeModal.confirmText}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {showBigMap && (
                  <div className="map-modal-overlay">
                    <div className="map-modal-content">
                      <div className="map-modal-header">
                        <h3>Site Location: {selectedSite.baseLocation || "Region Map"}</h3>
                        <button className="close-btn" onClick={() => setShowBigMap(false)}> Close</button>
                      </div>
                      <div className="big-map-wrapper">
                        <MapVisualizer selectedSite={selectedSite} filteredResults={mapFilteredResults} isExpanded={true} />
                      </div>
                    </div>
                  </div>
                )}

                {toast.visible && (
                  <div 
                    className={`glass-toast ${toast.isClosing ? 'slide-out' : 'slide-in'} ${toast.type}`}
                    onMouseEnter={handleToastMouseEnter}
                    onMouseLeave={handleToastMouseLeave}
                  >
                    <div className={`toast-icon-wrap ${toast.type}`}>
                      {toast.type === 'success' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>}
                      {toast.type === 'error' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>}
                  {(toast.type !== 'success' && toast.type !== 'error') && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>}
                    </div>
                    <div className="toast-content">
                      <h4 className="toast-title">{toast.title}</h4>
                      <p className="toast-message">{toast.message}</p>
                    </div>
                    <button className="toast-close-btn" onClick={closeToast} aria-label="Close Notification">
                      &times;
                </button>
                <div className="toast-progress"></div>
                  </div>
                )}
              </DashboardLayout>
            );
          }
