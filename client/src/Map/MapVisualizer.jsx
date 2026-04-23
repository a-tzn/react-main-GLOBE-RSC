import { memo, useDeferredValue, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, Marker, Popup, Tooltip, Rectangle, GeoJSON, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import globeIcon from '../assets/globeIcon.png';
import mindanaoAdm2Raw from '../assets/mindanao_adm2_simplified.geojson?raw';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// 🔥 CUSTOM MARKER ICON (with STATUS stored)
const getCustomIcon = (status, isSelected, duplicateCount = 1) => {
  const cacheKey = `${status || 'OTHER'}|${isSelected ? 1 : 0}`;
  if (!isSelected && markerIconCache.has(cacheKey)) {
    return markerIconCache.get(cacheKey);
  }

  let bgColor = '#5e5e5d'; 
  if (status === 'NEW') bgColor = '#28a745'; 
  if (status === 'REMOVED') bgColor = '#dc3545'; 
  if (status === 'MISMATCH') bgColor = '#d97706'; 

  const size = isSelected ? 26 : 20;
  const anchor = Math.round(size / 2);
  const ringSize = isSelected ? 3 : 2.5;
  const innerSize = Math.max(size - (ringSize * 2), 8);

  const icon = L.divIcon({
    className: 'custom-marker',

    // 👇 IMPORTANT: store status here
    status: status,

    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: ${ringSize}px solid ${bgColor};
        box-sizing: border-box;
        overflow: hidden;
        background: #ffffff;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.95);
      ">
        <img
          src="${globeIcon}"
          alt="site marker"
          style="
            width: ${innerSize}px;
            height: ${innerSize}px;
            border-radius: 50%;
            object-fit: cover;
            display: block;
            pointer-events: none;
            user-select: none;
          "
        />
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor]
  });

  if (!isSelected) {
    markerIconCache.set(cacheKey, icon);
  }

  return icon;
};

const markerIconCache = new Map();

