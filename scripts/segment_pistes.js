#!/usr/bin/env node
/**
 * Segment pistes at intersection points
 *
 * This script takes the OSM piste data and splits each piste into segments
 * at every point where it intersects with another piste. This allows for
 * more granular route planning where you can switch pistes mid-way.
 *
 * Run: node scripts/segment_pistes.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

// Distance threshold for considering two points as intersecting (meters)
const INTERSECTION_THRESHOLD = 30;

// Minimum segment length to keep (meters) - avoid tiny fragments
const MIN_SEGMENT_LENGTH = 50;

// ============================================================================
// GEOMETRY HELPERS
// ============================================================================

function haversineDistance(coord1, coord2) {
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

function getLineLength(coordinates) {
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    total += haversineDistance(coordinates[i-1], coordinates[i]);
  }
  return total;
}

// Find the index along a line where a point is closest
function findClosestPointIndex(line, point) {
  let minDist = Infinity;
  let minIndex = 0;

  for (let i = 0; i < line.length; i++) {
    const dist = haversineDistance(line[i], point);
    if (dist < minDist) {
      minDist = dist;
      minIndex = i;
    }
  }

  return { index: minIndex, distance: minDist };
}

// ============================================================================
// INTERSECTION FINDING
// ============================================================================

function findIntersections(pistes) {
  console.log('Finding intersections between pistes...');

  // For each piste, find all points where other pistes come close
  const intersectionsByPiste = new Map();

  for (const piste of pistes) {
    intersectionsByPiste.set(piste.properties.id, []);
  }

  let totalIntersections = 0;

  for (let i = 0; i < pistes.length; i++) {
    const pisteA = pistes[i];
    const coordsA = pisteA.geometry.coordinates;

    for (let j = i + 1; j < pistes.length; j++) {
      const pisteB = pistes[j];
      const coordsB = pisteB.geometry.coordinates;

      // Check each point in B against all points in A
      for (let bi = 0; bi < coordsB.length; bi++) {
        const pointB = coordsB[bi];

        for (let ai = 0; ai < coordsA.length; ai++) {
          const pointA = coordsA[ai];
          const dist = haversineDistance(pointA, pointB);

          if (dist <= INTERSECTION_THRESHOLD) {
            // Found an intersection
            // Skip if it's at the very start or end (those are already connection points)
            const aIsEndpoint = ai === 0 || ai === coordsA.length - 1;
            const bIsEndpoint = bi === 0 || bi === coordsB.length - 1;

            if (!aIsEndpoint) {
              intersectionsByPiste.get(pisteA.properties.id).push({
                index: ai,
                coord: pointA,
                otherPiste: pisteB.properties.id,
                otherIndex: bi
              });
            }

            if (!bIsEndpoint) {
              intersectionsByPiste.get(pisteB.properties.id).push({
                index: bi,
                coord: pointB,
                otherPiste: pisteA.properties.id,
                otherIndex: ai
              });
            }

            totalIntersections++;
            break; // Move to next point in B
          }
        }
      }
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  Processed ${i + 1}/${pistes.length} pistes...`);
    }
  }

  // Deduplicate and sort intersections by index for each piste
  for (const [pisteId, intersections] of intersectionsByPiste) {
    // Remove duplicates (same index)
    const seen = new Set();
    const unique = intersections.filter(int => {
      const key = int.index;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by index
    unique.sort((a, b) => a.index - b.index);

    intersectionsByPiste.set(pisteId, unique);
  }

  console.log(`  Found ${totalIntersections} intersection points`);

  return intersectionsByPiste;
}

// ============================================================================
// SEGMENTATION
// ============================================================================

function segmentPiste(piste, intersections) {
  const coords = piste.geometry.coordinates;
  const props = piste.properties;

  if (intersections.length === 0) {
    // No intersections, keep as single segment
    return [{
      ...piste,
      properties: {
        ...props,
        id: `${props.id}-seg-0`,
        originalId: props.id,
        segmentIndex: 0,
        totalSegments: 1
      }
    }];
  }

  const segments = [];
  let lastIndex = 0;

  // Add intersection indices plus the end
  const splitPoints = [...intersections.map(i => i.index), coords.length - 1];

  for (let i = 0; i < splitPoints.length; i++) {
    const endIndex = splitPoints[i];

    // Create segment from lastIndex to endIndex (inclusive)
    const segmentCoords = coords.slice(lastIndex, endIndex + 1);

    // Skip if too short
    const length = getLineLength(segmentCoords);
    if (length < MIN_SEGMENT_LENGTH && i < splitPoints.length - 1) {
      // Merge with next segment by not updating lastIndex
      continue;
    }

    if (segmentCoords.length >= 2) {
      segments.push({
        type: 'Feature',
        properties: {
          id: `${props.id}-seg-${segments.length}`,
          originalId: props.id,
          osmId: props.osmId,
          name: props.name,
          number: props.number,
          difficulty: props.difficulty,
          length: Math.round(length),
          verticalDrop: 0, // Will be recalculated
          sector: props.sector,
          segmentIndex: segments.length,
          connectsTo: [] // Will be rebuilt
        },
        geometry: {
          type: 'LineString',
          coordinates: segmentCoords
        }
      });
    }

    lastIndex = endIndex;
  }

  // Update totalSegments
  for (const seg of segments) {
    seg.properties.totalSegments = segments.length;
  }

  return segments;
}

function segmentAllPistes(pistes, intersectionsByPiste) {
  console.log('Segmenting pistes at intersection points...');

  const allSegments = [];

  for (const piste of pistes) {
    const intersections = intersectionsByPiste.get(piste.properties.id) || [];
    const segments = segmentPiste(piste, intersections);
    allSegments.push(...segments);
  }

  console.log(`  Created ${allSegments.length} segments from ${pistes.length} pistes`);

  return allSegments;
}

// ============================================================================
// CONNECTION BUILDING
// ============================================================================

function buildSegmentConnections(segments, lifts) {
  console.log('Building connections between segments...');

  const CONNECTION_THRESHOLD = 30;

  // Build spatial index of all segment endpoints
  const startPoints = [];
  const allPoints = []; // All points along all segments for mid-piste connections

  for (const seg of segments) {
    const coords = seg.geometry.coordinates;
    startPoints.push({
      id: seg.properties.id,
      coord: coords[0],
      type: 'segment-start'
    });

    // Index all points for mid-segment connections
    for (let i = 0; i < coords.length; i++) {
      allPoints.push({
        id: seg.properties.id,
        coord: coords[i],
        index: i,
        isStart: i === 0,
        isEnd: i === coords.length - 1
      });
    }
  }

  // Also add lift bottom stations
  for (const lift of lifts) {
    const coords = lift.geometry.coordinates;
    startPoints.push({
      id: lift.properties.id,
      coord: coords[0],
      type: 'lift-bottom'
    });
  }

  let totalConnections = 0;

  // For each segment, find what its END connects to
  for (const seg of segments) {
    const coords = seg.geometry.coordinates;
    const endCoord = coords[coords.length - 1];
    const connections = new Set();

    // Check against segment starts
    for (const sp of startPoints) {
      if (sp.id === seg.properties.id) continue;

      const dist = haversineDistance(endCoord, sp.coord);
      if (dist <= CONNECTION_THRESHOLD) {
        connections.add(sp.id);
      }
    }

    // Check against all points (for mid-segment connections)
    for (const ap of allPoints) {
      if (ap.id === seg.properties.id) continue;
      if (connections.has(ap.id)) continue;

      const dist = haversineDistance(endCoord, ap.coord);
      if (dist <= CONNECTION_THRESHOLD) {
        connections.add(ap.id);
      }
    }

    // Also check against lift tops (for reaching lifts at the bottom of a piste)
    for (const lift of lifts) {
      const liftBottom = lift.geometry.coordinates[0];
      const dist = haversineDistance(endCoord, liftBottom);
      if (dist <= CONNECTION_THRESHOLD) {
        connections.add(lift.properties.id);
      }
    }

    seg.properties.connectsTo = Array.from(connections);
    totalConnections += connections.size;
  }

  // Also connect consecutive segments of the same piste
  const segmentsByOriginal = new Map();
  for (const seg of segments) {
    const origId = seg.properties.originalId;
    if (!segmentsByOriginal.has(origId)) {
      segmentsByOriginal.set(origId, []);
    }
    segmentsByOriginal.get(origId).push(seg);
  }

  for (const [origId, segs] of segmentsByOriginal) {
    // Sort by segment index
    segs.sort((a, b) => a.properties.segmentIndex - b.properties.segmentIndex);

    // Connect consecutive segments
    for (let i = 0; i < segs.length - 1; i++) {
      const current = segs[i];
      const next = segs[i + 1];

      if (!current.properties.connectsTo.includes(next.properties.id)) {
        current.properties.connectsTo.push(next.properties.id);
        totalConnections++;
      }
    }
  }

  console.log(`  Total connections: ${totalConnections}`);

  return segments;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('Segmenting pistes at intersection points...\n');

  // Load current data
  const slopesData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'slopes.json'), 'utf8'));
  const liftsData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'lifts.json'), 'utf8'));

  const pistes = slopesData.features;
  const lifts = liftsData.features;

  console.log(`Loaded ${pistes.length} pistes and ${lifts.length} lifts\n`);

  // Find intersections
  const intersectionsByPiste = findIntersections(pistes);

  // Count pistes with intersections
  let pistesWithIntersections = 0;
  for (const [id, ints] of intersectionsByPiste) {
    if (ints.length > 0) pistesWithIntersections++;
  }
  console.log(`  ${pistesWithIntersections} pistes have mid-point intersections\n`);

  // Segment pistes
  const segments = segmentAllPistes(pistes, intersectionsByPiste);

  // Build connections
  buildSegmentConnections(segments, lifts);

  // Write output
  console.log('\nWriting output...');

  const outputGeoJSON = {
    type: 'FeatureCollection',
    features: segments
  };

  fs.writeFileSync(
    path.join(DATA_DIR, 'slopes.json'),
    JSON.stringify(outputGeoJSON, null, 2)
  );

  console.log(`  slopes.json: ${segments.length} segments`);

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Original pistes: ${pistes.length}`);
  console.log(`Segments after splitting: ${segments.length}`);
  console.log(`Increase: ${segments.length - pistes.length} new segments`);

  // Show some examples
  console.log('\n=== SAMPLE SEGMENTED PISTES ===');
  const segmented = [...intersectionsByPiste.entries()]
    .filter(([id, ints]) => ints.length > 0)
    .slice(0, 5);

  for (const [id, ints] of segmented) {
    const original = pistes.find(p => p.properties.id === id);
    const segs = segments.filter(s => s.properties.originalId === id);
    console.log(`${original?.properties.name || id}: ${ints.length} intersections -> ${segs.length} segments`);
  }

  console.log('\nDone! Run "npm run build" to verify.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
