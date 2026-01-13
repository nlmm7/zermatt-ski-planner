'use client';

import { RouteSegment, RoutePoint, DIFFICULTY_COLORS, Difficulty } from '@/types';
import { calculateRouteStats, formatTime, getLiftById, getSlopeById } from '@/lib/routeCalculations';

interface RouteBuilderProps {
  route: RouteSegment[];
  startPoint: RoutePoint | null;
  endPoint: RoutePoint | null;
  maxDifficulty: Difficulty | null;
  isCalculating: boolean;
  onRemoveSegment: (index: number) => void;
  onClearRoute: () => void;
  onClearPoints: () => void;
  onSetMaxDifficulty: (difficulty: Difficulty | null) => void;
  onFindRoute: () => void;
  onSaveRoute: () => void;
}

const DIFFICULTIES: (Difficulty | null)[] = [null, 'green', 'blue', 'red', 'black'];
const DIFFICULTY_LABELS: Record<string, string> = {
  null: 'Any',
  green: 'Green',
  blue: 'Blue',
  red: 'Red',
  black: 'Black',
};

export default function RouteBuilder({
  route,
  startPoint,
  endPoint,
  maxDifficulty,
  isCalculating,
  onRemoveSegment,
  onClearRoute,
  onClearPoints,
  onSetMaxDifficulty,
  onFindRoute,
  onSaveRoute,
}: RouteBuilderProps) {
  const stats = calculateRouteStats(route);

  return (
    <div className="bg-white h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-bold">Route Builder</h2>
        <p className="text-sm text-gray-600">Tap lifts and slopes on the map to build your route</p>
      </div>

      {/* Start/End Points */}
      {(startPoint || endPoint) && (
        <div className="p-4 bg-gradient-to-r from-green-50 to-red-50 border-b">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Route Planning</span>
            <button
              onClick={onClearPoints}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear points
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-xs text-gray-500">Start</div>
                <div className="text-sm font-medium truncate">
                  {startPoint ? startPoint.name : <span className="text-gray-400 italic">Not set</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-xs text-gray-500">End</div>
                <div className="text-sm font-medium truncate">
                  {endPoint ? endPoint.name : <span className="text-gray-400 italic">Not set</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Max Difficulty Selector */}
          <div className="mt-3">
            <div className="text-xs text-gray-500 mb-1">Max Difficulty</div>
            <div className="flex gap-1">
              {DIFFICULTIES.map((diff) => (
                <button
                  key={diff || 'any'}
                  onClick={() => onSetMaxDifficulty(diff)}
                  className={`flex-1 py-1 px-2 text-xs rounded transition-colors ${
                    maxDifficulty === diff
                      ? diff
                        ? 'text-white'
                        : 'bg-gray-700 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={
                    maxDifficulty === diff && diff
                      ? { backgroundColor: DIFFICULTY_COLORS[diff] }
                      : undefined
                  }
                >
                  {DIFFICULTY_LABELS[String(diff)]}
                </button>
              ))}
            </div>
          </div>

          {/* Find Route Button */}
          {startPoint && endPoint && (
            <button
              onClick={onFindRoute}
              disabled={isCalculating}
              className={`mt-3 w-full py-2 px-4 rounded font-medium text-white transition-colors ${
                isCalculating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600'
              }`}
            >
              {isCalculating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Calculating...
                </span>
              ) : (
                'Find Route'
              )}
            </button>
          )}
        </div>
      )}

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
