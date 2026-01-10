'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { RouteSegment } from '@/types';
import { calculateRouteStats, validateConnection } from '@/lib/routeCalculations';
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
  const [showSettings, setShowSettings] = useState(false);
  const [validateRoutes, setValidateRoutes] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' } | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('zermatt-validate-routes');
    if (saved !== null) {
      setValidateRoutes(saved === 'true');
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('zermatt-validate-routes', String(validateRoutes));
  }, [validateRoutes]);

  // Auto-hide toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSegmentClick = useCallback((segment: RouteSegment) => {
    setRoute((prev) => {
      const existingIndex = prev.findIndex(
        (s) => s.type === segment.type && s.id === segment.id
      );
      if (existingIndex !== -1) {
        // Remove if already in route
        return prev.filter((_, i) => i !== existingIndex);
      }

      // Validate connection if enabled
      if (validateRoutes) {
        const validation = validateConnection(prev, segment);
        if (!validation.isValid) {
          setToast({ message: validation.message || 'Invalid connection', type: 'error' });
          return prev; // Don't add invalid segment
        }
      }

      // Add to route
      return [...prev, segment];
    });
  }, [validateRoutes]);

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
              onClick={() => setShowSettings(true)}
              className="px-3 py-1 bg-white/20 rounded hover:bg-white/30 text-sm"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
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

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-20 left-1/2 transform -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg text-white text-sm max-w-sm text-center ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ zIndex: 10001 }}
        >
          {toast.message}
        </div>
      )}

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

      {/* Settings Modal */}
      {showSettings && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
          style={{ zIndex: 10000 }}
          onClick={() => setShowSettings(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-medium">Validate Route Connections</div>
                  <div className="text-sm text-gray-500">
                    Only allow segments that connect properly
                  </div>
                </div>
                <div
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    validateRoutes ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                  onClick={() => setValidateRoutes(!validateRoutes)}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      validateRoutes ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </div>
              </label>
            </div>

            <div className="mt-6 text-xs text-gray-400">
              {validateRoutes
                ? 'Routes will be checked for valid connections between lifts and slopes.'
                : 'Free mode: add any lift or slope to your route without restrictions.'}
            </div>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
          style={{ zIndex: 10000 }}
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">Save Route</h3>
            <input
              type="text"
              placeholder="Route name..."
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              className="w-full p-2 border rounded mb-4 text-base"
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
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
          style={{ zIndex: 10000 }}
          onClick={() => setShowSavedRoutes(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
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
