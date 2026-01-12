import liftsData from '@/data/lifts.json';
import slopesData from '@/data/slopes.json';
import {
  LiftProperties,
  SlopeProperties,
  GeoJSONFeatureCollection,
  RouteSegment,
  RouteStats,
  Difficulty,
  ValidationResult,
} from '@/types';

const lifts = liftsData as GeoJSONFeatureCollection<LiftProperties>;
const slopes = slopesData as GeoJSONFeatureCollection<SlopeProperties>;

// Connection threshold in meters (for checking if two points are connected)
const CONNECTION_THRESHOLD = 50;

// Average speeds for time estimation
const AVERAGE_SPEEDS = {
  green: 25, // km/h
  blue: 30,
  red: 35,
  black: 40,
};

// Haversine distance in meters
function haversineDistance(coord1: number[], coord2: number[]): number {
  const R = 6371000;
  const lat1 = coord1[1] * Math.PI / 180;
  const lat2 = coord2[1] * Math.PI / 180;
  const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function calculateRouteStats(route: RouteSegment[]): RouteStats {
  let totalVerticalUp = 0;
  let totalVerticalDown = 0;
  let estimatedTime = 0;
  let liftCount = 0;
  let slopeCount = 0;
  const difficultyBreakdown: Record<Difficulty, number> = {
    green: 0,
    blue: 0,
    red: 0,
    black: 0,
  };

  for (const segment of route) {
    if (segment.type === 'lift') {
      const lift = lifts.features.find((f) => f.properties.id === segment.id);
      if (lift) {
        totalVerticalUp += lift.properties.verticalRise;
        estimatedTime += lift.properties.duration;
        liftCount++;
      }
    } else {
      const slope = slopes.features.find((f) => f.properties.id === segment.id);
      if (slope) {
        totalVerticalDown += slope.properties.verticalDrop;
        const speedKmh = AVERAGE_SPEEDS[slope.properties.difficulty as Difficulty] || 30;
        const timeMinutes = (slope.properties.length / 1000 / speedKmh) * 60;
        estimatedTime += timeMinutes;
        slopeCount++;
        difficultyBreakdown[slope.properties.difficulty as Difficulty]++;
      }
    }
  }

  return {
    totalVerticalUp,
    totalVerticalDown,
    estimatedTime: Math.round(estimatedTime),
    liftCount,
    slopeCount,
    difficultyBreakdown,
  };
}

export function getLiftById(id: string) {
  return lifts.features.find((f) => f.properties.id === id);
}

export function getSlopeById(id: string) {
  return slopes.features.find((f) => f.properties.id === id);
}

export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// Get the end coordinates of a segment
function getSegmentEndCoords(segment: RouteSegment): number[] | null {
  if (segment.type === 'lift') {
    const lift = getLiftById(segment.id);
    if (!lift) return null;
    const coords = lift.geometry.coordinates;
    return coords[coords.length - 1];
  } else {
    const slope = getSlopeById(segment.id);
    if (!slope) return null;
    const coords = slope.geometry.coordinates;
    return coords[coords.length - 1];
  }
}

// Get the start coordinates of a segment
function getSegmentStartCoords(segment: RouteSegment): number[] | null {
  if (segment.type === 'lift') {
    const lift = getLiftById(segment.id);
    if (!lift) return null;
    return lift.geometry.coordinates[0];
  } else {
    const slope = getSlopeById(segment.id);
    if (!slope) return null;
    return slope.geometry.coordinates[0];
  }
}

// Get what a segment connects to (what you can reach from its end)
function getSegmentConnections(segment: RouteSegment): string[] {
  if (segment.type === 'slope') {
    const slope = getSlopeById(segment.id);
    return slope?.properties.connectsTo || [];
  } else {
    // For lifts, we need to find what's reachable from the top
    // This means finding pistes/lifts whose start is near the lift's end
    const lift = getLiftById(segment.id);
    if (!lift) return [];

    const liftEnd = lift.geometry.coordinates[lift.geometry.coordinates.length - 1];
    const connections: string[] = [];

    // Find slopes that start near the lift top
    for (const slope of slopes.features) {
      const slopeStart = slope.geometry.coordinates[0];
      if (haversineDistance(liftEnd, slopeStart) <= CONNECTION_THRESHOLD) {
        connections.push(slope.properties.id);
      }
    }

    // Find other lifts that start near this lift's top
    for (const otherLift of lifts.features) {
      if (otherLift.properties.id === lift.properties.id) continue;
      const otherStart = otherLift.geometry.coordinates[0];
      if (haversineDistance(liftEnd, otherStart) <= CONNECTION_THRESHOLD) {
        connections.push(otherLift.properties.id);
      }
    }

    return connections;
  }
}

// Validate if a new segment can be added to the route
export function validateConnection(
  currentRoute: RouteSegment[],
  newSegment: RouteSegment
): ValidationResult {
  // First segment is always valid
  if (currentRoute.length === 0) {
    return { isValid: true };
  }

  const lastSegment = currentRoute[currentRoute.length - 1];
  const connections = getSegmentConnections(lastSegment);

  // Check if new segment is in the connections list
  if (connections.includes(newSegment.id)) {
    return { isValid: true };
  }

  // Also check geometric proximity as a fallback
  const lastEnd = getSegmentEndCoords(lastSegment);
  const newStart = getSegmentStartCoords(newSegment);

  if (lastEnd && newStart && haversineDistance(lastEnd, newStart) <= CONNECTION_THRESHOLD) {
    return { isValid: true };
  }

  // Get names for the error message
  const lastName = lastSegment.name;
  const newName = newSegment.name;

  return {
    isValid: false,
    message: `"${newName}" doesn't connect to "${lastName}". These segments are not adjacent.`,
  };
}

// Get all valid next segments from current position
export function getValidNextSegments(currentRoute: RouteSegment[]): {
  lifts: string[];
  slopes: string[];
} {
  if (currentRoute.length === 0) {
    // All segments are valid at start
    return {
      lifts: lifts.features.map((f) => f.properties.id),
      slopes: slopes.features.map((f) => f.properties.id),
    };
  }

  const lastSegment = currentRoute[currentRoute.length - 1];
  const connections = getSegmentConnections(lastSegment);

  const validLifts = connections.filter(id => id.startsWith('lift-'));
  const validSlopes = connections.filter(id => id.startsWith('piste-'));

  return { lifts: validLifts, slopes: validSlopes };
}
