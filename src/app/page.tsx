'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { RouteSegment } from '@/types';
import { calculateRouteStats } from '@/lib/routeCalculations';
import { saveRoute, getSavedRoutes, deleteRoute } from '@/lib/storage';
import RouteBuilder from '@/components/RouteBuilder';

// Dynamic import to avoid SSR issues with Leaflet
const SkiMap = dynamic(() => import('@/components/SkiMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
      <span className="text-gray-500">Loading map...</span>
    </div>
  ),
});

export default function Home() {
  const [route, setRoute] = useState<RouteSegment[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);

  const handleSegmentClick = useCallback((segment: RouteSegment) => {
    setRoute((prev) => {
      const existingIndex = prev.findIndex(
        (s) => s.type === segment.type && s.id === segment.id
      );
      if (existingIndex !== -1) {
        // Remove if already in route
        return prev.filter((_, i) => i !== existingIndex);
      }
      // Add to route
      return [...prev, segment];
    });
  }, []);

  const handleRemoveSegment = useCallback((index: number) => {
    setRoute((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearRoute = useCallback(() => {
    setRoute([]);
  }, []);

  const handleSaveRoute = useCallback(() => {
    setShowSaveModal(true);
  }, []);

  const confirmSaveRoute = useCallback(() => {
    if (routeName.trim() && route.length > 0) {
      const stats = calculateRouteStats(route);
      saveRoute(routeName, route, stats);
      setRouteName('');
      setShowSaveModal(false);
      setRoute([]);
    }
  }, [routeName, route]);

  const handleLoadRoute = useCallback((savedRoute: { segments: RouteSegment[] }) => {
    setRoute(savedRoute.segments);
    setShowSavedRoutes(false);
  }, []);

  const handleDeleteRoute = useCallback((id: string) => {
    deleteRoute(id);
    // Force re-render by toggling
    setShowSavedRoutes(false);
    setTimeout(() => setShowSavedRoutes(true), 0);
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 shadow-lg z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Zermatt Ski Planner</h1>
            <p className="text-sm text-blue-100">Plan your perfect ski day</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSavedRoutes(true)}
              className="px-3 py-1 bg-white/20 rounded hover:bg-white/30 text-sm"
            >
              Saved Routes
            </button>
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="px-3 py-1 bg-white/20 rounded hover:bg-white/30 text-sm md:hidden"
            >
              {showSidebar ? 'Map' : 'Route'}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className={`flex-1 ${showSidebar ? 'hidden md:block' : 'block'}`}>
          <SkiMap selectedRoute={route} onSegmentClick={handleSegmentClick} />
        </div>

        {/* Sidebar */}
        <div
          className={`w-full md:w-80 border-l bg-white ${
            showSidebar ? 'block' : 'hidden md:block'
          }`}
        >
          <RouteBuilder
            route={route}
            onRemoveSegment={handleRemoveSegment}
            onClearRoute={handleClearRoute}
            onSaveRoute={handleSaveRoute}
          />
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Save Route</h3>
            <input
              type="text"
              placeholder="Route name..."
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              className="w-full p-2 border rounded mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmSaveRoute}
                className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Routes Modal */}
      {showSavedRoutes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Saved Routes</h3>
              <button
                onClick={() => setShowSavedRoutes(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {getSavedRoutes().length === 0 ? (
              <p className="text-gray-500 text-center py-8">No saved routes yet</p>
            ) : (
              <div className="space-y-2">
                {getSavedRoutes().map((savedRoute) => (
                  <div
                    key={savedRoute.id}
                    className="p-3 bg-gray-50 rounded flex items-center justify-between"
                  >
                    <div className="cursor-pointer flex-1" onClick={() => handleLoadRoute(savedRoute)}>
                      <div className="font-medium">{savedRoute.name}</div>
                      <div className="text-xs text-gray-500">
                        +{savedRoute.totalVerticalUp}m / -{savedRoute.totalVerticalDown}m
                        <span className="mx-2">|</span>
                        {savedRoute.segments.length} segments
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRoute(savedRoute.id)}
                      className="text-red-500 hover:bg-red-100 p-1 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
