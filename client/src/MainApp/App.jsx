import { useState, useEffect } from 'react';
import AnalyticsDashboard from '../Dashboard/AnalyticsDashboard';
import MapVisualizer from '../Map/MapVisualizer';
import globeLogoDark from '../assets/Globe_LogoW.png'; 
import globeLogoLight from '../assets/Globe_LogoB.png'; 
import * as XLSX from 'xlsx';

import { provinces, cities, siteCodes, cityToProvinceMap, cityToBarangayMap, regionsToProvincesMap } from './MapDictionary/TelecomDictionaries';
import './App.css';

// ============================================================================
// HELPER: TELECOM GEOGRAPHIC PARSER (Safe Version)
// ============================================================================
const parseLocationData = (baseName) => {
  if (!baseName) return { siteCode: "", place: "", city: "", province: "", region: "" };

  let remainingString = baseName.toUpperCase().trim();

  const provKeys = Object.keys(provinces).sort((a, b) => b.length - a.length);
  const cityKeys = Object.keys(cities).sort((a, b) => b.length - a.length);

  let extracted = { siteCode: "", place: "", city: "", province: "", region: "" };

  // 1️⃣ PROVINCE PEEL
  for (const prov of provKeys) {
    const regex = new RegExp(`${prov}(\\d+)?((?:IO|ID|AS|CO|[XYLFWKHVZJBMNPRT])*)$`, "i");
    const match = remainingString.match(regex);
    if (match) {
      extracted.province = provinces[prov];
      remainingString = remainingString.slice(0, remainingString.length - match[0].length);
      break;
    }
  }

  // 2️⃣ CITY PEEL (PROVINCE-AWARE VERSION)
  for (const cityKey of cityKeys) {
    const cityName = cities[cityKey];
    const provinceOfCity = cityToProvinceMap[cityName];

    if (!provinceOfCity) continue;

    // ✅ Only allow city if province matches extracted province
    if (extracted.province && provinceOfCity !== extracted.province) {
      continue;
    }

    const regex = new RegExp(`${cityKey}(\\d+)?((?:IO|ID|AS|CO|[XYLFWKHVZJBMNPRT])*)$`, "i");
    const match = remainingString.match(regex);

    if (match) {
      extracted.city = cityName;
      remainingString = remainingString.slice(0, remainingString.length - match[0].length);
      break;
    }
  }

  // 3️⃣ SITE CODE PEEL
  const sortedCodes = [...siteCodes].sort((a, b) => b.length - a.length);
  for (const code of sortedCodes) {
    if (remainingString.startsWith(code)) {
      extracted.siteCode = code;
      remainingString = remainingString.slice(code.length);
      break;
    }
  }

  extracted.place = remainingString.trim();

  // 4️⃣ AUTO-FILL CITY FROM BARANGAY (SAFE VERSION)
  if (!extracted.city && extracted.place) {
    const cleanPlace = extracted.place
      .replace(/\d*(?:IO|ID|AS|CO|[XYLFWKHVZJBMNPRT])*$/i, "")
      .trim()
      .toUpperCase();

    for (const [city, barangays] of Object.entries(cityToBarangayMap)) {
      const provinceOfCity = cityToProvinceMap[city];

      // ✅ Only check cities within detected province
      if (extracted.province && provinceOfCity !== extracted.province) {
        continue;
      }

      const upperBarangays = barangays.map(b => b.toUpperCase());

      if (upperBarangays.includes(cleanPlace)) {
        extracted.city = city;
        extracted.place = cleanPlace;
        break;
      }
    }
  }

  // 5️⃣ AUTO-FILL PROVINCE FROM CITY
  if (!extracted.province && extracted.city) {
    extracted.province = cityToProvinceMap[extracted.city] || "";
  }

  // 6️⃣ AUTO-FILL REGION FROM PROVINCE
  if (extracted.province) {
    for (const [regionName, provinceArray] of Object.entries(regionsToProvincesMap)) {
      if (provinceArray.includes(extracted.province)) {
        extracted.region = regionName;
        break;
      }
    }
  }

  return extracted;
};

