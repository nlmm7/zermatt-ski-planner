'use client';

import { RouteSegment, DIFFICULTY_COLORS, Difficulty } from '@/types';
import { calculateRouteStats, formatTime, getLiftById, getSlopeById } from '@/lib/routeCalculations';

interface RouteBuilderProps {
  route: RouteSegment[];
  onRemoveSegment: (index: number) => void;
  onClearRoute: () => void;
  onSaveRoute: () => void;
}

export default function RouteBuilder({
  route,
  onRemoveSegment,
  onClearRoute,
  onSaveRoute,
}: RouteBuilderProps) {
  const stats = calculateRouteStats(route);

  return (
    <div className="bg-white h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-bold">Route Builder</h2>
        <p className="text-sm text-gray-600">Tap lifts and slopes on the map to build your route</p>
      </div>

      {/* Stats */}
      {route.length > 0 && (
        <div className="p-4 bg-gray-50 border-b">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-white rounded shadow-sm">
              <div className="text-2xl font-bold text-green-600">+{stats.totalVerticalUp}m</div>
              <div className="text-xs text-gray-500">Vertical up</div>
            </div>
            <div className="text-center p-2 bg-white rounded shadow-sm">
              <div className="text-2xl font-bold text-red-600">-{stats.totalVerticalDown}m</div>
              <div className="text-xs text-gray-500">Vertical down</div>
            </div>
            <div className="text-center p-2 bg-white rounded shadow-sm">
              <div className="text-2xl font-bold text-blue-600">{formatTime(stats.estimatedTime)}</div>
              <div className="text-xs text-gray-500">Est. time</div>
            </div>
            <div className="text-center p-2 bg-white rounded shadow-sm">
              <div className="text-2xl font-bold text-purple-600">
                {stats.liftCount + stats.slopeCount}
              </div>
              <div className="text-xs text-gray-500">Segments</div>
            </div>
          </div>

          {/* Difficulty breakdown */}
          <div className="mt-3 flex gap-2 justify-center">
            {(Object.entries(stats.difficultyBreakdown) as [Difficulty, number][])
              .filter(([, count]) => count > 0)
              .map(([diff, count]) => (
                <div
                  key={diff}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                  style={{ backgroundColor: DIFFICULTY_COLORS[diff] + '20' }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: DIFFICULTY_COLORS[diff] }}
                  />
                  <span>{count} {diff}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Route segments */}
      <div className="flex-1 overflow-y-auto p-4">
        {route.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <svg
              className="mx-auto h-12 w-12 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <p>No route yet</p>
            <p className="text-sm mt-2">Start by clicking on a lift or slope</p>
          </div>
        ) : (
          <div className="space-y-2">
            {route.map((segment, index) => {
              const isLift = segment.type === 'lift';
              const data = isLift ? getLiftById(segment.id) : getSlopeById(segment.id);
              const props = data?.properties;

              return (
                <div
                  key={`${segment.type}-${segment.id}-${index}`}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded group"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      isLift ? 'bg-purple-500' : 'bg-blue-500'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{segment.name}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      {isLift ? (
                        <>
                          <span className="capitalize">{props && 'type' in props ? (props.type as string).replace('_', ' ') : ''}</span>
                          <span>+{props && 'verticalRise' in props ? props.verticalRise : 0}m</span>
                        </>
                      ) : (
                        <>
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor:
                                props && 'difficulty' in props
                                  ? DIFFICULTY_COLORS[props.difficulty as Difficulty]
                                  : '#ccc',
                            }}
                          />
                          <span className="capitalize">
                            {props && 'difficulty' in props ? props.difficulty : ''}
                          </span>
                          <span>-{props && 'verticalDrop' in props ? props.verticalDrop : 0}m</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveSegment(index)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-100 rounded transition-opacity"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      {route.length > 0 && (
        <div className="p-4 border-t space-y-2">
          <button
            onClick={onSaveRoute}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          >
            Save Route
          </button>
          <button
            onClick={onClearRoute}
            className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Clear Route
          </button>
        </div>
      )}
    </div>
  );
}