// 🔥 FINAL CLUSTER ICON (pulse + status ring)
const createCustomClusterIcon = (cluster) => {
  const markers = cluster.getAllChildMarkers();
  const count = cluster.getChildCount();
  const size = Math.min(30, 20 + Math.log(count + 1) * 4.5);
  const labelFontSize = Math.max(10, Math.min(13, size * 0.5));
  const shouldPulse = count > 10;
  const shellSize = size + 8;
  const wrapperSize = shellSize + 14;
  const badgeShift = Math.round(shellSize * 0.36);
  const shellOffset = Math.round((wrapperSize - shellSize) / 2);

  const statusCount = {
    NEW: 0,
    REMOVED: 0,
    MISMATCH: 0,
    OTHER: 0
  };

  markers.forEach((m) => {
    const status = m.options.icon?.options?.status || 'OTHER';
    if (statusCount[status] !== undefined) {
      statusCount[status]++;
    } else {
      statusCount.OTHER++;
    }
  });

  const dominantStatus = Object.entries(statusCount).reduce(
    (max, entry) => (entry[1] > max[1] ? entry : max),
    ['OTHER', statusCount.OTHER]
  )[0];

  const shellPalette = {
    NEW: ['#9de4b2', '#4cb873', '#1f7a44'],
    REMOVED: ['#f3a2a2', '#de6060', '#a92a2a'],
    MISMATCH: ['#ffd097', '#f39c3c', '#bf6d12'],
    OTHER: ['#b9e3ff', '#7dbbff', '#3f86d6']
  };

  const pulseColor = {
    NEW: 'rgba(31, 122, 68, 0.28)',
    REMOVED: 'rgba(169, 42, 42, 0.30)',
    MISMATCH: 'rgba(191, 109, 18, 0.30)',
    OTHER: 'rgba(0, 61, 145, 0.28)'
  };

  const [outerShell, middleShell, innerShell] = shellPalette[dominantStatus] || shellPalette.OTHER;
  const pulseTint = pulseColor[dominantStatus] || pulseColor.OTHER;

  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: ${wrapperSize}px;
        height: ${wrapperSize}px;
      ">
        ${shouldPulse ? `
          <span class="cluster-pulse" style="
            width: ${shellSize + 6}px;
            height: ${shellSize + 6}px;
            left: ${Math.max(shellOffset - 3, 0)}px;
            top: ${Math.max(shellOffset - 3, 0)}px;
            background: ${pulseTint};
          "></span>
          <span class="cluster-pulse" style="
            width: ${shellSize + 6}px;
            height: ${shellSize + 6}px;
            left: ${Math.max(shellOffset - 3, 0)}px;
            top: ${Math.max(shellOffset - 3, 0)}px;
            background: ${pulseTint};
            animation-delay: 0.6s;
          "></span>
        ` : ''}
        <div style="
          position: absolute;
          left: ${shellOffset}px;
          top: ${shellOffset}px;
          width: ${shellSize}px;
          height: ${shellSize}px;
          border-radius: 50%;
          background: radial-gradient(circle at 32% 28%, rgba(255,255,255,0.65), rgba(255,255,255,0.08) 30%, rgba(0,0,0,0.08) 100%), ${outerShell};
          padding: 2px;
          box-sizing: border-box;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.9),
            0 3px 10px rgba(0,0,0,0.26),
            inset 0 -2px 5px rgba(0,0,0,0.18);
        ">
          <div style="
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.45), rgba(255,255,255,0.05) 36%, rgba(0,0,0,0.08) 100%), ${middleShell};
            padding: 2px;
            box-sizing: border-box;
            box-shadow: inset 0 1px 1px rgba(255,255,255,0.75), inset 0 -1px 2px rgba(0,0,0,0.2);
          ">
            <div style="
              width: 100%;
              height: 100%;
              border-radius: 50%;
              background: radial-gradient(circle at 34% 28%, rgba(255,255,255,0.4), rgba(255,255,255,0.04) 38%, rgba(0,0,0,0.1) 100%), ${innerShell};
              padding: 1px;
              box-sizing: border-box;
              box-shadow: inset 0 1px 1px rgba(255,255,255,0.65), inset 0 -1px 2px rgba(0,0,0,0.22);
            ">
              <img
                src="${globeIcon}"
                alt="cluster marker"
                style="
                  width: 100%;
                  height: 100%;
                  border-radius: 50%;
                  object-fit: cover;
                  border: 1px solid rgba(255,255,255,0.95);
                  background: #ffffff;
                  display: block;
                "
              />
            </div>
          </div>
        </div>
        <span style="
          position: absolute;
          left: calc(50% + ${badgeShift}px);
          top: calc(50% - ${badgeShift}px);
          transform: translate(-50%, -50%);
          background: linear-gradient(180deg, #2f4f86 0%, #1d3565 55%, #0f2246 100%);
          color: white;
          font-weight: 700;
          font-size: ${labelFontSize}px;
          line-height: 1;
          padding: 3px 6px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.95);
          min-width: 20px;
          text-align: center;
          box-sizing: border-box;
          box-shadow:
            0 2px 6px rgba(0,0,0,0.3),
            inset 0 1px 0 rgba(255,255,255,0.35);
        ">${count}</span>
      </div>
    `,
    className: 'custom-cluster-marker',
    iconSize: L.point(wrapperSize, wrapperSize, true),
    iconAnchor: [Math.round(wrapperSize / 2), Math.round(wrapperSize / 2)]
  });
};

// 🔁 Map recenter logic (unchanged)
function MapRecenter({ expanded, processedData = [], selectedSite = {}, provinceBounds = null }) {
  const map = useMap();

  const bounds = useMemo(() => {
    const pts = [];
    processedData.forEach((site) => {
      if (Number.isFinite(site.latNum) && Number.isFinite(site.lngNum)) {
        pts.push([site.latNum, site.lngNum]);
      }
    });
    return pts.length ? L.latLngBounds(pts) : null;
  }, [processedData]);

  useEffect(() => {
    map.invalidateSize();
    if (selectedSite.lat && selectedSite.lng) {
      map.flyTo([parseFloat(selectedSite.lat), parseFloat(selectedSite.lng)], 18, { animate: true, duration: 1 });
    } else if (provinceBounds) {
      map.fitBounds(provinceBounds, { padding: [70, 70] });
    } else if (bounds) {
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [selectedSite.lat, selectedSite.lng, bounds, provinceBounds, expanded, map]);

  return null;
}

const PROVINCE_ALIASES = {
  DAVAO: 'DAVAO DEL SUR',
  'DAVAO CITY': 'DAVAO DEL SUR',
  'DAVAO DEL SURE': 'DAVAO DEL SUR',
  'DAVAL DEL SUR': 'DAVAO DEL SUR',
  'TAWI TAWI': 'TAWI-TAWI',
  'MISAMIS OR.': 'MISAMIS ORIENTAL',
  'MISAMIS OCC.': 'MISAMIS OCCIDENTAL',
  'NORTH COTABATO': 'COTABATO (NORTH COTABATO)',
  COTABATO: 'COTABATO (NORTH COTABATO)',
  COMPOSTELA: 'DAVAO DE ORO (COMPOSTELA VALLEY)',
  'COMPOSTELA VALLEY': 'DAVAO DE ORO (COMPOSTELA VALLEY)',
  'DAVAO DE ORO': 'DAVAO DE ORO (COMPOSTELA VALLEY)',
  MAGUINDANAO: 'MAGUINDANAO DEL NORTE'
};
const normalizeProvinceName = (value) => {
  const cleaned = String(value || '')
    .toUpperCase()
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return PROVINCE_ALIASES[cleaned] || cleaned;
};

// 🔥 MAIN COMPONENT
function MapVisualizer({ selectedSite = {}, selectedProvince = null, filteredResults = [], isExpanded = false }) {
  const deferredFilteredResults = useDeferredValue(filteredResults);
  const mindanaoFeatureCollection = useMemo(() => {
    try {
      const parsed = JSON.parse(mindanaoAdm2Raw);
      if (parsed?.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        return parsed;
      }
    } catch {
      // ignore malformed json
    }
    return null;
  }, []);

  const processedData = useMemo(() => {
    const idMap = {};
    deferredFilteredResults.forEach(s => {
      if (s.plaId) idMap[s.plaId] = (idMap[s.plaId] || 0) + 1;
    });

    return deferredFilteredResults
      .filter(s => s.lat && s.lng)
      .map((s, idx) => ({
        ...s,
        originalIndex: idx,
        latNum: parseFloat(s.lat),
        lngNum: parseFloat(s.lng),
        dupCount: idMap[s.plaId] || 1
      }));
  }, [deferredFilteredResults]);

  const [centreLat, centreLng] = useMemo(() => {
    if (selectedSite.lat && selectedSite.lng) return [parseFloat(selectedSite.lat), parseFloat(selectedSite.lng)];
    if (processedData.length > 0) {
      const sum = processedData.reduce((acc, curr) => [acc[0] + curr.latNum, acc[1] + curr.lngNum], [0, 0]);
      return [sum[0] / processedData.length, sum[1] / processedData.length];
    }
    return [7.1907, 125.4553];
  }, [selectedSite.lat, selectedSite.lng, processedData]);

  const currentZoom = selectedSite.lat ? 18 : (isExpanded ? 15 : 10);
  const provinceOutlineGeoJson = useMemo(() => {
    if (!selectedProvince || !mindanaoFeatureCollection) return null;
    const selectedKey = normalizeProvinceName(selectedProvince);
    let matchedFeature = mindanaoFeatureCollection.features.find((feature) => {
      const provinceName = feature?.properties?.ADM2_EN || feature?.properties?.province || feature?.properties?.name;
      const normalizedFeature = normalizeProvinceName(provinceName);
      return normalizedFeature === selectedKey;
    });
    if (!matchedFeature) {
      matchedFeature = mindanaoFeatureCollection.features.find((feature) => {
        const provinceName = feature?.properties?.ADM2_EN || feature?.properties?.province || feature?.properties?.name;
        const normalizedFeature = normalizeProvinceName(provinceName);
        return normalizedFeature.includes(selectedKey) || selectedKey.includes(normalizedFeature);
      });
    }
    if (!matchedFeature) return null;
    return {
      type: 'FeatureCollection',
      features: [matchedFeature]
    };
  }, [mindanaoFeatureCollection, selectedProvince]);
  const provinceBounds = useMemo(() => {
    if (!selectedProvince || processedData.length === 0) return null;
    const pts = processedData.map((site) => [site.latNum, site.lngNum]);
    return pts.length ? L.latLngBounds(pts) : null;
  }, [selectedProvince, processedData]);
  const provinceOutlineBounds = useMemo(() => {
    if (!provinceOutlineGeoJson) return null;
    try {
      return L.geoJSON(provinceOutlineGeoJson).getBounds();
    } catch {
      return null;
    }
  }, [provinceOutlineGeoJson]);

  return (
    <MapContainer center={[centreLat, centreLng]} zoom={currentZoom} zoomControl={isExpanded} style={{ height: "100%", width: "100%" }} preferCanvas={true}>
      
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      <MapRecenter
        expanded={isExpanded}
        processedData={processedData}
        selectedSite={selectedSite}
        provinceBounds={provinceOutlineBounds || provinceBounds}
      />

      <WMSTileLayer
        url="https://mesonet.agron.iastate.edu/cgi-bin/wms/goes/global_ir.cgi"
        layers="goes_global_ir"
        format="image/png"
        transparent={true}
        opacity={0.4}
      />

      {mindanaoFeatureCollection && (
        <GeoJSON
          data={mindanaoFeatureCollection}
          interactive={false}
          style={() => ({
            color: '#3c4a66',
            weight: 1,
            opacity: 0.5,
            fillOpacity: 0
          })}
        />
      )}

      <MarkerClusterGroup
        chunkedLoading
        chunkInterval={80}
        chunkDelay={16}
        maxClusterRadius={60}
        iconCreateFunction={createCustomClusterIcon}
        disableClusteringAtZoom={16}
      >
        {processedData.map((site) => {
          const isSelected = selectedSite.index === site.originalIndex;
          if (isSelected) return null;

          return (
            <Marker
              key={`pin-${site.plaId}-${site.originalIndex}`}
              position={[site.latNum, site.lngNum]}
              icon={getCustomIcon(site.matchStatus, false, site.dupCount)}
            >
              <Tooltip direction="right" offset={[10, 0]} opacity={0.9}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{site.plaId}</span>
              </Tooltip>
              <Popup>
                <strong>{site.plaId}</strong><br/>
                Status: {site.matchStatus}
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>

      {selectedSite.lat && (
        <Marker 
          position={[parseFloat(selectedSite.lat), parseFloat(selectedSite.lng)]}
          icon={getCustomIcon(selectedSite.matchStatus || 'UNCHANGED', true, 1)}
          zIndexOffset={1000}
        >
          <Tooltip permanent direction="right" offset={[14, 0]}>
            <span style={{ fontWeight: 'bold' }}>{selectedSite.id}</span>
          </Tooltip>
        </Marker>
      )}

      {provinceBounds && !provinceOutlineGeoJson && (
        <Rectangle
          bounds={provinceBounds}
          pathOptions={{
            color: '#1a73e8',
            weight: 2,
            opacity: 0.9,
            fillColor: '#1a73e8',
            fillOpacity: 0.08,
            dashArray: '6,4'
          }}
        />
      )}

      {provinceOutlineGeoJson && (
        <GeoJSON
          key={`province-outline-${String(selectedProvince || '')}`}
          data={provinceOutlineGeoJson}
          style={() => ({
            color: '#1a73e8',
            weight: 2.2,
            opacity: 0.95,
            fillColor: '#1a73e8',
            fillOpacity: 0.11
          })}
        />
      )}
    </MapContainer>
  );
}

export default memo(MapVisualizer);
