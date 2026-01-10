import { Route, RouteSegment } from '@/types';

const ROUTES_KEY = 'zermatt-ski-routes';

export function getSavedRoutes(): Route[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(ROUTES_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveRoute(name: string, segments: RouteSegment[], stats: { totalVerticalUp: number; totalVerticalDown: number; estimatedTime: number }): Route {
  const routes = getSavedRoutes();
  const newRoute: Route = {
    id: Date.now().toString(),
    name,
    segments,
    totalVerticalUp: stats.totalVerticalUp,
    totalVerticalDown: stats.totalVerticalDown,
    estimatedTime: stats.estimatedTime,
    createdAt: new Date().toISOString(),
  };
  routes.push(newRoute);
  localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
  return newRoute;
}

export function deleteRoute(id: string): void {
  const routes = getSavedRoutes();
  const filtered = routes.filter((r) => r.id !== id);
  localStorage.setItem(ROUTES_KEY, JSON.stringify(filtered));
}
