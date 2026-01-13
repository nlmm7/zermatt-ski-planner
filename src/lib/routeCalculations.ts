import liftsData from '@/data/lifts.json';
import slopesData from '@/data/slopes.json';
import {
  LiftProperties,
  SlopeProperties,
  GeoJSONFeatureCollection,
  RouteSegment,
  RoutePoint,
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
    // Lifts now have pre-computed connectsTo arrays
    const lift = getLiftById(segment.id);
    return lift?.properties.connectsTo || [];
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

  // Try to determine why it doesn't connect
  let reason = 'These segments are not adjacent.';

  // Check if the new segment's END is near the last segment's end (wrong direction)
  if (newSegment.type === 'slope') {
    const newEnd = getSegmentEndCoords(newSegment);
    if (lastEnd && newEnd && haversineDistance(lastEnd, newEnd) <= CONNECTION_THRESHOLD) {
      reason = `"${newName}" goes the wrong direction from here (would need to ski uphill).`;
    }
  }

  return {
    isValid: false,
    message: `"${newName}" doesn't connect to "${lastName}". ${reason}`,
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

// ============================================================================
// A* PATHFINDING
// ============================================================================

const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  green: 0,
  blue: 1,
  red: 2,
  black: 3,
};

// Get coordinates for a route point location
function getPointLocation(point: RoutePoint): number[] | null {
  if (point.type === 'lift') {
    const lift = getLiftById(point.id);
    if (!lift) return null;
    const coords = lift.geometry.coordinates;
    return point.position === 'start' ? coords[0] : coords[coords.length - 1];
  } else {
    const slope = getSlopeById(point.id);
    if (!slope) return null;
    const coords = slope.geometry.coordinates;
    return point.position === 'start' ? coords[0] : coords[coords.length - 1];
  }
}

// Get time cost for traversing a segment (in minutes)
function getSegmentTimeCost(id: string): number {
  if (id.startsWith('lift-')) {
    const lift = getLiftById(id);
    return lift?.properties.duration || 5;
  } else {
    const slope = getSlopeById(id);
    if (!slope) return 5;
    const speedKmh = AVERAGE_SPEEDS[slope.properties.difficulty as Difficulty] || 30;
    return (slope.properties.length / 1000 / speedKmh) * 60;
  }
}

// Get segment difficulty (null for lifts)
function getSegmentDifficulty(id: string): Difficulty | null {
  if (id.startsWith('lift-')) {
    return null; // Lifts have no difficulty
  }
  const slope = getSlopeById(id);
  return (slope?.properties.difficulty as Difficulty) || null;
}

// Check if segment is within difficulty limit
function isWithinDifficultyLimit(id: string, maxDifficulty: Difficulty | null): boolean {
  if (!maxDifficulty) return true; // No limit
  const segDiff = getSegmentDifficulty(id);
  if (!segDiff) return true; // Lifts are always OK
  return DIFFICULTY_ORDER[segDiff] <= DIFFICULTY_ORDER[maxDifficulty];
}

// Get segment info for building RouteSegment
function getSegmentInfo(id: string): { type: 'lift' | 'slope'; name: string } | null {
  if (id.startsWith('lift-')) {
    const lift = getLiftById(id);
    if (!lift) return null;
    return { type: 'lift', name: lift.properties.name };
  } else {
    const slope = getSlopeById(id);
    if (!slope) return null;
    return { type: 'slope', name: slope.properties.name };
  }
}

// Get segment start coordinates by ID
function getSegmentStartById(id: string): number[] | null {
  if (id.startsWith('lift-')) {
    const lift = getLiftById(id);
    return lift?.geometry.coordinates[0] || null;
  } else {
    const slope = getSlopeById(id);
    return slope?.geometry.coordinates[0] || null;
  }
}

// Get segment end coordinates by ID
function getSegmentEndById(id: string): number[] | null {
  if (id.startsWith('lift-')) {
    const lift = getLiftById(id);
    if (!lift) return null;
    return lift.geometry.coordinates[lift.geometry.coordinates.length - 1];
  } else {
    const slope = getSlopeById(id);
    if (!slope) return null;
    return slope.geometry.coordinates[slope.geometry.coordinates.length - 1];
  }
}

// Get connections for a segment by ID
function getConnectionsById(id: string): string[] {
  if (id.startsWith('lift-')) {
    const lift = getLiftById(id);
    return lift?.properties.connectsTo || [];
  } else {
    const slope = getSlopeById(id);
    return slope?.properties.connectsTo || [];
  }
}

// Find segments whose START is near a location
function findSegmentsStartingNear(location: number[]): string[] {
  const results: string[] = [];

  for (const lift of lifts.features) {
    const start = lift.geometry.coordinates[0];
    if (haversineDistance(location, start) <= CONNECTION_THRESHOLD) {
      results.push(lift.properties.id);
    }
  }

  for (const slope of slopes.features) {
    const start = slope.geometry.coordinates[0];
    if (haversineDistance(location, start) <= CONNECTION_THRESHOLD) {
      results.push(slope.properties.id);
    }
    // For bidirectional slopes, also check end
    if (slope.properties.bidirectional) {
      const end = slope.geometry.coordinates[slope.geometry.coordinates.length - 1];
      if (haversineDistance(location, end) <= CONNECTION_THRESHOLD) {
        results.push(slope.properties.id);
      }
    }
  }

  return [...new Set(results)];
}

// Find segments whose END is near a location
function findSegmentsEndingNear(location: number[]): string[] {
  const results: string[] = [];

  for (const lift of lifts.features) {
    const coords = lift.geometry.coordinates;
    const end = coords[coords.length - 1];
    if (haversineDistance(location, end) <= CONNECTION_THRESHOLD) {
      results.push(lift.properties.id);
    }
  }

  for (const slope of slopes.features) {
    const coords = slope.geometry.coordinates;
    const end = coords[coords.length - 1];
    if (haversineDistance(location, end) <= CONNECTION_THRESHOLD) {
      results.push(slope.properties.id);
    }
    // For bidirectional slopes, also check start
    if (slope.properties.bidirectional) {
      const start = coords[0];
      if (haversineDistance(location, start) <= CONNECTION_THRESHOLD) {
        results.push(slope.properties.id);
      }
    }
  }

  return [...new Set(results)];
}

export interface PathfindingResult {
  success: boolean;
  route: RouteSegment[];
  message?: string;
}

// A* pathfinding algorithm
export function findRoute(
  startPoint: RoutePoint,
  endPoint: RoutePoint,
  maxDifficulty: Difficulty | null = null
): PathfindingResult {
  const startLocation = getPointLocation(startPoint);
  const endLocation = getPointLocation(endPoint);

  if (!startLocation || !endLocation) {
    return { success: false, route: [], message: 'Invalid start or end point' };
  }

  // Find segments we can start from
  const startSegments = findSegmentsStartingNear(startLocation);
  if (startSegments.length === 0) {
    return { success: false, route: [], message: 'No segments found near start point' };
  }

  // Find segments that end at our goal
  const goalSegments = new Set(findSegmentsEndingNear(endLocation));
  if (goalSegments.size === 0) {
    return { success: false, route: [], message: 'No segments found near end point' };
  }

  // Priority queue: [f_score, g_score, segment_id, path]
  type QueueItem = [number, number, string, string[]];
  const openSet: QueueItem[] = [];
  const visited = new Set<string>();

  // Heuristic: straight-line distance to goal (converted to approximate time)
  // Assume average speed of 30 km/h for heuristic
  const heuristic = (segmentId: string): number => {
    const segEnd = getSegmentEndById(segmentId);
    if (!segEnd) return 0;
    const dist = haversineDistance(segEnd, endLocation);
    return (dist / 1000 / 30) * 60; // Convert to minutes
  };

  // Initialize with starting segments
  for (const segId of startSegments) {
    if (!isWithinDifficultyLimit(segId, maxDifficulty)) continue;

    const cost = getSegmentTimeCost(segId);
    const h = heuristic(segId);
    openSet.push([cost + h, cost, segId, [segId]]);
  }

  // Sort by f_score (ascending)
  openSet.sort((a, b) => a[0] - b[0]);

  let iterations = 0;
  const maxIterations = 50000; // Safety limit

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;

    // Get item with lowest f_score
    const current = openSet.shift()!;
    const [, gScore, currentId, path] = current;

    // Check if we've reached the goal
    if (goalSegments.has(currentId)) {
      // Build the route
      const route: RouteSegment[] = [];
      for (const segId of path) {
        const info = getSegmentInfo(segId);
        if (info) {
          route.push({ type: info.type, id: segId, name: info.name });
        }
      }
      return { success: true, route };
    }

    // Skip if already visited
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Explore neighbors
    const connections = getConnectionsById(currentId);
    for (const nextId of connections) {
      if (visited.has(nextId)) continue;
      if (!isWithinDifficultyLimit(nextId, maxDifficulty)) continue;

      const nextCost = gScore + getSegmentTimeCost(nextId);
      const h = heuristic(nextId);
      const newPath = [...path, nextId];

      openSet.push([nextCost + h, nextCost, nextId, newPath]);
    }

    // Re-sort after adding new items
    openSet.sort((a, b) => a[0] - b[0]);
  }

  if (iterations >= maxIterations) {
    return { success: false, route: [], message: 'Search exceeded maximum iterations' };
  }

  return { success: false, route: [], message: 'No route found between these points' };
}
