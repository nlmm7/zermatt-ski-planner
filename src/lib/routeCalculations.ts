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

// Average speeds for time estimation
const AVERAGE_SPEEDS = {
  green: 25, // km/h
  blue: 30,
  red: 35,
  black: 40,
};

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

// Get the end station of a segment
function getSegmentEndStation(segment: RouteSegment): string | null {
  if (segment.type === 'lift') {
    const lift = getLiftById(segment.id);
    return lift?.properties.toStation || null;
  } else {
    const slope = getSlopeById(segment.id);
    return slope?.properties.toStation || null;
  }
}

// Get the start station of a segment
function getSegmentStartStation(segment: RouteSegment): string | null {
  if (segment.type === 'lift') {
    const lift = getLiftById(segment.id);
    return lift?.properties.fromStation || null;
  } else {
    const slope = getSlopeById(segment.id);
    return slope?.properties.fromStation || null;
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
  const lastEndStation = getSegmentEndStation(lastSegment);
  const newStartStation = getSegmentStartStation(newSegment);

  if (!lastEndStation || !newStartStation) {
    return { isValid: true }; // Can't validate, allow it
  }

  if (lastEndStation === newStartStation) {
    return { isValid: true };
  }

  // Get names for the error message
  const lastName = lastSegment.name;
  const newName = newSegment.name;

  return {
    isValid: false,
    message: `"${newName}" doesn't connect to "${lastName}". You need to be at ${newStartStation} but you're at ${lastEndStation}.`,
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
  const currentStation = getSegmentEndStation(lastSegment);

  if (!currentStation) {
    return {
      lifts: lifts.features.map((f) => f.properties.id),
      slopes: slopes.features.map((f) => f.properties.id),
    };
  }

  const validLifts = lifts.features
    .filter((f) => f.properties.fromStation === currentStation)
    .map((f) => f.properties.id);

  const validSlopes = slopes.features
    .filter((f) => f.properties.fromStation === currentStation)
    .map((f) => f.properties.id);

  return { lifts: validLifts, slopes: validSlopes };
}
