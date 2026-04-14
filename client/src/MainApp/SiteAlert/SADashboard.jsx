import { useState, useMemo, useEffect, useRef, useDeferredValue } from 'react';
import localforage from 'localforage';
import useDarkMode from '../../hooks/useDarkMode';
import useSearchDebounce from '../../hooks/useSearchDebounce';
import useSmartProgress from '../../hooks/useSmartProgress';
import { processWirelessAlarms, processTransportAlarms } from '../../services/dataGrouper';
import {
  storeUploadedData,
  getUserUploadedDataSummary,
  getUploadedDataById,
  getUserInfo,
  getLastModifiedInfo,
  getCachedUserInfo
} from '../../services/googleAppsScript';

import globeLogoDark from '../../assets/Globe_LogoW.png';
import globeLogoLight from '../../assets/Globe_LogoB.png';
import searchIcon from '../../assets/search.png';
import fileDark from '../../assets/fileDark.png';
import fileLight from '../../assets/fileLight.png';
import warningDark from '../../assets/warningDark.png';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Rectangle } from 'recharts';
import { FixedSizeList as List, VariableSizeList } from 'react-window'; // ?? THE CRASH FIX IMPORT!

import * as XLSX from 'xlsx';
import { useNavigate } from "react-router-dom";

import DashboardLayout from '../../components/DashboardLayout';
import DashboardHeaderActions from '../../components/common/DashboardHeaderActions';
import { ThemedButton, ThemedBadge } from '../../components/common';
import '../../styles/Dashboard_styles.css';

