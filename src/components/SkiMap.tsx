'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import liftsData from '@/data/lifts.json';
import slopesData from '@/data/slopes.json';
import {
  LiftProperties,
  SlopeProperties,
  GeoJSONFeatureCollection,
  DIFFICULTY_COLORS,
  LIFT_COLORS,
  RouteSegment,
  Difficulty,
} from '@/types';

// Fix Leaflet default markers
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const lifts = liftsData as GeoJSONFeatureCollection<LiftProperties>;
const slopes = slopesData as GeoJSONFeatureCollection<SlopeProperties>;

// Zermatt ski area bounds
const ZERMATT_CENTER: [number, number] = [45.9850, 7.7400];
const ZERMATT_BOUNDS: [[number, number], [number, number]] = [
  [45.90, 7.60],
  [46.05, 7.90],
];

interface SkiMapProps {
  selectedRoute: RouteSegment[];
  onSegmentClick: (segment: RouteSegment) => void;
}

function MapEventHandler({ selectedRoute }: { selectedRoute: RouteSegment[] }) {
  const map = useMap();

  // Fix for mobile: invalidate size when map container might have changed
  useEffect(() => {
    // Initial size fix with delay to ensure container is fully rendered
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    // Also fix on window resize
    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    // Fix on visibility change (when switching from sidebar to map on mobile)
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    const container = map.getContainer();
    if (container) {
      observer.observe(container);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [map]);

  useEffect(() => {
    // Fit to route if exists
    if (selectedRoute.length > 0) {
      const lastSegment = selectedRoute[selectedRoute.length - 1];
      const feature =
        lastSegment.type === 'lift'
          ? lifts.features.find((f) => f.properties.id === lastSegment.id)
          : slopes.features.find((f) => f.properties.id === lastSegment.id);

      if (feature) {
        const coords = feature.geometry.coordinates;
        const lastCoord = coords[coords.length - 1];
        map.setView([lastCoord[1], lastCoord[0]], map.getZoom());
      }
    }
  }, [selectedRoute, map]);

  return null;
}

export default function SkiMap({ selectedRoute, onSegmentClick }: SkiMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
        <span className="text-gray-500">Loading map...</span>
      </div>
    );
  }

  const isInRoute = (type: 'lift' | 'slope', id: string) =>
    selectedRoute.some((s) => s.type === type && s.id === id);

  return (
    <MapContainer
      center={ZERMATT_CENTER}
      zoom={13}
      maxBounds={ZERMATT_BOUNDS}
      maxBoundsViscosity={1.0}
      className="w-full h-full"
      style={{ background: '#e5e7eb' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
      />

      <MapEventHandler selectedRoute={selectedRoute} />

      {/* Render slopes */}
      {slopes.features.map((feature) => {
        const { id, name, difficulty, length, verticalDrop, sector } = feature.properties;
        const coords = feature.geometry.coordinates.map(
          (c) => [c[1], c[0]] as [number, number]
        );
        const inRoute = isInRoute('slope', id);

        return (
          <Polyline
            key={id}
            positions={coords}
            pathOptions={{
              color: DIFFICULTY_COLORS[difficulty as Difficulty],
              weight: inRoute ? 6 : 4,
              opacity: inRoute ? 1 : 0.7,
              dashArray: inRoute ? undefined : '5, 10',
            }}
            eventHandlers={{
              click: () => onSegmentClick({ type: 'slope', id, name }),
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold">{name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: DIFFICULTY_COLORS[difficulty as Difficulty] }}
                  />
                  <span className="capitalize">{difficulty}</span>
                </div>
                <div className="mt-1 text-gray-600">
                  <div>{(length / 1000).toFixed(1)} km</div>
                  <div>{verticalDrop}m drop</div>
                  <div className="text-xs">{sector}</div>
                </div>
                <button
                  onClick={() => onSegmentClick({ type: 'slope', id, name })}
                  className="mt-2 px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                >
                  {inRoute ? 'Remove from route' : 'Add to route'}
                </button>
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {/* Render lifts */}
      {lifts.features.map((feature) => {
        const { id, name, type, verticalRise, duration, bottomElevation, topElevation, sector } =
          feature.properties;
        const coords = feature.geometry.coordinates.map(
          (c) => [c[1], c[0]] as [number, number]
        );
        const inRoute = isInRoute('lift', id);

        return (
          <Polyline
            key={id}
            positions={coords}
            pathOptions={{
              color: LIFT_COLORS[type],
              weight: inRoute ? 5 : 3,
              opacity: inRoute ? 1 : 0.8,
            }}
            eventHandlers={{
              click: () => onSegmentClick({ type: 'lift', id, name }),
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold">{name}</div>
                <div className="capitalize text-gray-600">{type.replace('_', ' ')}</div>
                <div className="mt-1 text-gray-600">
                  <div>{bottomElevation}m - {topElevation}m</div>
                  <div>+{verticalRise}m rise</div>
                  <div>{duration} min ride</div>
                  <div className="text-xs">{sector}</div>
                </div>
                <button
                  onClick={() => onSegmentClick({ type: 'lift', id, name })}
                  className="mt-2 px-2 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                >
                  {inRoute ? 'Remove from route' : 'Add to route'}
                </button>
              </div>
            </Popup>
          </Polyline>
        );
      })}
    </MapContainer>
  );
}
