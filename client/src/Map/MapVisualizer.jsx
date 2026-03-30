import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const getCustomIcon = (status, isSelected, duplicateCount = 1) => {
  let bgColor = '#5e5e5d'; 
  if (status === 'NEW') bgColor = '#28a745'; 
  if (status === 'REMOVED') bgColor = '#dc3545'; 
  if (status === 'MISMATCH') bgColor = '#d97706'; 

  const size = isSelected ? 20 : 14;
  const anchor = isSelected ? 10 : 7;
  const border = isSelected ? '3px solid #ffffff' : '2px solid white';
  const shadow = isSelected 
    ? '0 0 0 4px rgba(0, 31, 95, 0.4), 0 4px 8px rgba(0,0,0,0.5)'
    : '0 2px 4px rgba(0,0,0,0.3)'; 

  const badgeHtml = duplicateCount > 1 
    ? `<div style="position: absolute; top: -6px; right: -6px; background-color: #dc3545; color: white; width: 16px; height: 16px; border-radius: 50%; font-size: 0.65rem; font-weight: bold; display: flex; justify-content: center; align-items: center; border: 1px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.4); z-index: 10;">${duplicateCount}</div>`
    : '';

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="position: relative; background-color: ${bgColor}; width: ${size}px; height: ${size}px; border-radius: 50%; border: ${border}; box-shadow: ${shadow}; transition: all 0.3s ease;">
             ${badgeHtml}
           </div>`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor] 
  });
};

const createCustomClusterIcon = (cluster) => {
  return L.divIcon({
    html: `<div style="background-color: #001f5f; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.9rem; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
             ${cluster.getChildCount()}
           </div>`,
    className: 'custom-cluster-marker',
    iconSize: L.point(34, 34, true),
  });
};

function MapRecenter({ expanded, filteredResults = [], selectedSite = {} }) {
  const map = useMap();
  
  // Memoize bounds to prevent fitBounds flooding
  const bounds = useMemo(() => {
    const pts = [];
    filteredResults.forEach(site => {
      if (site.lat && site.lng) pts.push([parseFloat(site.lat), parseFloat(site.lng)]);
    });
    return pts.length ? L.latLngBounds(pts) : null;
  }, [filteredResults]);

  useEffect(() => {
    map.invalidateSize();
    if (selectedSite.lat && selectedSite.lng) {
      map.flyTo([parseFloat(selectedSite.lat), parseFloat(selectedSite.lng)], 18, { animate: true, duration: 1 });
    } else if (bounds) {
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [selectedSite.lat, selectedSite.lng, bounds, expanded, map]);

  return null;
}

export default function MapVisualizer({ selectedSite = {}, filteredResults = [], isExpanded = false }) {
  
  // OPTIMIZATION: Pre-calculate counts and valid coordinates once per data change O(N)
  const processedData = useMemo(() => {
    const idMap = {};
    filteredResults.forEach(s => {
      if (s.plaId) idMap[s.plaId] = (idMap[s.plaId] || 0) + 1;
    });

    return filteredResults
      .filter(s => s.lat && s.lng)
      .map((s, idx) => ({
        ...s,
        originalIndex: idx,
        latNum: parseFloat(s.lat),
        lngNum: parseFloat(s.lng),
        dupCount: idMap[s.plaId] || 1
      }));
  }, [filteredResults]);

  const [centreLat, centreLng] = useMemo(() => {
    if (selectedSite.lat && selectedSite.lng) return [parseFloat(selectedSite.lat), parseFloat(selectedSite.lng)];
    if (processedData.length > 0) {
      const sum = processedData.reduce((acc, curr) => [acc[0] + curr.latNum, acc[1] + curr.lngNum], [0, 0]);
      return [sum[0] / processedData.length, sum[1] / processedData.length];
    }
    return [7.1907, 125.4553];
  }, [selectedSite.lat, selectedSite.lng, processedData]);

  const currentZoom = selectedSite.lat ? 18 : (isExpanded ? 15 : 10);

  return (
    <MapContainer center={[centreLat, centreLng]} zoom={currentZoom} zoomControl={isExpanded} style={{ height: "100%", width: "100%", zIndex: 1 }} preferCanvas={true}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapRecenter
         expanded={isExpanded}
         filteredResults={filteredResults}
         selectedSite={selectedSite}
      />
      
      <WMSTileLayer
        url="https://mesonet.agron.iastate.edu/cgi-bin/wms/goes/global_ir.cgi"
        layers="goes_global_ir"
        format="image/png"
        transparent={true}
        opacity={0.4}
        zIndex={10}
      />

      <MarkerClusterGroup chunkedLoading maxClusterRadius={60} iconCreateFunction={createCustomClusterIcon} disableClusteringAtZoom={16}>
        {processedData.map((site) => {
          const isSelected = selectedSite.index === site.originalIndex;
          if (isSelected) return null; // Render outside cluster group

          return (
            <Marker key={`pin-${site.plaId}-${site.originalIndex}`} position={[site.latNum, site.lngNum]} icon={getCustomIcon(site.matchStatus, false, site.dupCount)}>
              <Tooltip direction="right" offset={[10, 0]} opacity={0.9}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#222' }}>{site.plaId}</span>
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
          position={[parseFloat(selectedSite.lat) + 0.0001, parseFloat(selectedSite.lng) + 0.0001]} 
          icon={getCustomIcon(selectedSite.matchStatus || 'UNCHANGED', true, 1)}
          zIndexOffset={1000}
        >
          <Tooltip permanent direction="right" offset={[14, 0]} opacity={0.9}>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#001f5f' }}>{selectedSite.id}</span>
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}