'use client';

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Popup, useMap, CircleMarker, Tooltip } from 'react-leaflet';
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
  RoutePoint,
  Difficulty,
} from '@/types';
import { getValidNextSegments } from '@/lib/routeCalculations';

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
  startPoint: RoutePoint | null;
  endPoint: RoutePoint | null;
  onSetStartPoint: (point: RoutePoint) => void;
  onSetEndPoint: (point: RoutePoint) => void;
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

// Reachable segment highlight color
const REACHABLE_HIGHLIGHT = '#00ff88';

// Get coordinates for a route point
function getPointCoordinates(point: RoutePoint): [number, number] | null {
  if (point.type === 'lift') {
    const lift = lifts.features.find((f) => f.properties.id === point.id);
    if (!lift) return null;
    const coords = lift.geometry.coordinates;
    const coord = point.position === 'start' ? coords[0] : coords[coords.length - 1];
    return [coord[1], coord[0]];
  } else {
    const slope = slopes.features.find((f) => f.properties.id === point.id);
    if (!slope) return null;
    const coords = slope.geometry.coordinates;
    const coord = point.position === 'start' ? coords[0] : coords[coords.length - 1];
    return [coord[1], coord[0]];
  }
}

export default function SkiMap({
  selectedRoute,
  onSegmentClick,
  startPoint,
  endPoint,
  onSetStartPoint,
  onSetEndPoint,
}: SkiMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate reachable segments based on current route
  const reachableSegments = useMemo(() => {
    const { lifts: reachableLifts, slopes: reachableSlopes } = getValidNextSegments(selectedRoute);
    return new Set([...reachableLifts, ...reachableSlopes]);
  }, [selectedRoute]);

  if (!mounted) {
    return (
      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
        <span className="text-gray-500">Loading map...</span>
      </div>
    );
  }

  const isInRoute = (type: 'lift' | 'slope', id: string) =>
    selectedRoute.some((s) => s.type === type && s.id === id);

  const isReachable = (id: string) => reachableSegments.has(id);

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

      {/* Render slopes - reachable highlights first (underneath) */}
      {selectedRoute.length > 0 && slopes.features.map((feature) => {
        const { id } = feature.properties;
        const coords = feature.geometry.coordinates.map(
          (c) => [c[1], c[0]] as [number, number]
        );
        const reachable = isReachable(id);
        const inRoute = isInRoute('slope', id);

        // Only render highlight for reachable, non-route segments
        if (!reachable || inRoute) return null;

        return (
          <Polyline
            key={`${id}-highlight`}
            positions={coords}
            pathOptions={{
              color: REACHABLE_HIGHLIGHT,
              weight: 8,
              opacity: 0.4,
            }}
            interactive={false}
          />
        );
      })}

      {/* Render slopes */}
      {slopes.features.map((feature) => {
        const { id, name, difficulty, length, verticalDrop, sector } = feature.properties;
        const coords = feature.geometry.coordinates.map(
          (c) => [c[1], c[0]] as [number, number]
        );
        const inRoute = isInRoute('slope', id);
        const reachable = isReachable(id);
        const hasRoute = selectedRoute.length > 0;

        // Determine visual style based on state
        let weight = 4;
        let opacity = 0.5;
        let dashArray: string | undefined = '5, 10';

        if (inRoute) {
          weight = 6;
          opacity = 1;
          dashArray = undefined;
        } else if (reachable && hasRoute) {
          weight = 5;
          opacity = 0.9;
          dashArray = undefined;
        }

        return (
          <Polyline
            key={id}
            positions={coords}
            pathOptions={{
              color: DIFFICULTY_COLORS[difficulty as Difficulty],
              weight,
              opacity,
              dashArray,
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
                {hasRoute && !inRoute && (
                  <div className={`mt-1 text-xs ${reachable ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                    {reachable ? '✓ Reachable from current position' : '✗ Not reachable'}
                  </div>
                )}
                <button
                  onClick={() => onSegmentClick({ type: 'slope', id, name })}
                  className={`mt-2 px-2 py-1 text-white text-xs rounded ${
                    inRoute
                      ? 'bg-red-500 hover:bg-red-600'
                      : reachable && hasRoute
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                >
                  {inRoute ? 'Remove from route' : 'Add to route'}
                </button>
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={() => onSetStartPoint({ type: 'slope', id, name, position: 'start' })}
                    className="flex-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded hover:bg-green-200"
                  >
                    Set start
                  </button>
                  <button
                    onClick={() => onSetEndPoint({ type: 'slope', id, name, position: 'end' })}
                    className="flex-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200"
                  >
                    Set end
                  </button>
                </div>
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {/* Render lifts - reachable highlights first (underneath) */}
      {selectedRoute.length > 0 && lifts.features.map((feature) => {
        const { id } = feature.properties;
        const coords = feature.geometry.coordinates.map(
          (c) => [c[1], c[0]] as [number, number]
        );
        const reachable = isReachable(id);
        const inRoute = isInRoute('lift', id);

        // Only render highlight for reachable, non-route lifts
        if (!reachable || inRoute) return null;

        return (
          <Polyline
            key={`${id}-highlight`}
            positions={coords}
            pathOptions={{
              color: REACHABLE_HIGHLIGHT,
              weight: 7,
              opacity: 0.4,
            }}
            interactive={false}
          />
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
        const reachable = isReachable(id);
        const hasRoute = selectedRoute.length > 0;

        // Determine visual style based on state
        let weight = 3;
        let opacity = 0.6;

        if (inRoute) {
          weight = 5;
          opacity = 1;
        } else if (reachable && hasRoute) {
          weight = 4;
          opacity = 0.9;
        }

        return (
          <Polyline
            key={id}
            positions={coords}
            pathOptions={{
              color: LIFT_COLORS[type],
              weight,
              opacity,
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
                  <div>{verticalRise >= 0 ? '+' : ''}{verticalRise}m {verticalRise >= 0 ? 'rise' : 'drop'}</div>
                  <div>{duration} min ride</div>
                  <div className="text-xs">{sector}</div>
                </div>
                {hasRoute && !inRoute && (
                  <div className={`mt-1 text-xs ${reachable ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                    {reachable ? '✓ Reachable from current position' : '✗ Not reachable'}
                  </div>
                )}
                <button
                  onClick={() => onSegmentClick({ type: 'lift', id, name })}
                  className={`mt-2 px-2 py-1 text-white text-xs rounded ${
                    inRoute
                      ? 'bg-red-500 hover:bg-red-600'
                      : reachable && hasRoute
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-purple-500 hover:bg-purple-600'
                  }`}
                >
                  {inRoute ? 'Remove from route' : 'Add to route'}
                </button>
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={() => onSetStartPoint({ type: 'lift', id, name, position: 'start' })}
                    className="flex-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded hover:bg-green-200"
                  >
                    Set start
                  </button>
                  <button
                    onClick={() => onSetEndPoint({ type: 'lift', id, name, position: 'end' })}
                    className="flex-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200"
                  >
                    Set end
                  </button>
                </div>
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {/* Start/End Point Markers */}
      {startPoint && (() => {
        const coords = getPointCoordinates(startPoint);
        if (!coords) return null;
        return (
          <CircleMarker
            center={coords}
            radius={12}
            pathOptions={{
              color: '#16a34a',
              fillColor: '#22c55e',
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -10]}>
              <span className="font-medium">Start: {startPoint.name}</span>
            </Tooltip>
          </CircleMarker>
        );
      })()}

      {endPoint && (() => {
        const coords = getPointCoordinates(endPoint);
        if (!coords) return null;
        return (
          <CircleMarker
            center={coords}
            radius={12}
            pathOptions={{
              color: '#dc2626',
              fillColor: '#ef4444',
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -10]}>
              <span className="font-medium">End: {endPoint.name}</span>
            </Tooltip>
          </CircleMarker>
        );
      })()}
    </MapContainer>
  );
}
