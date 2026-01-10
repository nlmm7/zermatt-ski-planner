export type LiftType = 'cable_car' | 'gondola' | 'chairlift' | 'funicular' | 'railway' | 't_bar' | 'drag_lift';

export type Difficulty = 'green' | 'blue' | 'red' | 'black';

export type Sector = 'Matterhorn' | 'Schwarzsee' | 'Sunnegga-Rothorn' | 'Gornergrat' | 'Cervinia';

export interface LiftProperties {
  id: string;
  name: string;
  type: LiftType;
  bottomElevation: number;
  topElevation: number;
  verticalRise: number;
  capacity: number;
  duration: number; // minutes
  sector: Sector;
  isOpen?: boolean;
  lastRun?: string; // time like "16:30"
}

export interface SlopeProperties {
  id: string;
  name: string;
  difficulty: Difficulty;
  length: number; // meters
  verticalDrop: number;
  fromLift: string;
  toLift: string | null;
  sector: Sector;
  isOpen?: boolean;
}

export interface GeoJSONFeature<T> {
  type: 'Feature';
  properties: T;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

export interface GeoJSONFeatureCollection<T> {
  type: 'FeatureCollection';
  features: GeoJSONFeature<T>[];
}

export interface RouteSegment {
  type: 'lift' | 'slope';
  id: string;
  name: string;
}

export interface Route {
  id: string;
  name: string;
  segments: RouteSegment[];
  totalVerticalUp: number;
  totalVerticalDown: number;
  estimatedTime: number; // minutes
  createdAt: string;
}

export interface RouteStats {
  totalVerticalUp: number;
  totalVerticalDown: number;
  estimatedTime: number;
  liftCount: number;
  slopeCount: number;
  difficultyBreakdown: Record<Difficulty, number>;
}

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  green: '#22c55e',
  blue: '#3b82f6',
  red: '#ef4444',
  black: '#1f2937',
};

export const LIFT_COLORS: Record<LiftType, string> = {
  cable_car: '#8b5cf6',
  gondola: '#8b5cf6',
  chairlift: '#f97316',
  funicular: '#06b6d4',
  railway: '#64748b',
  t_bar: '#84cc16',
  drag_lift: '#84cc16',
};
