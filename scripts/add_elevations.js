#!/usr/bin/env node
/**
 * Add elevation data to piste segments and enforce directional connections
 *
 * This script:
 * 1. Fetches elevation data for all segment endpoints
 * 2. Determines segment direction (top = high elevation, bottom = low)
 * 3. Calculates vertical drop for each segment
 * 4. Rebuilds connections to only allow downhill travel on pistes
 *
 * Run: node scripts/add_elevations.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

// Connection threshold in meters (75m to handle large station areas)
const CONNECTION_THRESHOLD = 75;

// Batch size for elevation API requests (reduced to avoid URL length issues)
const ELEVATION_BATCH_SIZE = 20;

// ============================================================================
// ELEVATION FETCHING
// ============================================================================

function fetchElevations(coordinates) {
  // Format: lat,lon|lat,lon|...
  const locations = coordinates.map(c => `${c[1]},${c[0]}`).join('|');
  const url = `https://api.open-elevation.com/api/v1/lookup?locations=${locations}`;

  try {
    const result = execSync(`curl -s "${url}"`, { timeout: 60000 });
    const data = JSON.parse(result.toString());
    return data.results.map(r => r.elevation);
  } catch (e) {
    console.error(`  Error fetching elevations: ${e.message}`);
    return coordinates.map(() => null);
  }
}

async function getAllElevations(segments, lifts) {
  console.log('Collecting unique coordinates from slopes only (lifts already have elevation data)...');

  // Collect all unique start and end coordinates from SLOPES ONLY
  const coordMap = new Map(); // "lon,lat" -> { coord, elevation }

  for (const seg of segments) {
    const coords = seg.geometry.coordinates;
    const startKey = `${coords[0][0]},${coords[0][1]}`;
    const endKey = `${coords[coords.length - 1][0]},${coords[coords.length - 1][1]}`;

    if (!coordMap.has(startKey)) {
      coordMap.set(startKey, { coord: coords[0], elevation: null });
    }
    if (!coordMap.has(endKey)) {
      coordMap.set(endKey, { coord: coords[coords.length - 1], elevation: null });
    }
  }

  // SKIP lifts - they already have elevation data from previous run

  console.log(`  Found ${coordMap.size} unique slope endpoints`);

  // Fetch elevations in batches
  console.log('Fetching elevations from API...');

  const entries = Array.from(coordMap.entries());
  let fetched = 0;

  for (let i = 0; i < entries.length; i += ELEVATION_BATCH_SIZE) {
    const batch = entries.slice(i, i + ELEVATION_BATCH_SIZE);
    const coords = batch.map(([key, val]) => val.coord);

    const elevations = fetchElevations(coords);

    for (let j = 0; j < batch.length; j++) {
      batch[j][1].elevation = elevations[j];
    }

    fetched += batch.length;
    console.log(`  Fetched ${fetched}/${entries.length} elevations...`);

    // Delay to avoid rate limiting (1 second between batches)
    if (i + ELEVATION_BATCH_SIZE < entries.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return coordMap;
}

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

// ============================================================================
// SEGMENT PROCESSING
// ============================================================================

// Thresholds for bidirectional segments
const BIDIRECTIONAL_LENGTH_THRESHOLD = 300; // meters - short segments
const BIDIRECTIONAL_ELEVATION_THRESHOLD = 30; // meters - small elevation difference

function updateSegmentElevations(segments, coordMap) {
  console.log('Updating segment elevations and directions...');

  let updatedCount = 0;
  let reversedCount = 0;
  let bidirectionalCount = 0;

  for (const seg of segments) {
    const coords = seg.geometry.coordinates;
    const startKey = `${coords[0][0]},${coords[0][1]}`;
    const endKey = `${coords[coords.length - 1][0]},${coords[coords.length - 1][1]}`;

    const startElev = coordMap.get(startKey)?.elevation;
    const endElev = coordMap.get(endKey)?.elevation;

    if (startElev !== null && endElev !== null) {
      const elevDiff = Math.abs(startElev - endElev);
      const length = seg.properties.length || 0;

      // Short segments with small elevation differences are bidirectional
      const isBidirectional = length < BIDIRECTIONAL_LENGTH_THRESHOLD &&
                              elevDiff < BIDIRECTIONAL_ELEVATION_THRESHOLD;

      if (isBidirectional) {
        // Keep original direction, mark as bidirectional
        seg.properties.startElevation = startElev;
        seg.properties.endElevation = endElev;
        seg.properties.verticalDrop = Math.round(startElev - endElev);
        seg.properties.bidirectional = true;
        bidirectionalCount++;
      } else if (startElev < endElev) {
        // Reverse the segment so it goes downhill
        seg.geometry.coordinates = coords.reverse();
        seg.properties.startElevation = endElev;
        seg.properties.endElevation = startElev;
        seg.properties.verticalDrop = Math.round(endElev - startElev);
        seg.properties.bidirectional = false;
        reversedCount++;
      } else {
        seg.properties.startElevation = startElev;
        seg.properties.endElevation = endElev;
        seg.properties.verticalDrop = Math.round(startElev - endElev);
        seg.properties.bidirectional = false;
      }
      updatedCount++;
    } else {
      // Fallback - keep as is
      seg.properties.startElevation = startElev || 0;
      seg.properties.endElevation = endElev || 0;
      seg.properties.verticalDrop = 0;
      seg.properties.bidirectional = false;
    }
  }

  console.log(`  Updated ${updatedCount} segments with elevation data`);
  console.log(`  Reversed ${reversedCount} segments to correct downhill direction`);
  console.log(`  ${bidirectionalCount} short/flat segments marked as bidirectional`);
}

function updateLiftElevations(lifts, coordMap) {
  console.log('Skipping lift elevations (already complete from previous run)...');

  // Lifts already have elevation data - skip this step
  let withData = 0;
  for (const lift of lifts) {
    if (lift.properties.bottomElevation && lift.properties.topElevation) {
      withData++;
    }
  }

  console.log(`  ${withData}/${lifts.length} lifts already have elevation data`);
}

// ============================================================================
// DIRECTIONAL CONNECTIONS
// ============================================================================

function buildDirectionalConnections(segments, lifts) {
  console.log('Building directional connections...');

  // Index all segment and lift endpoints
  // For pistes: you exit at the BOTTOM (end) and can enter at the TOP (start) of another
  // For bidirectional pistes: can enter from either end
  // For lifts: you BOARD at the start and EXIT at the end (regardless of elevation change)

  const pisteStarts = []; // Where you can START skiing (top of piste, or either end if bidirectional)
  const liftStarts = []; // Where you can BOARD a lift (start of lift line)

  for (const seg of segments) {
    const coords = seg.geometry.coordinates;
    pisteStarts.push({
      id: seg.properties.id,
      coord: coords[0], // Start (top) of piste
      elevation: seg.properties.startElevation
    });

    // For bidirectional segments, also add the end as an entry point
    if (seg.properties.bidirectional) {
      pisteStarts.push({
        id: seg.properties.id,
        coord: coords[coords.length - 1], // End of piste (can also enter here)
        elevation: seg.properties.endElevation
      });
    }
  }

  for (const lift of lifts) {
    const coords = lift.geometry.coordinates;
    liftStarts.push({
      id: lift.properties.id,
      coord: coords[0], // Boarding point of lift
      elevation: lift.properties.bottomElevation
    });
  }

  let totalConnections = 0;

  // For each piste segment, find what you can reach from its END (bottom)
  // For bidirectional segments, also find connections from the START
  for (const seg of segments) {
    const coords = seg.geometry.coordinates;
    const connections = new Set();

    // Exit points to check: always the end, plus the start if bidirectional
    const exitPoints = [
      { coord: coords[coords.length - 1], elev: seg.properties.endElevation }
    ];
    if (seg.properties.bidirectional) {
      exitPoints.push({ coord: coords[0], elev: seg.properties.startElevation });
    }

    for (const exit of exitPoints) {
      // Can connect to piste starts (tops) that are nearby and at similar or lower elevation
      for (const ps of pisteStarts) {
        if (ps.id === seg.properties.id) continue;

        const dist = haversineDistance(exit.coord, ps.coord);
        if (dist <= CONNECTION_THRESHOLD) {
          // Allow if the next piste start is at similar elevation (±50m) or lower
          // This allows for small uphills between connecting pistes
          if (ps.elevation <= exit.elev + 50) {
            connections.add(ps.id);
          }
        }
      }

      // Can connect to lift boarding points that are nearby
      for (const ls of liftStarts) {
        const dist = haversineDistance(exit.coord, ls.coord);
        if (dist <= CONNECTION_THRESHOLD) {
          connections.add(ls.id);
        }
      }
    }

    seg.properties.connectsTo = Array.from(connections);
    totalConnections += connections.size;
  }

  // For lifts, find what you can reach from the EXIT point (end of lift)
  for (const lift of lifts) {
    const coords = lift.geometry.coordinates;
    const exitCoord = coords[coords.length - 1]; // Exit point of lift
    const connections = new Set();

    // Can connect to piste starts (tops) that are nearby
    for (const ps of pisteStarts) {
      const dist = haversineDistance(exitCoord, ps.coord);
      if (dist <= CONNECTION_THRESHOLD) {
        connections.add(ps.id);
      }
    }

    // Can also connect to other lift boarding points nearby (transfers)
    for (const ls of liftStarts) {
      if (ls.id === lift.properties.id) continue;
      const dist = haversineDistance(exitCoord, ls.coord);
      if (dist <= CONNECTION_THRESHOLD) {
        connections.add(ls.id);
      }
    }

    lift.properties.connectsTo = Array.from(connections);
    totalConnections += lift.properties.connectsTo.length;
  }

  console.log(`  Built ${totalConnections} directional connections`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('Adding elevation data and directional connections...\n');

  // Load current data
  const slopesData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'slopes.json'), 'utf8'));
  const liftsData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'lifts.json'), 'utf8'));

  const segments = slopesData.features;
  const lifts = liftsData.features;

  console.log(`Loaded ${segments.length} segments and ${lifts.length} lifts\n`);

  // Get elevations
  const coordMap = await getAllElevations(segments, lifts);

  // Update segments with elevations and correct direction
  console.log('');
  updateSegmentElevations(segments, coordMap);

  // Update lifts with elevations
  console.log('');
  updateLiftElevations(lifts, coordMap);

  // Build directional connections
  console.log('');
  buildDirectionalConnections(segments, lifts);

  // Write output
  console.log('\nWriting output files...');

  fs.writeFileSync(
    path.join(DATA_DIR, 'slopes.json'),
    JSON.stringify({ type: 'FeatureCollection', features: segments }, null, 2)
  );
  console.log(`  slopes.json: ${segments.length} segments`);

  fs.writeFileSync(
    path.join(DATA_DIR, 'lifts.json'),
    JSON.stringify({ type: 'FeatureCollection', features: lifts }, null, 2)
  );
  console.log(`  lifts.json: ${lifts.length} lifts`);

  // Summary
  console.log('\n=== SUMMARY ===');

  // Sample elevation data
  const sampleSegments = segments.slice(0, 5);
  console.log('\nSample segment elevations:');
  for (const seg of sampleSegments) {
    console.log(`  ${seg.properties.name}: ${seg.properties.startElevation}m -> ${seg.properties.endElevation}m (drop: ${seg.properties.verticalDrop}m)`);
  }

  const sampleLifts = lifts.slice(0, 5);
  console.log('\nSample lift elevations:');
  for (const lift of sampleLifts) {
    console.log(`  ${lift.properties.name}: ${lift.properties.bottomElevation}m -> ${lift.properties.topElevation}m (rise: ${lift.properties.verticalRise}m)`);
  }

  console.log('\nDone! Run "npm run build" to verify.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
