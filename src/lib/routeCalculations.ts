import liftsData from '@/data/lifts.json';
import slopesData from '@/data/slopes.json';
import {
  LiftProperties,
  SlopeProperties,
  GeoJSONFeatureCollection,
  RouteSegment,
  RouteStats,
  Difficulty,
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