// ============================================================================
// HELPER 2: TECHNOLOGY SPLITTER (Improved)
// ============================================================================
const getTechSplits = (suffix) => {
  const s = (suffix || "").toUpperCase();
  let res = { g2: "", g4: "", g5: "" };

  if (!s || /^(?:ID|AS)+$/i.test(s)) {
    res.g2 = "YES";
  }

  for (let char of s) {
    if ("MNPRT".includes(char)) res.g5 += char;
    else if ("FHLKWYVB".includes(char)) res.g4 += char;
    else if (char === "X") res.g2 = "X";
  }

  // ❌ Removed forced 2G fallback (business-safe)
  // if (!res.g2 && (res.g4 || res.g5)) res.g2 = "YES";

  return res;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
function LoadingScreen({ logo }) {
  return (
    <div className="loading-overlay">
      <div className="spinner-box">
        <div className="spinner-ripple"></div>
        <div className="spinner-ring"></div>
        <img src={logo} alt="Loading..." className="loading-logo" />
      </div>
      <p className="loading-text">Processing Delta Comparison...</p>
    </div>
  );
}

export default function App() {
  const [monitorFile1, setMonitorFile1] = useState(null);
  const [monitorFile2, setMonitorFile2] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedSite, setSelectedSite] = useState({ lat: 7.05568, lng: 125.5469, zoom: 15 });
  const [showBigMap, setShowBigMap] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  const [selectedRowDetails, setSelectedRowDetails] = useState(null);

  useEffect(() => {
    if (isDarkMode) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);
  const currentLogo = isDarkMode ? globeLogoDark : globeLogoLight;

  const filteredResults = results.filter(row => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = [row.plaId, row.techName, row.baseLocation, row.remarks]
      .filter(Boolean).some(value => value.toString().toLowerCase().includes(term));
    const matchesStatus = filterStatus === 'ALL' ? true : row.matchStatus === filterStatus;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const baseA = a.baseLocation || "";
    const baseB = b.baseLocation || "";
    const baseCompare = baseA.localeCompare(baseB, undefined, { numeric: true, sensitivity: 'base' });
    
    if (baseCompare === 0) {
      const plaA = a.plaId || "";
      const plaB = b.plaId || "";
      return plaA.localeCompare(plaB, undefined, { numeric: true, sensitivity: 'base' });
    }
    
    return baseCompare;
  });

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

 const getShortRegionByProvince = (province) => {
    if (!province) return "";

    province = province.toUpperCase().trim();

    for (const [regionName, provinces] of Object.entries(regionsToProvincesMap)) {
      if (provinces.includes(province)) {
        return regionName; // Found the region
      }
    }

    return ""; // Return empty string if not found
  };

 const handleSpecificExport = (exportCategory) => {
    setShowExportMenu(false);
    if (results.length === 0) return alert("No data to export.");

    const dataToExport = exportCategory === 'ALL' ? results : results.filter(row => row.matchStatus === exportCategory);
    if (dataToExport.length === 0) return alert(`There are no "${exportCategory}" sites to export.`);

  //Column Headers and Data Mapping Logic
  const excelData = dataToExport.map(row => {
  const geo = parseLocationData(row.baseLocation);
  const tech = getTechSplits(row.technologySuffix);
  const reg = getShortRegionByProvince(row.prov);

  return {
    "Region": "MIN",
    "PLA ID": row.plaId || "",
    "PLA Status": "",
    "Area": row.sArea || "",
    "Region ": (geo.region || reg) || "",
    "Province": (geo.province || row.prov) || "",
    "City/Municipality": (geo.city || row.mCity) || "",
    "Barangay": geo.place || "",
    "Site Address": row.sAdd || "",
    "Longitude": row.lng || "",
    "Latitude": row.lat || "",
    "2G": tech.g2 || "",
    "4G": tech.g4 || "",
    "5G": tech.g5 || "",
    "Techname/BTS": row.techName || "",
    "Tech Description": "",
    "Tech Status": "",
    "Site Owner": row.siteOwner || geo.siteCode || "GLOBE TELECOM",
    "Territory": row.trt || "",
    "Hiroshima Severity": row.hSvr || "",
    "Remarks": row.remarks || "",
    "Remarks Status": row.matchStatus || ""
  };
});

    // 2. Create a new worksheet from our data
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // 3. AUTO-FIT COLUMNS LOGIC
    // We get the headers by looking at the keys of the first object
    const headers = Object.keys(excelData[0]);
    
    const columnWidths = headers.map(header => {
      let maxLength = header.length; // Start with header length
      
      // Loop through every row to find the longest string in this column
      excelData.forEach(row => {
        const cellValue = row[header] ? row[header].toString() : "";
        if (cellValue.length > maxLength) {
          maxLength = cellValue.length;
        }
      });
      
      return { wch: maxLength + 2 }; // +2 for padding
    });

    // Apply the calculated widths to the worksheet
    worksheet['!cols'] = columnWidths;

    // 4. Create the workbook and trigger the download
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Masterlist Data");
    
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `StormMasterlist_${exportCategory === 'ALL' ? 'Complete' : exportCategory}_${dateStr}.xlsx`;
    
    // Write the file directly (This replaces all the old Blob/CSV code!)
    XLSX.writeFile(workbook, fileName);
  };

  const handleScan = async () => {
    if (!monitorFile1 || !monitorFile2) return alert("Please upload both CSV files.");
    setIsLoading(true);
    setResults([]);
    setFilterStatus('ALL');
    setSelectedRowDetails(null);

    try {
      const text1 = await readFileAsText(monitorFile1);
      const text2 = await readFileAsText(monitorFile2);

      setTimeout(() => {
        if (window.google && window.google.script) {
           window.google.script.run
             .withSuccessHandler((resRaw) => {
               const res = JSON.parse(resRaw);
               if (res.success) {
                 setResults(res.data);
                 if (res.count === 0) alert("No data parsed. Check CSV format.");
               } else alert("Error: " + res.error);
               setIsLoading(false);
             })
             .withFailureHandler((err) => {
               alert("Connection Failed: " + err);
               setIsLoading(false);
             })
             .processCSVComparison(text1, text2);
        } else {
           const mockData = [];
           const statuses = ["UNCHANGED", "MISMATCH", "NEW", "REMOVED"];
           for(let i=1; i<=50; i++) {
             mockData.push({ 
               plaId: `MIN_${String(i).padStart(4, '0')}`, 
               matchStatus: statuses[i % 4], 
               techName: `SITENAME${i}DDNLYK`, 
               baseLocation: `SITENAME${i}DDN`,
               technologySuffix: "LYK",
               remarks: "Mock data generated.",
               lat: (7.0 + (Math.random() * 0.5)).toFixed(5), 
               lng: (125.4 + (Math.random() * 0.5)).toFixed(5) 
             });
           }
           setResults(mockData);
           setIsLoading(false);
        }
      }, 1000);
    } catch (error) {
      alert("Error: " + error.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      {isLoading && <LoadingScreen logo={currentLogo} />}

      <header className="top-bar">
        <div className="logo-section">
          <img className="globe-logo" src={currentLogo} alt="Globe Logo" />
        </div>
        
        <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
          <button className="btn theme-toggle" onClick={toggleTheme} title="Toggle Theme">
            {isDarkMode ? "☀️ Light" : "🌙 Dark"}
          </button>

          <div className="export-dropdown-container" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setShowExportMenu(false); }} tabIndex={-1}>
            <button className="btn primary-outline export-toggle-btn" onClick={() => setShowExportMenu(!showExportMenu)}>
              Export Data ▾
            </button>
            {showExportMenu && (
              <div className="export-menu">
                <button onClick={() => handleSpecificExport('ALL')}>Storm Masterlist</button>
                <button onClick={() => handleSpecificExport('NEW')}>New Sites Only</button>
                <button onClick={() => handleSpecificExport('REMOVED')}>Removed Only</button>
                <button onClick={() => handleSpecificExport('MISMATCH')}>Mismatches Only</button>
                <button onClick={() => handleSpecificExport('UNCHANGED')}>Unchanged Only</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="main-layout">
        <aside className="sidebar">
          <div className="sidebar-top-section">
            <div className={`sidebar-carousel ${selectedRowDetails ? 'show-details' : ''}`}>
              
              <div className="carousel-panel">
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.2rem' }}>Data Input</h3>
                <div className="upload-group">
                  <label className="input-label">NMS CSV</label>
                  <div className="file-drop-area">
                    <span className="file-msg">{monitorFile1 ? monitorFile1.name : "Drag & drop or click"}</span>
                    <input className="file-input" type="file" accept=".csv" onChange={(e) => setMonitorFile1(e.target.files[0])} />
                  </div>
                </div>
                <div className="upload-group">
                  <label className="input-label">UDM CSV</label>
                  <div className="file-drop-area">
                    <span className="file-msg">{monitorFile2 ? monitorFile2.name : "Drag & drop or click"}</span>
                    <input className="file-input" type="file" accept=".csv" onChange={(e) => setMonitorFile2(e.target.files[0])} />
                  </div>
                </div>
                <button className="btn primary-filled full-width" onClick={handleScan} disabled={isLoading} style={{ marginTop: 'auto' }}>
                  {isLoading ? "Scanning..." : "Scan Files"}
                </button>
              </div>

              <div className="carousel-panel">
                <div className="details-header">
                  <button className="back-btn" onClick={() => setSelectedRowDetails(null)}>←</button>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Site Details</h3>
                </div>
                
                {selectedRowDetails && (
                  <div className="details-content">
                    <div>
                      <span className="input-label">PLA_ID</span>
                      <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{selectedRowDetails.plaId}</div>
                    </div>
                    
                    <div>
                      <span className="input-label">Status</span>
                      <div style={{ marginTop: '6px' }}>
                        <span className={`status-badge ${selectedRowDetails.matchStatus.toLowerCase()}`}>
                          {selectedRowDetails.matchStatus}
                        </span>
                      </div>
                    </div>

                    <div className="details-box">
                      <span className="input-label">Tech Name (String)</span>
                      <div style={{ fontWeight: 'bold', marginTop: '4px', wordBreak: 'break-word' }}>
                        {selectedRowDetails.techName}
                      </div>
                    </div>

                    <div className="details-box">
                      <span className="input-label">System Remarks</span>
                      <div style={{ fontWeight: 'bold', marginTop: '4px', wordBreak: 'break-word', color: selectedRowDetails.matchStatus === 'MISMATCH' ? '#d97706' : '' }}>
                        {selectedRowDetails.remarks}
                      </div>
                    </div>

                    <div>
                      <span className="input-label">Location Profile</span>
                      <div className="details-box" style={{ fontFamily: 'monospace', fontSize: '0.9rem', marginTop: '6px' }}>
                        Lat: {selectedRowDetails.lat}<br/>
                        Lng: {selectedRowDetails.lng}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="sidebar-map-wrapper">
            <div className="map-floating-header">
              <span className="floating-title">Site Visualizer</span>
              <button className="floating-btn" onClick={() => setShowBigMap(true)}>⤢</button>
            </div>
            <div className="mini-map">
              <MapVisualizer selectedSite={selectedSite} filteredResults={filteredResults} isExpanded={false} />
            </div>
          </div>
        </aside>

        <section className="content-area">
          <div className="output-card">
              <AnalyticsDashboard data={results} activeFilter={filterStatus} onFilterChange={setFilterStatus} />

            {results.length > 0 && (
              <div className="table-toolbar">
                <span className="table-label">
                  {filterStatus === 'ALL' ? 'Detailed Report' : `Filtered View: ${filterStatus}`}
                </span>
                <input type="text" className="search-bar" placeholder="Search ID or Name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            )}

            <div className="output-box">
              {results.length > 0 ? (
                <div className="table-wrapper">
                  <table className="result-table">
                    <thead>
                      <tr>
                        <th>PLA_ID</th>
                        <th>Status</th>
                        <th>Base Name</th>
                        <th style={{color: '#1a73e8'}}>Technology</th>
                        <th style={{color: '#1a73e8'}}>NMS Techname</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.flatMap((row, i) => {
                        
                        // --- 1. THE RAN CLASSIFIER FUNCTION ---
                        const buildSubRows = (origStringGroup, baseGen) => {
                          if (!origStringGroup) return [];
                          
                          return origStringGroup.split(" | ").map(nmsName => {
                            const suffixMatch = nmsName.match(/(?:ID|AS|[XYLFWKHVZJBMNPRT])+$/i);
                            const suffix = suffixMatch ? suffixMatch[0].toUpperCase() : "";
                            
                            let label = baseGen;
                            
                            if (baseGen === "4G") {
                              let types = [];
                              if (/[FLWY]/i.test(suffix)) types.push("FDD");
                              if (/H/i.test(suffix)) types.push("TDD");
                              if (/V/i.test(suffix)) types.push("MM");

                              if (types.length > 0) label = `4G-${types.join("/")}`;
                            }
                            else if (baseGen === "5G") {
                              let types = [];
                              if (/M/i.test(suffix)) types.push("MM");
                              if (/[PN]/i.test(suffix)) types.push("NMM");

                              if (types.length > 0) label = `5G-${types.join("/")}`;
                            }
                            
                            return { techGen: label, nmsName: nmsName };
                          });
                        };

                        // --- 2. UNFOLD THE ROWS ---
                        const subRows = [
                          ...buildSubRows(row.original2G, "2G"),
                          ...buildSubRows(row.original4G, "4G"),
                          ...buildSubRows(row.original5G, "5G")
                        ];
                        
                        if (subRows.length === 0) {
                          subRows.push({ techGen: "UDM Only", nmsName: row.techName });
                        }

                        // --- 3. DRAW THE TABLE ---
                        return subRows.map((sub, j) => {
                          const isExactRow = selectedSite?.index === i;
                          const isSameGroup = selectedSite?.id === row.plaId && !isExactRow;
                          let rowStyle = { cursor: "pointer", transition: "background-color 0.2s" };
                          
                          if (isExactRow) rowStyle.backgroundColor = "rgba(0, 123, 255, 0.2)";
                          else if (isSameGroup) rowStyle.backgroundColor = "rgba(128, 128, 128, 0.15)";

                          const isLastOfGroup = j === subRows.length - 1;
                          if (isLastOfGroup) rowStyle.borderBottom = "2px solid var(--border-color)";

                          return (
                            <tr key={`${i}-${j}`} className="row-hover" style={rowStyle}
                              onClick={() => {
                                const lat = parseFloat(row.lat);
                                const lng = parseFloat(row.lng);
                                setSelectedSite({ lat, lng, id: row.plaId, zoom: 18, index: i });
                                setSelectedRowDetails(row);
                              }}
                            >
                              <td className="font-bold">{j === 0 ? row.plaId : ""}</td>
                              <td>
                                {j === 0 && (
                                  <span className={`status-badge ${row.matchStatus.toLowerCase()}`}>
                                    {row.matchStatus}
                                  </span>
                                )}
                              </td>
                              
                              <td style={{ fontWeight: '500' }}>{j === 0 ? row.baseLocation : ""}</td>
                              
                              <td style={{ fontWeight: 'bold', color: sub.techGen.includes('5G') ? '#28a745' : (sub.techGen.includes('4G') ? '#007bff' : '#666') }}>
                                {sub.techGen}
                              </td>
                              
                              <td style={{ fontFamily: 'monospace', color: '#1a73e8', fontWeight: 'bold' }}>
                                {sub.nmsName}
                              </td>
                              
                              <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)'}}>
                                {j === 0 ? row.remarks : ""}
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="placeholder-container">
                  <p className="placeholder-text">Ready for Delta check. Please upload NMS and UDM CSV files.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {showBigMap && (
        <div className="map-modal-overlay">
          <div className="map-modal-content">
            <div className="map-modal-header">
              <h3>Site Location: {selectedSite.id || "Region Map"}</h3>
              <button className="close-btn" onClick={() => setShowBigMap(false)}>✖ Close</button>
            </div>
            <div className="big-map-wrapper">
              <MapVisualizer selectedSite={selectedSite} filteredResults={filteredResults} isExpanded={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}