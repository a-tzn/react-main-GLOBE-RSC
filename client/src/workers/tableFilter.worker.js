// tableFilter.worker.js

// 1. We store highly optimized, lightweight representations of the data
let saSearchableData = []; 
let smSearchableData = [];

self.onmessage = function (e) {
  const payload = e.data;

  // ==========================================
  // SITE ALERT (SADashboard) - Pure Text Search
  // ==========================================
  if (payload.type === 'INIT_SITE') {
    const rows = payload.rows || [];
    
    // Map to a pure flat array of strings for maximum speed
    saSearchableData = rows.map(row => {
      return [row.alert, row.name, row.dn, row.pla, row.li, row.sn]
        .filter(val => val != null && val !== '')
        .map(val => String(val).toLowerCase())
        .join(' ');
    });
  }

  if (payload.type === 'QUERY_SITE') {
    const term = String(payload.term || '').toLowerCase().trim();
    const requestId = payload.requestId;
    
    const indices = [];
    for (let i = 0; i < saSearchableData.length; i++) {
      if (!term || saSearchableData[i].includes(term)) {
        indices.push(i);
      }
    }
    
    self.postMessage({ type: 'RESULT_SITE', requestId, indices });
  }

  // ==========================================
  // STORM MASTERLIST (SMDashboard) - Text + Status + Sort
  // ==========================================
  if (payload.type === 'INIT_STORM') {
    const rows = payload.rows || [];
    
    // Map to lightweight objects. We compute the search string once, 
    // but retain necessary metadata for sorting and status filtering.
    smSearchableData = rows.map((row, index) => {
      return {
        originalIndex: index,
        searchStr: [row.plaId, row.baseLocation, row.remarks, row.nmsName]
          .filter(val => val != null && val !== '')
          .map(val => String(val).toLowerCase())
          .join(' '),
        status: row.matchStatus,
        baseLocation: row.baseLocation || '',
        nmsName: row.nmsName || ''
      };
    });
  }

  if (payload.type === 'QUERY_STORM') {
    const term = String(payload.term || '').toLowerCase().trim();
    const filterStatus = payload.filterStatus || 'ALL';
    const requestId = payload.requestId;

    // 1. Filter by Status and Search Term
    let filtered = smSearchableData.filter(item => {
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
      if (term && !item.searchStr.includes(term)) return false;
      return true;
    });

    // 2. Apply Sorting Logic (Mirrors SMDashboard Fallback exactly)
    const statusOrder = ['NEW', 'MISMATCH', 'UNCHANGED', 'REMOVED'];
    filtered.sort((a, b) => {
      const orderA = statusOrder.indexOf(a.status);
      const orderB = statusOrder.indexOf(b.status);
      
      if (orderA !== orderB) return orderA - orderB;
      
      const baseCompare = a.baseLocation.localeCompare(b.baseLocation, undefined, { numeric: true, sensitivity: 'base' });
      if (baseCompare === 0) {
        return a.nmsName.localeCompare(b.nmsName);
      }
      return baseCompare;
    });

    // 3. Extract the original indices to send back to the dashboard
    const indices = filtered.map(item => item.originalIndex);
    
    self.postMessage({ type: 'RESULT_STORM', requestId, indices });
  }
};
