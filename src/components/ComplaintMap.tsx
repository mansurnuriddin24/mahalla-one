import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Complaint } from '../types/index.ts';

interface ComplaintMapProps {
  complaints?: Complaint[];
  center?: [number, number];
  zoom?: number;
  selectable?: boolean;
  selectedLocation?: [number, number] | null;
  onSelectLocation?: (lat: number, lng: number) => void;
  onSelectComplaint?: (complaint: Complaint) => void;
  heightClass?: string;
}

export const ComplaintMap: React.FC<ComplaintMapProps> = ({
  complaints = [],
  center = [38.8612, 65.7891], // Qarshi Vatanparvar pilot
  zoom = 15,
  selectable = false,
  selectedLocation = null,
  onSelectLocation,
  onSelectComplaint,
  heightClass = 'h-[360px] md:h-[480px]',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const tempMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Neighborhood outline circle for Qarshi pilot
      L.circle([38.8612, 65.7891], {
        color: '#16834B',
        fillColor: '#16834B',
        fillOpacity: 0.08,
        radius: 900,
        weight: 2,
        dashArray: '5, 5',
      }).addTo(map).bindPopup('<b>Vatanparvar MFY (Qarshi shahri)</b><br>Mahalla hududi chegarasi');

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;

      if (selectable && onSelectLocation) {
        map.on('click', (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          onSelectLocation(lat, lng);
        });
      }
    }

    return () => {
      // Don't destroy on simple rerenders to preserve state
    };
  }, []);

  // Update center when changed
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.setView(center, zoom);
    }
  }, [center[0], center[1], zoom]);

  // Update selected location pin
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (tempMarkerRef.current) {
      mapInstanceRef.current.removeLayer(tempMarkerRef.current);
      tempMarkerRef.current = null;
    }

    if (selectedLocation) {
      const pinIcon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="background-color: #DC2626; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; items-center; justify-content: center;">
                 <div style="background: white; width: 6px; height: 6px; border-radius: 50%;"></div>
               </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      tempMarkerRef.current = L.marker(selectedLocation, { icon: pinIcon }).addTo(mapInstanceRef.current);
    }
  }, [selectedLocation]);

  // Render complaint markers
  useEffect(() => {
    if (!markersLayerRef.current || !mapInstanceRef.current) return;

    markersLayerRef.current.clearLayers();

    complaints.forEach((c) => {
      if (c.latitude && c.longitude) {
        const getMarkerColor = (status: string) => {
          switch (status) {
            case 'RESOLVED':
            case 'CLOSED':
              return '#16834B'; // Green
            case 'IN_PROGRESS':
              return '#7C3AED'; // Purple
            case 'ASSIGNED':
              return '#2563EB'; // Blue
            case 'ACCEPTED':
              return '#0284C7'; // Sky
            case 'REJECTED':
              return '#E11D48'; // Rose
            default:
              return '#D97706'; // Amber (NEW)
          }
        };

        const color = getMarkerColor(c.status);
        const markerHtml = `
          <div style="background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; border: 2.5px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold; font-size: 11px; cursor: pointer;">
            !
          </div>
        `;

        const icon = L.divIcon({
          className: 'complaint-pin',
          html: markerHtml,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([c.latitude, c.longitude], { icon });

        const popupContent = `
          <div style="font-family: system-ui; max-width: 220px; padding: 4px;">
            <div style="font-size: 11px; color: #64748b; font-weight: 600;">${c.complaintCode}</div>
            <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">${c.title}</div>
            <div style="font-size: 11px; color: #475569; margin-top: 4px;">${c.address || 'Manzil ko\'rsatilmagan'}</div>
            <div style="margin-top: 8px; display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; background: ${color}15; color: ${color};">
              ${c.status}
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on('click', () => {
          if (onSelectComplaint) {
            onSelectComplaint(c);
          }
        });

        markersLayerRef.current?.addLayer(marker);
      }
    });
  }, [complaints, onSelectComplaint]);

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm ${heightClass}`}>
      <div ref={mapContainerRef} className="w-full h-full" />
      {selectable && (
        <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 shadow-sm">
          📍 Nuqtani xaritadan belgilang
        </div>
      )}
    </div>
  );
};