export default function SADashboard() {
  const [monitorFile1, setMonitorFile1] = useState(null); 
  const [monitorFile2, setMonitorFile2] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);
  const [isStoredDataLoading, setIsStoredDataLoading] = useState(false);
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true);
  const [isRefreshingSavedData, setIsRefreshingSavedData] = useState(false);
  const globalDatabaseSyncing = isInitialDataLoading || isRefreshingSavedData || isStoredDataLoading;
  const databaseProgress = useSmartProgress(globalDatabaseSyncing);
  const historyLoadProgress = useSmartProgress(isStoredDataLoading);
  const [results, setResults] = useState([]);
  const [dashboardMode, setDashboardMode] = useState('wireless');
  const isWirelessMode = dashboardMode === 'wireless';

  const navigate = useNavigate();
  const [isDarkMode, toggleTheme] = useDarkMode();
  const { searchTerm, setSearchTerm, debouncedTerm, isPending: isSearchPending } = useSearchDebounce();

  const [selectedRowDetails, setSelectedRowDetails] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeSidebarView, setActiveSidebarView] = useState('input');
  const [sidebarSlideState, setSidebarSlideState] = useState({ previous: null, direction: 0 });

  const [drillDownData, setDrillDownData] = useState(null);
  const [modalSearchTerm, setModalSearchTerm] = useState(""); 
  const [isDrillDownRendered, setIsDrillDownRendered] = useState(false);
  const [isDrillDownVisible, setIsDrillDownVisible] = useState(false);
  const [drillDownOrigin, setDrillDownOrigin] = useState('50% 50%');
  const [modalListHeight, setModalListHeight] = useState(600);

  const expandBtnRef = useRef(null);
  const [isGraphModalRendered, setIsGraphModalRendered] = useState(false); 
  const [isGraphModalVisible, setIsGraphModalVisible] = useState(false);   
  const [graphModalOrigin, setGraphModalOrigin] = useState('0% 0%');                 
  const [selectedGraphAlarm, setSelectedGraphAlarm] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

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

  const handleThemeModalCancel = () => {
    themeModal.onCancel?.();
    closeThemeModal();
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
  const [latestStoredDataId, setLatestStoredDataId] = useState(null);
  const [expectedResultCount, setExpectedResultCount] = useState(0);
  const [isFullDataLoading, setIsFullDataLoading] = useState(false);
  const [isFullDataLoaded, setIsFullDataLoaded] = useState(false);
  const [showTableLoadingHint, setShowTableLoadingHint] = useState(false);
  const tableLoadingHintTimerRef = useRef(null);

  // Backend integration state
  const [storedData, setStoredData] = useState([]);
  const [userInfo, setUserInfo] = useState(() => getCachedUserInfo());
  const [lastModifiedInfo, setLastModifiedInfo] = useState(null);
  const [persistedSummaryStats, setPersistedSummaryStats] = useState(null);
  const [mainListSize, setMainListSize] = useState({ width: '100%', height: 600 });
  const [workerFilteredIndices, setWorkerFilteredIndices] = useState([]);
  const [workerReady, setWorkerReady] = useState(false);
  const [isWorkerBusy, setIsWorkerBusy] = useState(false);
  const monitorFile1Ref = useRef(null);
  const monitorFile2Ref = useRef(null);
  const listContainerRef = useRef(null);
  const filterWorkerRef = useRef(null);
  const filterRequestIdRef = useRef(0);
  const workerPerfRef = useRef(new Map());

  const CHART_COLORS = ['#8a2be2', '#1a73e8', '#00bfa5', '#f0a500', '#f02849'];
  const currentLogo = isDarkMode ? globeLogoDark : globeLogoLight;
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const cacheKey = `site_alert_cache_${dashboardMode}_v1`;
  const cacheMetaKey = `${cacheKey}_meta`;
  const cacheDataKey = `${cacheKey}_full`;

  const buildSiteAlertSummaryStats = (rows) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    const totalOccurrences = safeRows.reduce((sum, row) => sum + (Number(row?.count) || 0), 0);
    const uniqueSitesCount = new Set(safeRows.map((row) => row?.name).filter(Boolean)).size;
    const alarmCountMap = {};

    safeRows.forEach((row) => {
      const alarm = row?.alert || 'N/A';
      alarmCountMap[alarm] = (alarmCountMap[alarm] || 0) + (Number(row?.count) || 0);
    });

    const sortedAlarms = Object.entries(alarmCountMap).sort((a, b) => b[1] - a[1]);
    return {
      totalOccurrences,
      uniqueSitesCount,
      uniqueAlarmTypes: sortedAlarms.length,
      mostCriticalAlarm: sortedAlarms[0]?.[0] || 'N/A'
    };
  };
  
  const applyStoredProcessedData = (item) => {
    if (!item) return;
    const processedData = Array.isArray(item.processedData) ? item.processedData : [];
    setResults(processedData);
    setExpectedResultCount(processedData.length);
    setIsFullDataLoaded(true);
    setPersistedSummaryStats(item.metadata?.summaryStats || null);
    setSelectedRowDetails(null);
    handleSidebarViewChange('analytics');
    setIsSidebarCollapsed(false);
    
    setLoadedDataSource({
      date: new Date(item.uploadDate || Date.now()).toLocaleDateString(),
      time: new Date(item.uploadDate || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      engineerName: item.metadata?.engineerName || 'Unknown User'
    });
  };

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

  const toPreviewRows = (rows) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    return safeRows.map((row) => ({
      ...row,
      rawRows: []
    }));
  };

  const showTransientTableLoadingHint = () => {
    setShowTableLoadingHint(true);
    if (tableLoadingHintTimerRef.current) clearTimeout(tableLoadingHintTimerRef.current);
    tableLoadingHintTimerRef.current = setTimeout(() => setShowTableLoadingHint(false), 1400);
  };

  const ensureLatestFullDataLoaded = async (reason = 'manual') => {
    if (isFullDataLoaded && results.length >= expectedResultCount) return results;
    if (!latestStoredDataId || isFullDataLoading) return null;

    setIsFullDataLoading(true);
    if (reason === 'scroll' || reason === 'count') {
      showTransientTableLoadingHint();
    }

    try {
      const fullStoredData = await getUploadedDataById(latestStoredDataId, true, dashboardMode);
      applyStoredProcessedData(fullStoredData);
      await saveDashboardCache({
        nextUserInfo: userInfo || getCachedUserInfo() || null,
        nextStoredData: storedData,
        nextLastModifiedInfo: lastModifiedInfo,
        latestStoredData: fullStoredData,
        latestPreviewData: fullStoredData?.metadata?.previewData || results,
        nextSummaryStats: fullStoredData?.metadata?.summaryStats || persistedSummaryStats
      });
      return Array.isArray(fullStoredData?.processedData) ? fullStoredData.processedData : null;
    } catch (error) {
      console.error('Failed to lazily load full data:', error);
      if (reason === 'count') {
        showToast('Load Error', 'Failed to load full row details from database.', 'error');
      }
      return null;
    } finally {
      setIsFullDataLoading(false);
    }
  };

  useEffect(() => {
    const handleResize = () => setModalListHeight((window.innerHeight * 0.9) - 190);
    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.querySelector('.search-bar')?.focus();
    }
    if (e.key === 'Escape') {
      setShowBigMap(false);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);

  useEffect(() => () => {
    if (tableLoadingHintTimerRef.current) clearTimeout(tableLoadingHintTimerRef.current);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const bootLoaderTimeout = setTimeout(() => {
      if (isMounted) setIsInitialDataLoading(false);
    }, 1500);

    const loadUserData = async () => {
      // 1. INSTANT CACHE LOAD (IndexedDB - 0 Seconds)
      let hasFreshCache = false;
      const summaryPromise = getUserUploadedDataSummary(10, dashboardMode, true);
      const lastModifiedPromise = getLastModifiedInfo(dashboardMode);
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
          const latestCachedSummary = Array.isArray(cachedMeta.storedData) && cachedMeta.storedData.length > 0 ? cachedMeta.storedData[0] : null;
          const cachedPreview = Array.isArray(cachedMeta.latestPreviewData) ? cachedMeta.latestPreviewData : [];
          const cachedProcessedRecords = Number(latestCachedSummary?.processedCount ?? latestCachedSummary?.metadata?.processedRecords ?? cachedPreview.length);
          setLatestStoredDataId(latestCachedSummary?.id || null);
          setExpectedResultCount(Number.isFinite(cachedProcessedRecords) ? cachedProcessedRecords : cachedPreview.length);
          setIsFullDataLoaded(false);
          setLastModifiedInfo(cachedMeta.lastModifiedInfo || null);
          setPersistedSummaryStats(cachedMeta.persistedSummaryStats || null);

          if (Array.isArray(cachedMeta.latestPreviewData) && cachedMeta.latestPreviewData.length > 0) {
            setResults(toPreviewRows(cachedMeta.latestPreviewData));
          }

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
        const processedRecords = Number(latestSummary?.processedCount ?? latestSummary?.metadata?.processedRecords ?? previewData.length);
        setLatestStoredDataId(latestSummary?.id || null);
        setExpectedResultCount(Number.isFinite(processedRecords) ? processedRecords : previewData.length);
        setIsFullDataLoaded(false);

        if (!hasFreshCache && previewData.length > 0) {
          setResults(toPreviewRows(previewData));
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

        // Keep preview rows interactive; full rows are loaded lazily on demand.
        await saveDashboardCache({
          nextUserInfo: userData || getCachedUserInfo() || null,
          nextStoredData: storedDataList,
          nextLastModifiedInfo: lastModified,
          latestPreviewData: toPreviewRows(previewData),
          nextSummaryStats: summaryStats
        });
      } catch (error) {
        console.error('Failed to sync with database:', error);
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
  }, [dashboardMode]);

  useEffect(() => {
    if (!listContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setMainListSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(listContainerRef.current);
    return () => observer.disconnect();
  }, [results]);

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
      if (payload.type === 'RESULT_SITE' && payload.requestId === filterRequestIdRef.current) {
        if (perfMeta) {
          const durationMs = performance.now() - perfMeta.startedAt;
          console.info(
            `[Perf][SiteAlert][Worker] ${durationMs.toFixed(1)}ms | rows=${perfMeta.rowCount} | matched=${Array.isArray(payload.indices) ? payload.indices.length : 0} | term="${perfMeta.term}"`
          );
        }
        setWorkerFilteredIndices(Array.isArray(payload.indices) ? payload.indices : []);
        setIsWorkerBusy(false);
      }
      if (payload.type === 'WORKER_ERROR' && payload.requestId === filterRequestIdRef.current) {
        if (perfMeta) {
          const durationMs = performance.now() - perfMeta.startedAt;
          console.warn(
            `[Perf][SiteAlert][Worker][Error] ${durationMs.toFixed(1)}ms | rows=${perfMeta.rowCount} | term="${perfMeta.term}"`
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

  const viewOrder = ['input', 'analytics', 'details', 'history'];

  const handleSidebarViewChange = (view) => {
    if (view === activeSidebarView) return;
    const currentIndex = viewOrder.indexOf(activeSidebarView);
    const targetIndex = viewOrder.indexOf(view);
    setSidebarSlideState({ previous: activeSidebarView, direction: targetIndex > currentIndex ? 1 : -1 });
    setActiveSidebarView(view);
  };

  useEffect(() => {
    if (!sidebarSlideState.previous) return;
    const t = setTimeout(() => setSidebarSlideState((prev) => ({ ...prev, previous: null })), 350);
    return () => clearTimeout(t);
  }, [activeSidebarView, sidebarSlideState.previous]);

  const getSidebarPanelStyle = (view) => {
    const isActive = view === activeSidebarView;
    const isPrevious = view === sidebarSlideState.previous;
    const distance = sidebarSlideState.direction === 1 ? 20 : -20;
    const base = {
      position: 'absolute',
      inset: 0,
      padding: '12px',
      overflow: 'hidden', // ?? LOCKED SCROLLBAR FIX
      transition: 'transform 0.35s ease, opacity 0.35s ease',
      background: 'var(--bg-secondary)'
    };

    if (isActive) {
      return { ...base, opacity: 1, transform: 'translateX(0)', zIndex: 2, pointerEvents: 'auto' };
    }

    if (isPrevious) {
      return { ...base, opacity: 0, transform: `translateX(${distance * -1}%)`, zIndex: 1, pointerEvents: 'none' };
    }

    return { ...base, opacity: 0, transform: `translateX(${distance}%)`, zIndex: 0, pointerEvents: 'none' };
  };

  const sidebarInnerCardStyle = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-primary)',
    boxShadow: isDarkMode ? '0 4px 14px rgba(0, 0, 0, 0.25)' : '0 4px 12px rgba(0, 0, 0, 0.06)',
    overflow: 'hidden'
  };

  const handleModeToggle = () => {
    setIsInitialDataLoading(true);
    setDashboardMode(prev => prev === 'wireless' ? 'transport' : 'wireless');
    setResults([]);
    setSelectedRowDetails(null);
    setSearchTerm("");
    setSelectedGraphAlarm(null);
    setMonitorFile1(null);
    setMonitorFile2(null);
    handleSidebarViewChange('input');
    setModalSearchTerm("");
    setDrillDownData(null);
    setIsDrillDownVisible(false);
    setIsDrillDownRendered(false);
    if (monitorFile1Ref.current) monitorFile1Ref.current.value = '';
    if (monitorFile2Ref.current) monitorFile2Ref.current.value = '';
  };

  const handleFileChange = (e, setFileState) => {
    const file = e.target.files[0];
    if (file) setFileState(file);
  };

  const readUniversalFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' }); 
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          
          let headerRowIndex = 0;
          for (let i = 0; i < rawData.length; i++) {
            const rowValues = Object.values(rawData[i]).map(v => String(v).toUpperCase());
            if (rowValues.includes('ALARM TEXT') || rowValues.includes('NAME') || rowValues.includes('SEVERITY')) {
              headerRowIndex = i;
              break;
            }
          }
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            range: headerRowIndex, 
            defval: "" 
          });
          resolve(jsonData);
        } catch {
          reject(new Error("Failed to parse file."));
        }
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleScan = async () => {
    if (dashboardMode === 'wireless') {
      if (!monitorFile1 || !monitorFile2) {
        return showThemeModal({
          title: 'Missing Files',
          message: 'Please upload both the NMS and SA Masterlist files.',
          type: 'warning',
          confirmText: 'OK'
        });
      }
    } else if (!monitorFile1) {
      return showThemeModal({
        title: 'Missing File',
        message: 'Please upload the NMS file.',
        type: 'warning',
        confirmText: 'OK'
      });
    }

    const engineerName = userInfo?.displayName || userInfo?.name || "Workspace User";

    setIsLoading(true);
    setResults([]);
    setSelectedRowDetails(null);
    setLoadedDataSource(null);
    setIsFullDataLoaded(true);
    setLatestStoredDataId(null);
    setExpectedResultCount(0);

    try {
      const nmsData = await readUniversalFile(monitorFile1);
      if (nmsData.length === 0) throw new Error("NMS File is empty.");

      let result;

      // 1. Fetch raw result based on mode
      if (dashboardMode === 'wireless') {
        const masterData = await readUniversalFile(monitorFile2);
        result = processWirelessAlarms(nmsData, masterData);
      } else {
        result = processTransportAlarms(nmsData);
      }

      // ?? 2. THE UNIVERSAL SAFE MAPPER (Fixes the NaN Crash)
      const rawDataArray = Array.isArray(result?.data) ? result.data : [];
      const safeProcessedData = rawDataArray.map((item) => ({
        alert: item.alert || item.alarm || "N/A",
        dn: item.dn || item.li || item.locationInfo || "N/A",
        name: item.name || item.sn || item.siteName || "N/A",
        pla: item.pla || item.severity || item.plaId || "N/A",
        count: Number(item.count) || 1, 
        rawRows: item.rawRows || []
      }));
      const summaryStats = buildSiteAlertSummaryStats(safeProcessedData);

      // 3. Continue with the standard save sequence
      if (result.success && safeProcessedData.length > 0) {
        setResults(safeProcessedData);
        setExpectedResultCount(safeProcessedData.length);
        setIsFullDataLoaded(true);
        setPersistedSummaryStats(summaryStats);
        handleSidebarViewChange('analytics');
        setIsSidebarCollapsed(false);

        const fileNames = dashboardMode === 'wireless'
          ? `${monitorFile1.name} + ${monitorFile2.name}`
          : monitorFile1.name;

        storeUploadedData(
          fileNames,
          dashboardMode,
          [],
          safeProcessedData,
          {
            totalRecords: nmsData.length,
            processedRecords: safeProcessedData.length,
            dashboardMode,
            timestamp: new Date().toISOString(),
            engineerName,
            summaryStats
          }
        )
          .then(async () => {
            const [updatedStoredData, lastModified] = await Promise.all([
              getUserUploadedDataSummary(10, dashboardMode, true),
              getLastModifiedInfo(dashboardMode)
            ]);
            setStoredData(updatedStoredData);
            setLastModifiedInfo(lastModified);
            saveDashboardCache({
              nextUserInfo: userInfo || getCachedUserInfo() || null,
              nextStoredData: updatedStoredData,
              nextLastModifiedInfo: lastModified,
              latestStoredData: {
                processedData: safeProcessedData,
                fileName: fileNames,
                metadata: { summaryStats }
              },
              latestPreviewData: toPreviewRows(safeProcessedData),
              nextSummaryStats: summaryStats
            }).catch((err) => console.warn('IndexedDB Write Failed', err));
          })
          .catch((storeError) => {
            console.error('Failed to store data:', storeError);
            showThemeModal({
              title: 'Save Warning',
              message: 'Data was processed successfully but failed to save to database. You can still view the results.',
              type: 'warning',
              confirmText: 'OK'
            });
          });
      } else {
        showThemeModal({
          title: result.success ? 'No Matches' : 'Processing Error',
          message: result.success ? 'No matching alarms were found.' : `Error: ${result.error}`,
          type: result.success ? 'info' : 'error',
          confirmText: 'OK'
        });
      }
    } catch (error) { 
      showThemeModal({
        title: 'Read Error',
        message: `Error reading files: ${error.message}`,
        type: 'error',
        confirmText: 'OK'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (results.length === 0) {
      return showThemeModal({
        title: 'No Data',
        message: 'No data available to export.',
        type: 'warning',
        confirmText: 'OK'
      });
    }

    const flattenedData = [];
    let originalNMSHeaders = [];
    if (results[0] && results[0].rawRows && results[0].rawRows.length > 0) {
      originalNMSHeaders = Object.keys(results[0].rawRows[0]);
    }

    const strictHeaderOrder = dashboardMode === 'wireless'
      ? ["Severity Rank", "Total Repetitions", "Occurrence #", "Masterlist PLA_ID", "Masterlist Site Name", "Distinguished Name", "Alarm Text", ...originalNMSHeaders]
      : ["Severity Rank", "Total Repetitions", "Occurrence #", "Severity", "Site Name (Alarm Source)", "Location Info", "Alarm Name", ...originalNMSHeaders];

    results.forEach((group, groupIndex) => {
      if (group.rawRows) {
        group.rawRows.forEach((rawRow, idx) => {
          const formattedRawRow = {};
          originalNMSHeaders.forEach((key) => {
            const value = rawRow[key];
            const isTimeCol = key.toLowerCase().includes('time') || key.toLowerCase().includes('date') || key.toLowerCase().includes('stamp');
            if (isTimeCol && typeof value === 'number' && value > 30000) {
              const dateObj = new Date(Math.round((value - 25569) * 86400 * 1000));
              const m = dateObj.getUTCMonth() + 1;
              const d = dateObj.getUTCDate();
              const y = dateObj.getUTCFullYear();
              const hh = String(dateObj.getUTCHours()).padStart(2, '0');
              const mm = String(dateObj.getUTCMinutes()).padStart(2, '0');
              const ss = String(dateObj.getUTCSeconds()).padStart(2, '0');
              formattedRawRow[key] = `${m}/${d}/${y} ${hh}:${mm}:${ss}`;
            } else {
              formattedRawRow[key] = (value === null || value === undefined) ? "" : value;
            }
          });

          flattenedData.push({
            "Severity Rank": groupIndex + 1,
            "Total Repetitions": group.count,
            "Occurrence #": idx + 1,
            [dashboardMode === 'wireless' ? "Masterlist PLA_ID" : "Severity"]: group.pla || "N/A",
            [dashboardMode === 'wireless' ? "Masterlist Site Name" : "Site Name (Alarm Source)"]: group.name || "N/A",
            [dashboardMode === 'wireless' ? "Distinguished Name" : "Location Info"]: group.dn || "N/A",
            [dashboardMode === 'wireless' ? "Alarm Text" : "Alarm Name"]: group.alert || "N/A",
            ...formattedRawRow
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(flattenedData, { header: strictHeaderOrder });
    const columnWidths = strictHeaderOrder.map((header) => {
      let maxLength = header.length;
      flattenedData.forEach((row) => {
        const cellValue = row[header] ? row[header].toString() : "";
        if (cellValue.length > maxLength) maxLength = cellValue.length;
      });
      return { wch: Math.min(maxLength + 2, 50) };
    });
    worksheet['!cols'] = columnWidths;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Raw Alarms");
    XLSX.writeFile(workbook, `${dashboardMode.toUpperCase()}_SiteAlerts_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleSpecificExport = (exportCategory = 'ALL') => {
    setShowExportMenu(false);
    if (exportCategory === 'ALL') {
      handleExport();
      return;
    }
    showThemeModal({
      title: 'Unsupported Export',
      message: `Export category "${exportCategory}" is not available for Site Alert.`,
      type: 'warning',
      confirmText: 'OK'
    });
  };

  const handleLoadStoredData = async (storedDataItem) => {
    try {
      setIsStoredDataLoading(true);
      setLatestStoredDataId(storedDataItem?.id || null);
      const fullStoredData = await getUploadedDataById(storedDataItem.id, true, dashboardMode);
      applyStoredProcessedData(fullStoredData);
      saveDashboardCache({
        nextUserInfo: userInfo || getCachedUserInfo() || null,
        nextStoredData: storedData,
        nextLastModifiedInfo: lastModifiedInfo,
        latestStoredData: fullStoredData,
        latestPreviewData: fullStoredData?.metadata?.previewData || results,
        nextSummaryStats: fullStoredData?.metadata?.summaryStats || persistedSummaryStats
      }).catch((err) => console.warn('IndexedDB Write Failed', err));
      
      showToast(
        'Data Loaded',
        `Loaded data from: ${fullStoredData.fileName}\n${fullStoredData.processedData?.length || 0} results loaded.`,
        'success'
      );
    } catch (error) {
      showToast('Load Error', `Error loading stored data: ${error.message}`, 'error');
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
          key={`sa-history-skeleton-${idx}`}
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

  const handleRefreshStoredData = async () => {
    try {
      const [updatedStoredData, lastModified] = await Promise.all([
        getUserUploadedDataSummary(10, dashboardMode, true),
        getLastModifiedInfo(dashboardMode)
      ]);
      setStoredData(updatedStoredData);
      const latestSummary = updatedStoredData.length > 0 ? updatedStoredData[0] : null;
      const refreshedPreview = Array.isArray(latestSummary?.metadata?.previewData) ? latestSummary.metadata.previewData : [];
      const refreshedProcessedCount = Number(latestSummary?.processedCount ?? latestSummary?.metadata?.processedRecords ?? refreshedPreview.length);
      setLatestStoredDataId(latestSummary?.id || null);
      setExpectedResultCount(Number.isFinite(refreshedProcessedCount) ? refreshedProcessedCount : refreshedPreview.length);
      if (refreshedPreview.length > 0) {
        setResults(toPreviewRows(refreshedPreview));
        setIsFullDataLoaded(false);
      }
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

  const filteredModalRows = useMemo(() => {
    if (!drillDownData || !drillDownData.rawRows) return [];
    const term = modalSearchTerm.toLowerCase();
    if (!term) return drillDownData.rawRows;
    return drillDownData.rawRows.filter(rawRow => Object.values(rawRow).some(val => String(val).toLowerCase().includes(term)));
  }, [drillDownData, modalSearchTerm]);

  const liveTotalOccurrences = useMemo(() => results.reduce((sum, row) => sum + row.count, 0), [results]);
  const liveUniqueSitesCount = useMemo(() => new Set(results.map(row => row.name)).size, [results]);

  const alarmStats = useMemo(() => {
    if (!results || results.length === 0) return [];
    const stats = {};
    let max = 0;
    results.forEach(row => {
      if (!stats[row.alert]) stats[row.alert] = 0;
      stats[row.alert] += row.count;
    });
    const statsArray = Object.keys(stats).map(key => {
      if (stats[key] > max) max = stats[key];
      return { name: key, count: stats[key] };
    }).sort((a, b) => b.count - a.count);

    const totalAlarms = statsArray.reduce((sum, stat) => sum + stat.count, 0);

    return statsArray.map(stat => ({ 
      ...stat, 
      percentage: (stat.count / max) * 100, 
      totalPercentage: ((stat.count / totalAlarms) * 100).toFixed(1) 
    }));
  }, [results]);

  const totalOccurrences = persistedSummaryStats?.totalOccurrences ?? liveTotalOccurrences;
  const uniqueSitesCount = persistedSummaryStats?.uniqueSitesCount ?? liveUniqueSitesCount;
  const uniqueAlarmTypesCount = persistedSummaryStats?.uniqueAlarmTypes ?? alarmStats.length;
  const mostCriticalAlarm = persistedSummaryStats?.mostCriticalAlarm || alarmStats[0]?.name || 'N/A';

  const topSitesData = useMemo(() => {
    if (selectedGraphAlarm) {
      return results.filter(r => r.alert === selectedGraphAlarm).sort((a,b) => b.count - a.count);
    }
    return [...results].sort((a,b) => b.count - a.count).slice(0, 50); 
  }, [results, selectedGraphAlarm]);

  const deferredSearchTerm = useDeferredValue(debouncedTerm);

  const fallbackFilteredResults = useMemo(() => {
    // Fallback path for environments where Web Workers are unavailable.
    if (workerReady) return [];
    const term = String(deferredSearchTerm || '').toLowerCase().trim();
    if (!term) return results;

    return results.filter((row) => {
      const searchable = [row.alert, row.name, row.dn, row.pla, row.li, row.sn]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .join(' ');
      return searchable.includes(term);
    });
  }, [results, deferredSearchTerm, workerReady]);

  useEffect(() => {
    if (!workerReady || !filterWorkerRef.current) return;
    filterWorkerRef.current.postMessage({ type: 'INIT_SITE', rows: results });
  }, [results, workerReady]);

  useEffect(() => {
    if (!workerReady || !filterWorkerRef.current) return;
    const requestId = ++filterRequestIdRef.current;
    const term = String(deferredSearchTerm || '');
    workerPerfRef.current.set(requestId, {
      startedAt: performance.now(),
      rowCount: results.length,
      term
    });
    setIsWorkerBusy(true);
    filterWorkerRef.current.postMessage({
      type: 'QUERY_SITE',
      requestId,
      term
    });
  }, [workerReady, deferredSearchTerm, results.length]);

    const filteredResults = useMemo(() => {
        // 1. Fallback if worker is broken
        if (!workerReady) return fallbackFilteredResults;
        // If the worker is still calculating the initial load, bypass it and show the data instantly
        if (workerFilteredIndices.length === 0 && results.length > 0 && !deferredSearchTerm) {
          return results;
        }

        // 3. Normal Worker Operation
        return workerFilteredIndices
          .map((index) => results[index])
          .filter(Boolean);
      }, [workerReady, fallbackFilteredResults, workerFilteredIndices, results, deferredSearchTerm]);

  const isSearchUpdating = isSearchPending || deferredSearchTerm !== debouncedTerm || isWorkerBusy;

  const handleMainListScroll = ({ scrollDirection, scrollOffset, scrollUpdateWasRequested }) => {
    if (scrollUpdateWasRequested) return;
    if (scrollDirection !== 'forward') return;
    if (scrollOffset <= 0) return;
    if (isFullDataLoaded || isFullDataLoading) return;
    if (!latestStoredDataId) return;
    if (expectedResultCount <= results.length) return;

    const rowHeight = 70;
    const visibleHeight = Number(mainListSize.height) || 0;
    const estimatedTotalHeight = filteredResults.length * rowHeight;
    if (estimatedTotalHeight <= visibleHeight + rowHeight) return;
    const nearBottom = scrollOffset + visibleHeight >= Math.max(0, estimatedTotalHeight - rowHeight * 2);

    if (nearBottom) {
      ensureLatestFullDataLoaded('scroll');
    }
  };

  const openGraphModal = () => {
    if (expandBtnRef.current) {
      const rect = expandBtnRef.current.getBoundingClientRect();
      const originXPercent = (((rect.left + rect.width / 2) - (window.innerWidth * 0.1)) / (window.innerWidth * 0.8)) * 100;
      const originYPercent = (((rect.top + rect.height / 2) - (window.innerHeight * 0.075)) / (window.innerHeight * 0.85)) * 100;
      setGraphModalOrigin(`${originXPercent}% ${originYPercent}%`);
    }
    setSelectedGraphAlarm(null); 
    setIsGraphModalRendered(true);
    setTimeout(() => setIsGraphModalVisible(true), 10); 
  };

  const closeGraphModal = () => {
    setIsGraphModalVisible(false); 
    setTimeout(() => {
      setIsGraphModalRendered(false);
      setSelectedGraphAlarm(null); 
    }, 350); 
  };

  const openDrillDownModal = async (e, row) => {
    e.stopPropagation();
    if (isFullDataLoading) return;
    setModalSearchTerm("");

    const rect = e.target.getBoundingClientRect();
    const originXPercent = (((rect.left + rect.width / 2) - (window.innerWidth * 0.075)) / (window.innerWidth * 0.85)) * 100;
    const originYPercent = (((rect.top + rect.height / 2) - (window.innerHeight * 0.05)) / (window.innerHeight * 0.9)) * 100;
    setDrillDownOrigin(`${originXPercent}% ${originYPercent}%`);

    let targetRow = row;
    const needsFullRows = !Array.isArray(row?.rawRows) || row.rawRows.length === 0;
    if (needsFullRows) {
      showToast('Loading data...', 'Importing complete row details from database.', 'info');
      const fullRows = await ensureLatestFullDataLoaded('count');
      if (!fullRows) return;
      const rowKey = `${row.pla || ''}|${row.name || ''}|${row.alert || ''}|${row.dn || ''}`;
      targetRow = fullRows.find((candidate) => (
        `${candidate?.pla || ''}|${candidate?.name || ''}|${candidate?.alert || ''}|${candidate?.dn || ''}` === rowKey
      )) || row;
    }

    setDrillDownData(targetRow);
    setIsDrillDownRendered(true);
    setTimeout(() => setIsDrillDownVisible(true), 10);
  };

  const closeDrillDownModal = () => {
    setIsDrillDownVisible(false);
    setTimeout(() => { setIsDrillDownRendered(false); setDrillDownData(null); }, 350);
  };

  const getValidEntries = (rawRow) => {
    return Object.entries(rawRow).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      const strVal = String(value).trim();
      if (strVal === "" || strVal.toLowerCase() === "null" || strVal.toLowerCase() === "undefined") return false;
      return true;
    });
  };

  const getModalRowHeight = (index) => {
    const raw = filteredModalRows[index];
    const validEntries = getValidEntries(raw);
    const gridRows = Math.ceil(validEntries.length / 5); 
    return (gridRows * 120) + ((gridRows - 1) * 12) + 130; 
  };

  const VirtualizedRow = ({ index, style }) => {
    const row = filteredResults[index];
    let rowStyle = {
      ...style,
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      cursor: "pointer",
      transition: "background-color 0.2s",
      borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(15, 23, 42, 0.16)",
      boxSizing: 'border-box',
      fontSize: '0.85rem'
    };
    const columnStyle = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '15px', boxSizing: 'border-box' };

          return (
            <div style={rowStyle} className="row-hover" onClick={() => { setSelectedRowDetails(row); handleSidebarViewChange('details'); setIsSidebarCollapsed(false); }}>
              <div style={{ ...columnStyle, width: '12%', fontWeight: 'bold', color: dashboardMode === 'transport' ? 'var(--color-danger-light)' : 'var(--text-primary)' }}>
                {row.pla || "N/A"}
              </div>
              <div style={{ ...columnStyle, width: '23%', color: 'var(--color-info)', fontWeight: 'bold' }}>
                {row.name || "N/A"}
              </div>
              <div style={{ ...columnStyle, width: '20%', fontFamily: 'ARIAL', color: 'var(--text-primary)' }}>
                {row.alert || "N/A"}
              </div>
              <div style={{ ...columnStyle, width: '37%', fontFamily: 'monospace', fontSize: '1rem', color: 'var(--text-primary)' }}>
                {row.dn || "N/A"}
              </div>
              <div style={{ ...columnStyle, width: '8%', textAlign: 'center' }}>
                <ThemedBadge
                  variant="danger"
                  onClick={(e) => openDrillDownModal(e, row)}
                  disabled={isFullDataLoading}
                  title={isFullDataLoading ? "Loading full data..." : "Click to view all occurrences"}
                >
                  {row.count}
                </ThemedBadge>
              </div>
            </div>
          );
        };

        const VirtualizedModalRow = ({ index, style }) => {
          const raw = filteredModalRows[index];
          const validEntries = getValidEntries(raw);

          return (
  <div style={{ ...style, padding: '0 5px 20px 5px', boxSizing: 'border-box' }}>
    <div style={{
      background: isDarkMode ? 'var(--bg-primary)' : 'var(--bg-input)',
      padding: '24px',
      borderRadius: '12px',
      border: '1px solid var(--border-light)',
      boxShadow: isDarkMode ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 24px rgba(0,0,0,0.2)' : 'none',
      boxSizing: 'border-box',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>

      {/* --- 1. HERO BANNER: The most important data highlighted at the top --- */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '1px solid var(--border-light)',
        paddingBottom: '16px',
        marginBottom: '16px',
        flexShrink: 0
      }}>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
            Occurrence #{index + 1}
          </div>
          <div style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
            {/* Automatically find and feature the Alarm Text */}
            {validEntries.find(([k]) => k.toUpperCase() === 'ALARM TEXT')?.[1] || 'UNKNOWN ALARM'}
          </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
           {/* Automatically find the Severity and color-code the badge */}
           {(() => {
              const sev = validEntries.find(([k]) => k.toUpperCase() === 'SEVERITY')?.[1] || 'N/A';
              const sevUpper = String(sev).toUpperCase();
              let sevColor = 'var(--text-secondary)'; // Default
              let sevBg = 'rgba(255,255,255,0.05)';
              
              if (sevUpper === 'CRITICAL') {
                  sevColor = 'var(--color-danger)';
                  sevBg = 'var(--badge-danger-bg)';
              } else if (sevUpper === 'MAJOR') {
                  sevColor = 'var(--color-warning)';
                  sevBg = 'rgba(245, 158, 11, 0.1)'; // Amber tint
              }

              return (
                <div style={{
                  background: isDarkMode ? sevBg : 'rgba(0,0,0,0.05)',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  color: sevColor,
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  border: `1px solid ${sevColor}40` // Adds a faint glowing border matching the text
                }}>
                  Severity: {sev}
                </div>
              );
           })()}
        </div>
      </div>

      {/* --- 2. METADATA LIST: Clean, borderless grid for fast scanning --- */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)', /* 4 columns looks perfectly balanced here */
        gap: '24px 16px',
        overflowY: 'auto',
        paddingRight: '8px'
      }} className="custom-scrollbar">
        
        {validEntries.map(([key, value]) => {
          const upperKey = key.toUpperCase();
          
          // Skip the keys we already featured in the Hero Banner so we don't duplicate them
          if (upperKey === 'ALARM TEXT' || upperKey === 'SEVERITY') return null;

          const isTimeCol = key.toLowerCase().includes('time') || key.toLowerCase().includes('date') || key.toLowerCase().includes('stamp');
          let displayShort = String(value);
          let displayOriginal = null;

          // Keep your existing excellent Excel-date parsing logic
          if (isTimeCol && typeof value === 'number' && value > 30000) {
            const dateObj = new Date(Math.round((value - 25569) * 86400 * 1000));
            const m = dateObj.getUTCMonth() + 1;
            const d = dateObj.getUTCDate();
            const y = String(dateObj.getUTCFullYear()).slice(-2);
            const hh = String(dateObj.getUTCHours()).padStart(2, '0');
            const mm = String(dateObj.getUTCMinutes()).padStart(2, '0');
            const ss = String(dateObj.getUTCSeconds()).padStart(2, '0');
            displayOriginal = `${m}/${d}/${y} ${hh}:${mm}:${ss}`;
            displayShort = `${m}/${d}/${y} ${hh}:${mm}`;
          }

          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold', marginBottom: '6px' }}>
                {key}
              </span>
              
              {displayOriginal ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>{displayShort}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Orig: {displayOriginal}</span>
                </div>
              ) : (
                <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: '1.4' }}>
                  {displayShort}
                </span>
              )}
            </div>
          );
        })}
      </div>
      
    </div>
  </div>
);
  };

  const CustomGraphTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '15px', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.6)' : '0 4px 6px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', borderBottom: '1px solid var(--border-light)', paddingBottom: '5px', fontSize: '0.9rem' }}>{data.name}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '25px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total Occurrences:</span>
            <span style={{ fontWeight: 'bold', color: 'var(--color-danger)' }}>{data.count}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '25px', marginTop: '5px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Network Impact:</span>
            <span style={{ fontWeight: 'bold', color: 'var(--color-info)' }}>{data.totalPercentage}%</span>
          </div>
          <p style={{ margin: '10px 0 0 0', fontSize: '0.7rem', color: 'var(--brand-purple)', fontStyle: 'italic' }}>Click to filter table below</p>
        </div>
      );
    }
    return null;
  };

  // ?? 1. ALL VARIABLES MUST BE DEFINED FIRST
  const currentUserName = userInfo?.displayName || userInfo?.name || "Workspace User";
  const currentUserEmail = userInfo?.userId || "user@globe.com.ph"; 
  const myProcessedData = storedData ? storedData.filter(item => item.userId === currentUserEmail) : [];
  
  const engineerName = currentUserName || "Workspace User";
  const userInitial = engineerName.charAt(0).toUpperCase();
  const firstName = (engineerName.split(' ')[0] || '').toUpperCase();

  const lastModifiedName = lastModifiedInfo?.userDisplayName || lastModifiedInfo?.userName || "";
  const lastModifiedTimestamp = lastModifiedInfo?.timestamp
    ? new Date(lastModifiedInfo.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : "No previous sync";

  // ?? 2. HEADER ACTIONS CREATED SECOND (Now it can safely read the variables above!)
const exportOptions = [
  { label: 'Full Export', value: 'ALL' }
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
    <DashboardLayout isLoading={false} logo={currentLogo} onLogoClick={() => navigate("/")} headerActions={headerActions}>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.08); border-radius: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.38); border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(15, 23, 42, 0.52); border: 2px solid transparent; background-clip: padding-box; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(15, 23, 42, 0.38) rgba(15, 23, 42, 0.08); scrollbar-gutter: stable both-edges; }
        body.dark-mode .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.08); }
        body.dark-mode .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.28); border: 2px solid transparent; background-clip: padding-box; }
        body.dark-mode .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.42); border: 2px solid transparent; background-clip: padding-box; }
        body.dark-mode .custom-scrollbar { scrollbar-color: rgba(255, 255, 255, 0.28) rgba(255, 255, 255, 0.08); }
        
        /* 🚀 PREMIUM SKELETON SHIMMER */
        .skeleton-row { opacity: 0.8; }
        .skeleton-bar { background: rgba(15, 23, 42, 0.08); position: relative; overflow: hidden; border: none; }
        body.dark-mode .skeleton-bar { background: rgba(255, 255, 255, 0.06); }
        .skeleton-bar::after { 
          content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
          background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.8) 50%, transparent 100%); 
          transform: translateX(-100%);
          animation: skeleton-shimmer 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        body.dark-mode .skeleton-bar::after { 
          background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.15) 50%, transparent 100%); 
        }
        @keyframes skeleton-shimmer { 100% { transform: translateX(100%); } }
        
        /* 🚀 PREMIUM GLASS TOAST */
        .glass-toast { position: fixed; top: 24px; right: 24px; z-index: 10000; background: linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.25) 100%); backdrop-filter: blur(32px) saturate(200%); -webkit-backdrop-filter: blur(32px) saturate(200%); border: 1px solid rgba(255, 255, 255, 0.7); box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.9), 0 20px 40px rgba(31, 38, 135, 0.15), 0 5px 15px rgba(0, 0, 0, 0.08); border-radius: 16px; padding: 16px 20px; min-width: 320px; max-width: 400px; display: flex; align-items: flex-start; gap: 16px; color: var(--text-primary); overflow: hidden; }
        .glass-toast.success { border-left: 4px solid #0db15c; }
        .glass-toast.error { border-left: 4px solid #f02849; }
        .toast-icon-wrap { display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0; background: rgba(128, 128, 128, 0.1); }
        .toast-icon-wrap.success { background: rgba(13, 177, 92, 0.15); color: #0db15c; }
        .toast-icon-wrap.error { background: rgba(240, 40, 73, 0.15); color: #f02849; }
        .toast-content { flex: 1; display: flex; flex-direction: column; gap: 4px; margin-top: 2px; }
        .toast-title { margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--text-primary); letter-spacing: 0.3px; }
        .toast-message { margin: 0; font-size: 0.85rem; color: var(--text-secondary); white-space: pre-wrap; line-height: 1.4; }
        body.dark-mode .glass-toast { background: linear-gradient(135deg, rgba(17, 28, 68, 0.85) 0%, rgba(17, 28, 68, 0.65) 100%); border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.15), 0 20px 40px rgba(0, 0, 0, 0.6), 0 5px 15px rgba(0, 0, 0, 0.4); }
        body.dark-mode .glass-toast.success { border-left-color: #20d478; }
        body.dark-mode .glass-toast.error { border-left-color: #ff4d6a; }
        body.dark-mode .toast-icon-wrap.success { background: rgba(13, 177, 92, 0.25); color: #20d478; }
        body.dark-mode .toast-icon-wrap.error { background: rgba(240, 40, 73, 0.25); color: #ff4d6a; }
        .toast-progress { position: absolute; bottom: 0; left: 0; height: 4px; background: var(--text-secondary); opacity: 0.3; width: 100%; animation: toastProgress 5s linear forwards; }
        .glass-toast.success .toast-progress { background: #0db15c; opacity: 0.6; }
        .glass-toast.error .toast-progress { background: #f02849; opacity: 0.6; }
        body.dark-mode .glass-toast.success .toast-progress { background: #20d478; }
        body.dark-mode .glass-toast.error .toast-progress { background: #ff4d6a; }
        @keyframes toastProgress { 0% { width: 100%; } 100% { width: 0%; } }
        .glass-toast:hover .toast-progress { animation-play-state: paused; }
        .glass-toast.slide-in { animation: toastSlideInBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .glass-toast.slide-out { animation: toastSlideOut 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        @keyframes toastSlideInBounce { 0% { transform: translateX(150%); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
        @keyframes toastSlideOut { 0% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(150%); opacity: 0; } }
        .toast-close-btn { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.5rem; padding: 0; line-height: 1; margin-top: 0; margin-right: -4px; transition: color 0.2s, transform 0.2s; }
        .toast-close-btn:hover { color: #f02849; transform: scale(1.15); }
      `}</style>

      <main className="main-layout" style={{ display: 'flex', overflow: 'hidden', transition: 'gap 0.4s cubic-bezier(0.4, 0, 0.2, 1)', gap: isSidebarCollapsed ? '0px' : '' }}>
        <aside className="sidebar" style={{ width: isSidebarCollapsed ? '0px' : '320px', minWidth: isSidebarCollapsed ? '0px' : '320px', overflow: 'hidden', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', borderRight: isSidebarCollapsed ? 'none' : '1px solid var(--border-light)', opacity: isSidebarCollapsed ? 0 : 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
            
          {/* ?? THE MODERN HORIZONTAL TAB BAR (Using CSS Classes) */}
            <div className="sa-sidebar-tabs-wrap">
              <div className="sa-sidebar-tabs">
                
                <button 
                  className={`sa-sidebar-tab-btn ${activeSidebarView === 'input' ? 'active' : ''}`}
                  onClick={() => handleSidebarViewChange('input')} 
                >
                  Input
                </button>

                <button 
                  className={`sa-sidebar-tab-btn ${activeSidebarView === 'analytics' ? 'active' : ''}`}
                  onClick={() => handleSidebarViewChange('analytics')} 
                  disabled={results.length === 0} 
                >
                  Analytics
                </button>

                <button 
                  className={`sa-sidebar-tab-btn ${activeSidebarView === 'details' ? 'active' : ''}`}
                  onClick={() => handleSidebarViewChange('details')} 
                  disabled={!selectedRowDetails} 
                >
                  Details
                </button>

                <button 
                  className={`sa-sidebar-tab-btn ${activeSidebarView === 'history' ? 'active' : ''}`}
                  onClick={() => handleSidebarViewChange('history')} 
                >
                  History
                </button>

              </div>
            </div>

            <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={getSidebarPanelStyle('input')}>
                <div style={sidebarInnerCardStyle}>
                  <div className="data-input-section" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                        {dashboardMode === 'wireless' ? 'Wireless' : 'Transport'}
                      </h3>
                      <button 
                        onClick={handleModeToggle}
                        title="Swap Dashboard Mode"
                        style={{ background: isDarkMode ? 'var(--bg-input)' : '#ffffff', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: isDarkMode ? '#ffffff' : 'var(--brand-purple)', fontSize: '0.75rem', fontWeight: 'bold', transition: 'all 0.2s', outline: 'none' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3v18"/><path d="M10 18l-3 3-3-3"/><path d="M7 3v18"/><path d="M20 6l-3-3-3 3"/></svg>
                      </button>
                    </div>

                    <div className="upload-group">
                      <span className="input-label">NMS File</span>
                      <div className="file-drop-area">
                        <img src={isDarkMode ? fileDark : fileLight} className="upload-icon" alt="icon" style={{ width: '20px' }} />
                        <span className="file-msg" style={{ marginTop: '8px' }}>{monitorFile1 ? monitorFile1.name : "Drag .xlsx, .xls, or .csv"}</span>
                        <input className="file-input" type="file" accept=".csv, .xlsx, .xls" onChange={(e) => handleFileChange(e, setMonitorFile1)} ref={monitorFile1Ref} />
                      </div>
                    </div>
                    <div className="upload-group" style={{
                      marginTop: isWirelessMode ? '20px' : '0px',
                      maxHeight: isWirelessMode ? '260px' : '0px',
                      opacity: isWirelessMode ? 1 : 0,
                      overflow: 'hidden',
                      transition: 'max-height 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease, margin-top 0.35s ease',
                      pointerEvents: isWirelessMode ? 'auto' : 'none'
                    }}>
                      <span className="input-label">SA MASTERLIST File</span>
                      <div className="file-drop-area">
                        <img src={isDarkMode ? fileDark : fileLight} className="upload-icon" alt="icon" style={{ width: '20px' }} />
                        <span className="file-msg" style={{ marginTop: '8px' }}>{monitorFile2 ? monitorFile2.name : "Drag .xlsx, .xls, or .csv"}</span>
                        <input className="file-input" type="file" accept=".csv, .xlsx, .xls" onChange={(e) => handleFileChange(e, setMonitorFile2)} ref={monitorFile2Ref} />
                      </div>
                    </div>
                    <button className="btn primary-filled scan-btn full-width" onClick={handleScan} disabled={isLoading} style={{background: 'var(--brand-purple)', color: '#ffffff', border: 'none', marginTop: '10px', padding: '12px', outline: 'none', transform: dashboardMode === 'transport' ? 'translateY(-4px)' : 'translateY(0)', transition: 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)', willChange: 'transform' }}>
                      <img src={searchIcon} alt="Scan" className="btn-icon" style={{ width: '16px', marginRight: '8px' }} />
                      <span>{isLoading ? "Processing Data..." : "Scan Data"}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div style={getSidebarPanelStyle('analytics')}>
                <div style={sidebarInnerCardStyle}>
                   {((isInitialDataLoading || isLoading || isStoredDataLoading) && results.length === 0) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Top Alarms</h3>
                        <div className="skeleton-bar" style={{ width: '60px', height: '24px', borderRadius: '4px' }}></div>
                      </div>
                      <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', overflowX: 'hidden', paddingRight: '5px' }}>
                        {[...Array(5)].map((_, i) => (
                          <div key={i} style={{ width: '100%', background: 'var(--bg-primary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', boxSizing: 'border-box' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <div className="skeleton-bar" style={{ height: '12px', width: '60%', borderRadius: '4px' }}></div>
                              <div className="skeleton-bar" style={{ height: '12px', width: '15%', borderRadius: '4px' }}></div>
                            </div>
                            <div className="skeleton-bar" style={{ height: '6px', width: '100%', borderRadius: '3px' }}></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : alarmStats.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Top Alarms</h3>
                        <button ref={expandBtnRef} onClick={openGraphModal} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--color-info)', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', padding: '5px 10px', borderRadius: '4px', outline: 'none' }}>Expand</button>
                      </div>
                      <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', overflowX: 'hidden', paddingRight: '5px' }}>
                        {alarmStats.map((stat, i) => ( 
                          <div key={i} style={{ width: '100%', background: 'var(--bg-primary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', boxSizing: 'border-box' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px', fontWeight: 'bold' }}>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '80%', color: 'var(--text-primary)' }}>{stat.name}</span>
                              <span style={{ color: 'var(--color-danger)' }}>{stat.count}</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${stat.percentage}%`, background: 'var(--brand-gradient)', borderRadius: '3px', transition: 'width 1s ease-out' }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>No analytics data to show.</div>
                  )}
                </div>
              </div>

              <div style={getSidebarPanelStyle('details')}>
                <div style={sidebarInnerCardStyle}>
                  {selectedRowDetails ? (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                      <h3 style={{ margin: 0, marginBottom: '20px', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Alert Breakdown</h3>
                      <div className="details-content custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ background: 'var(--bg-primary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-light)', borderLeft: '4px solid var(--color-danger)' }}>
                          <span className="input-label" style={{ fontSize: '0.75rem' }}>Alert Count</span>
                          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-danger)', marginTop: '5px' }}>{selectedRowDetails.count} <span style={{fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Repetitions</span></div>
                        </div>
                        <div style={{ background: 'var(--bg-primary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                          <span className="input-label" style={{ fontSize: '0.75rem' }}>{dashboardMode === 'wireless' ? 'PLA_ID' : 'SEVERITY'}</span>
                          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '5px' }}>
                            {selectedRowDetails.pla}
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg-primary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                          <span className="input-label" style={{ fontSize: '0.75rem' }}>Site Name</span>
                          <div style={{ fontWeight: 'bold', marginTop: '5px', wordBreak: 'break-word', color: 'var(--color-info)', fontSize: '1rem' }}>
                            {selectedRowDetails.name}
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg-primary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                          <span className="input-label" style={{ fontSize: '0.75rem' }}>Alarm Text</span>
                          <div style={{ fontWeight: 'bold', marginTop: '5px', wordBreak: 'break-word', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                            {selectedRowDetails.alert}
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg-primary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                          <span className="input-label" style={{ fontSize: '0.75rem' }}>{dashboardMode === 'wireless' ? 'Distinguished Name' : 'Location Info'}</span>
                          <div style={{ fontFamily: 'monospace', marginTop: '5px', wordBreak: 'break-all', fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-input)', padding: '8px', borderRadius: '4px' }}>
                            {selectedRowDetails.dn}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>Select a row to see details.</div>
                  )}
                </div>
              </div>

              <div style={getSidebarPanelStyle('history')}>
                <div style={sidebarInnerCardStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
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
                        {lastModifiedInfo.action} â€¢ {lastModifiedInfo.fileName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {new Date(lastModifiedInfo.timestamp).toLocaleString()}
                      </div>
                    </div>
                  )}

                  <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
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
                            
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                              Ran by: <span style={{color: 'var(--text-primary)', fontWeight: '600'}}>{item.metadata?.engineerName || "Workspace User"}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontSize: '0.8rem', color: 'var(--color-info)' }}>
                                {item.dataType} â€¢ {item.processedCount ?? item.metadata?.processedRecords ?? 0} results
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
                        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>[??]</div>
                        <div>No stored data found</div>
                        <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>Process some data to see it here</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </div>
        </aside>

        <section className="content-area" style={{ position: 'relative', flex: 1, minWidth: 0, transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', marginLeft: isSidebarCollapsed ? '0px' : '', paddingLeft: isSidebarCollapsed ? '0px' : '' }}>
          <div className="output-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', transition: 'padding 0.4s ease' }}>
            <div className="table-toolbar" style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--brand-purple)', color: 'white', flexWrap: 'wrap', gap: '12px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: '1 1 auto', minWidth: 0 }}>
                  <button className="sidebar-toggle-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.3s ease', transform: isSidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <img src={warningDark} alt="Alerts" style={{ width: '24px' }} />
                  <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-inverse)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dashboardMode === 'wireless' ? 'Wireless Critical Alerts' : 'Transport Critical Alerts'} ({Math.max(expectedResultCount, results.length)})
                  </h2>
                  
                  {loadedDataSource && results.length > 0 && (
                    <div
                      className="loaded-data-badge"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        border: '2px solid var(--border-light)',
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
                      <span style={{ fontSize: '0.75em', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Ran by: <span style={{ color: 'white', fontWeight: 600, marginRight: '4px' }}>{loadedDataSource.engineerName}</span>
                        | <span style={{ color: 'white', fontWeight: 600, marginLeft: '4px' }}>{loadedDataSource.date} {loadedDataSource.time}</span>
                      </span>
                    </div>
                  )}
               </div>
              <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 0, maxWidth: '320px', width: '100%' }}>
                <input type="text" className="search-bar" placeholder="Search ID, Name, or Alarm..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={results.length === 0} style={{ outline: 'none', width: '100%', boxSizing: 'border-box', paddingRight: '92px', color: 'var(--text-inverse'}}/>
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--text-inverse)', opacity: (isSearchUpdating || ((isInitialDataLoading || isLoading || isStoredDataLoading) && results.length > 0)) ? 0.9 : 0, pointerEvents: 'none', transition: 'opacity 0.12s ease' }}>
                  {isSearchUpdating ? "Searching..." : "Syncing..."}
                </span>
              </div>
            </div>

            <div className="output-box" style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div className="table-wrapper" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', padding: '12px 35px 12px 20px', fontWeight: 'bold', borderBottom: isDarkMode ? '2px solid var(--border-color)' : '2px solid rgba(15, 23, 42, 0.18)', backgroundColor: 'var(--btn-scan-bg)', textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--text-inverse)' }}>
                  <div style={{ width: '12%', paddingRight: '15px' }}>{dashboardMode === 'wireless' ? 'PLA_ID' : 'SEVERITY'}</div>
                  <div style={{ width: '23%', paddingRight: '15px', color: 'var(--text-inverse)' }}>Site Name</div>
                  <div style={{ width: '20%', paddingRight: '15px' }}>Alarm Text</div>
                  <div style={{ width: '37%', paddingRight: '15px' }}>{dashboardMode === 'wireless' ? 'Distinguished Name' : 'Location Info'}</div>
                  <div style={{ width: '8%', paddingRight: '15px', textAlign: 'center' }}>Count</div>
                </div>
                <div ref={listContainerRef} style={{ flex: 1, width: '100%', overflow: 'hidden', position: 'relative' }}>
                  {(() => {
                    // 1. Define states cleanly
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
                          <List height={mainListSize.height} itemCount={filteredResults.length} itemSize={70} width={mainListSize.width} overscanCount={10} className="custom-scrollbar" onScroll={handleMainListScroll}>
                            {VirtualizedRow}
                          </List>
                          {(showTableLoadingHint || isFullDataLoading) && (
                            <div
                              style={{
                                position: 'absolute',
                                right: 16,
                                bottom: 16,
                                zIndex: 30,
                                background: isDarkMode ? 'rgba(17, 28, 68, 0.85)' : 'rgba(255, 255, 255, 0.92)',
                                border: '1px solid var(--border-light)',
                                borderRadius: '999px',
                                padding: '6px 12px',
                                fontSize: '0.75rem',
                                color: 'var(--text-primary)',
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                pointerEvents: 'none'
                              }}
                            >
                              Loading data...
                            </div>
                          )}
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
                                <div key={`sa-table-overlay-skeleton-${i}`} className="skeleton-row" style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: '70px', borderBottom: "1px solid rgba(128,128,128,0.05)", boxSizing: 'border-box' }}>
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
                          <div key={i} className="skeleton-row" style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: '70px', borderBottom: "1px solid rgba(128,128,128,0.05)", boxSizing: 'border-box' }}>
                            <div style={{ width: '12%', paddingRight: '15px' }}><div className="skeleton-bar" style={{ height: '12px', width: '60%', borderRadius: '4px' }}></div></div>
                            <div style={{ width: '23%', paddingRight: '15px' }}><div className="skeleton-bar" style={{ height: '12px', width: '80%', borderRadius: '4px' }}></div></div>
                            <div style={{ width: '20%', paddingRight: '15px' }}><div className="skeleton-bar" style={{ height: '12px', width: '70%', borderRadius: '4px' }}></div></div>
                            <div style={{ width: '37%', paddingRight: '15px' }}><div className="skeleton-bar" style={{ height: '12px', width: '90%', borderRadius: '4px' }}></div></div>
                            <div style={{ width: '8%', paddingRight: '15px', display: 'flex', justifyContent: 'center' }}><div className="skeleton-bar" style={{ height: '24px', width: '30px', borderRadius: '12px' }}></div></div>
                          </div>
                        ))}

                        <div
                          style={{
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isDarkMode ? 'linear-gradient(180deg, rgba(18, 22, 30, 0.32), rgba(18, 22, 30, 0.46))' : 'linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.42))',
                            backdropFilter: 'blur(16px) saturate(150%)', WebkitBackdropFilter: 'blur(16px) saturate(150%)',
                            borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.55)', zIndex: 10
                          }}
                        >
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

      {/* THE VIRTUALIZED DRILL-DOWN MACBOOK MODAL */}
      {isDrillDownRendered && drillDownData && (
        <div className="map-modal-overlay" onClick={closeDrillDownModal} style={{ opacity: isDrillDownVisible ? 1 : 0, transition: 'opacity 0.3s ease', zIndex: 1000 }}>
          <div className="map-modal-content" onClick={e => e.stopPropagation()} style={{ width: '85%', height: '90%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', borderRadius: '16px', overflow: 'hidden', transformOrigin: drillDownOrigin, transform: isDrillDownVisible ? 'scale(1) translateY(0)' : 'scale(0.05) translateY(50px)', opacity: isDrillDownVisible ? 1 : 0, transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease', boxShadow: isDrillDownVisible ? (isDarkMode ? '0 25px 50px -12px rgba(0, 0, 0, 0.9)' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)') : 'none' }}>
            <div className="map-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--brand-gradient)', color: 'white', padding: '20px 30px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'white' }}>{drillDownData.name} ({drillDownData.pla})</h3>
                <p style={{ margin: '5px 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>{drillDownData.alert}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ background: 'white', color: isDarkMode ? 'var(--color-danger)' : 'var(--color-danger)', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold' }}>{filteredModalRows.length} Occurrences</div>
                <button onClick={closeDrillDownModal} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', outline: 'none', marginBottom: '10px' }}>x</button>
              </div>
            </div>
            
            <div style={{ padding: '15px 30px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-secondary)'}}>RAW NMS DATA LOG (CLEANED)</span>
              <input type="text" placeholder="Search raw logs..." value={modalSearchTerm} onChange={(e) => setModalSearchTerm(e.target.value)} style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', width: '250px', outline: 'none' }} />
            </div>

            <div style={{ flex: 1, padding: '20px 30px 0 30px', overflow: 'hidden' }}>
              {filteredModalRows.length > 0 ? (
                <VariableSizeList height={modalListHeight} itemCount={filteredModalRows.length} itemSize={getModalRowHeight} width="100%" overscanCount={2} className="custom-scrollbar">
                  {VirtualizedModalRow}
                </VariableSizeList>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No logs match your search.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* THE ENTERPRISE ANALYTICS MODAL */}
      {isGraphModalRendered && (
        <div className="map-modal-overlay" onClick={closeGraphModal} style={{ opacity: isGraphModalVisible ? 1 : 0, transition: 'opacity 0.3s ease', zIndex: 999 }}>
          <div className="map-modal-content" onClick={e => e.stopPropagation()} style={{ width: '80%', height: '85%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', borderRadius: '16px', overflow: 'hidden', transformOrigin: graphModalOrigin, transform: isGraphModalVisible ? 'scale(1) translateY(0)' : 'scale(0.05) translateY(50px)', opacity: isGraphModalVisible ? 1 : 0, transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease', boxShadow: isGraphModalVisible ? (isDarkMode ? '0 25px 50px -12px rgba(0, 0, 0, 0.9)' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)') : 'none' }}>
            <div className="map-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--brand-gradient)', color: 'white', padding: '15px 30px' }}>
              <div><h3 style={{ margin: 0, fontSize: '1.4rem', color: 'white' }}>Enterprise Analytics Overview</h3></div>
              <button onClick={closeGraphModal} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', outline: 'none', marginBottom: '10px' }}>x</button>
            </div>
            
            <div className="custom-scrollbar" style={{ flex: 1, padding: '25px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>

                <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)', boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Occurrences</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: isDarkMode ? '#ffffff' : 'var(--brand-purple)', marginTop: '5px' }}>{totalOccurrences}</div>
                </div>
                <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)', boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Unique Sites Affected</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: 'var(--color-info)', marginTop: '5px' }}>{uniqueSitesCount}</div>
                </div>
                <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)', boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Unique Alarm Types</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: 'var(--brand-purple)', marginTop: '5px' }}>{uniqueAlarmTypesCount}</div>
                </div>
                <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)', borderTop: '4px solid var(--color-danger)', boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Most Critical Alarm</div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--color-danger)', marginTop: '10px', wordBreak: 'break-word', lineHeight: '1.2' }}>{mostCriticalAlarm}</div>
                </div>

                <div style={{ gridColumn: 'span 4', background: 'var(--bg-input)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', height: '320px', boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <h4 style={{ margin: '0 0 15px 0', color: 'var(--text-primary)' }}>Alarm Frequency (All Types)</h4>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart 
                        data={alarmStats} 
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }} 
                        onClick={(state) => {
                          if (state && state.activePayload && state.activePayload.length > 0) {
                            setSelectedGraphAlarm(state.activePayload[0].payload.name);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          stroke="var(--text-secondary)" 
                          tick={{fontSize: 10, fill: isDarkMode ? '#8BA1B5' : 'var(--text-secondary)'}} 
                          angle={-35} 
                          textAnchor="end" 
                          height={60} 
                          tickFormatter={(val) => val.length > 20 ? val.substring(0,20)+'...' : val} 
                        />
                        <YAxis stroke="var(--text-secondary)" tick={{fontSize: 12}} />
                        <RechartsTooltip cursor={{fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}} content={<CustomGraphTooltip />} />
                        <Bar 
                          dataKey="count" 
                          radius={[4, 4, 0, 0]} 
                          animationDuration={1000} 
                          style={{ outline: 'none' }}
                          minPointSize={20}
                          background={{ fill: 'rgba(0,0,0,0.001)' }}
                          activeBar={<Rectangle fillOpacity={0.8} stroke="var(--brand-purple)" />}
                          onClick={(data) => {
                             if(data && data.name) setSelectedGraphAlarm(data.name);
                          }}
                        >
                          {alarmStats.map((entry, index) => (<Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p style={{ textAlign: 'center', margin: '5px 0 0 0', fontSize: '0.65rem', color: 'var(--brand-purple)', fontStyle: 'italic' }}>Click anywhere on a bar's column to filter below</p>
                </div>

                <div style={{ gridColumn: 'span 4', background: 'var(--bg-input)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', height: '350px', boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>
                      {selectedGraphAlarm ? `Filtered: Sites Experiencing "${selectedGraphAlarm}"` : 'Most Affected Sites Overview (Top 50)'}
                    </h4>
                    {selectedGraphAlarm && (
                      <button onClick={() => setSelectedGraphAlarm(null)} style={{ padding: '6px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', outline: 'none' }}>
                        Clear Filter ?
                      </button>
                    )}
                  </div>
                  
                  <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                     <div style={{ display: 'flex', padding: '10px', fontWeight: 'bold', borderBottom: '2px solid var(--border-color)', color: 'var(--text-inverse)', textTransform: 'uppercase', fontSize: '0.8rem', position: 'sticky', top: 0, background: 'var(--btn-scan-bg)', zIndex: 1 }}>
                        <div style={{ width: '15%' }}>{dashboardMode === 'wireless' ? 'PLA_ID' : 'SEVERITY'}</div>
                        <div style={{ width: '25%' }}>Site Name</div>
                        <div style={{ width: '40%' }}>Alarm Text</div>
                        <div style={{ width: '20%', textAlign: 'center' }}>Repetitions</div>
                     </div>
                     {topSitesData.map((row, idx) => (
                        <div key={idx} style={{ display: 'flex', padding: '12px 10px', borderBottom: '1px solid var(--border-light)', alignItems: 'center' }}>
                           <div style={{ width: '15%', fontWeight: 'bold', color: dashboardMode === 'transport' ? 'var(--color-danger-light)' : 'var(--text-primary)', fontSize: '0.85rem' }}>
                             {row.pla}
                           </div>
                           <div style={{ width: '25%', fontWeight: 'bold', color: 'var(--color-info)', fontSize: '0.85rem' }}>
                             {row.name}
                           </div>
                           <div style={{ width: '40%', fontSize: '0.8rem', color: 'var(--text-secondary)', paddingRight: '10px' }}>
                             {row.alert}
                           </div>
                           <div style={{ width: '20%', fontWeight: 'bold', color: 'var(--color-danger)', fontSize: '1rem', textAlign: 'center' }}>{row.count}</div>
                        </div>
                     ))}
                  </div>
                </div>
              </div>
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
