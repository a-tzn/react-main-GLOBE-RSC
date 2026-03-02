import { useEffect } from 'react';
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

export const getCustomIcon = (status, isSelected, duplicateCount = 1) => {
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

function MapRecenter({ lat, lng, zoom, expanded, filteredResults = [], selectedSite = {} }) {
  const map = useMap();
  useEffect(() => {
    // always recalc size whenever something changes
    map.invalidateSize();

    // build bounds from all available coordinates
    const pts = [];
    filteredResults.forEach(site => {
      if (site.lat && site.lng) pts.push([parseFloat(site.lat), parseFloat(site.lng)]);
    });
    if (selectedSite.lat && selectedSite.lng) {
      pts.push([parseFloat(selectedSite.lat), parseFloat(selectedSite.lng)]);
    }

    if (pts.length) {
      const bounds = L.latLngBounds(pts);
      map.fitBounds(bounds, { padding: [60, 60] });
    } else if (lat && lng) {
      // fallback to single point
      map.flyTo([lat, lng], zoom, { animate: true, duration: 1.5 });
    }
  }, [lat, lng, zoom, expanded, filteredResults, selectedSite, map]);
  return null;
}

export default function MapVisualizer({ selectedSite = {}, filteredResults = [], isExpanded = false }) {
  // calculate zoom level based on selection / expansion
  const currentZoom = selectedSite.lat ? 18 : (isExpanded ? 15 : 10);

  // determine map centre: prioritise the selected site, otherwise average all available pins,
  // and finally fall back to the hard‑coded region coordinates.
  const [centreLat, centreLng] = (() => {
    if (selectedSite.lat && selectedSite.lng) {
      return [parseFloat(selectedSite.lat), parseFloat(selectedSite.lng)];
    }
    let sumLat = 0, sumLng = 0, count = 0;
    filteredResults.forEach(site => {
      if (site.lat && site.lng) {
        sumLat += parseFloat(site.lat);
        sumLng += parseFloat(site.lng);
        count++;
      }
    });
    if (count > 0) {
      return [sumLat / count, sumLng / count];
    }
    // fallback default
    return [7.1907, 125.4553];
  })();

  return (
    <MapContainer center={[centreLat, centreLng]} zoom={currentZoom} zoomControl={isExpanded} style={{ height: "100%", width: "100%", zIndex: 1 }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapRecenter
         lat={centreLat}
         lng={centreLng}
         zoom={currentZoom}
         expanded={isExpanded}
      />
      
      <WMSTileLayer
        url="https://mesonet.agron.iastate.edu/cgi-bin/wms/goes/global_ir.cgi"
        layers="goes_global_ir"
        format="image/png"
        transparent={true}
        opacity={0.4}
        zIndex={10}
      />

      {(() => {
        const clusteredPins = [];
        let highlightedPin = null;

        filteredResults.forEach((site, idx) => {
          if (!site.lat || !site.lng) return; // Skip mapping if lat/lng is null (e.g. NEW sites not in UDM)
          
          const isSelected = selectedSite.index === idx;
          const duplicateCount = filteredResults.filter(s => s.plaId === site.plaId).length;

          const pinLat = isSelected ? parseFloat(site.lat) + 0.0001 : parseFloat(site.lat);
          const pinLng = isSelected ? parseFloat(site.lng) + 0.0001 : parseFloat(site.lng);

          const markerElement = (
            <Marker key={`pin-${idx}`} position={[pinLat, pinLng]} icon={getCustomIcon(site.matchStatus, isSelected, duplicateCount)} zIndexOffset={isSelected ? 1000 : 0}>
              <Tooltip permanent={true} direction="right" offset={[isSelected ? 14 : 10, 0]} opacity={0.9}>
                <span style={{ fontSize: isSelected ? '0.9rem' : '0.75rem', fontWeight: 'bold', color: isSelected ? '#001f5f' : '#222' }}>
                  {site.plaId}
                </span>
              </Tooltip>
              <Popup>
                <strong>{site.plaId}</strong><br/>
                Status: {site.matchStatus}
              </Popup>
            </Marker>
          );

          if (isSelected) highlightedPin = markerElement;
          else clusteredPins.push(markerElement);
        });

        return (
          <>
            <MarkerClusterGroup chunkedLoading maxClusterRadius={60} iconCreateFunction={createCustomClusterIcon} disableClusteringAtZoom={16}>
              {clusteredPins}
            </MarkerClusterGroup>
            {highlightedPin}
          </>
        );
      })()}
    </MapContainer>
  );
}