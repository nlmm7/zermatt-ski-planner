#!/usr/bin/env node
/**
 * Rebuild connections between segments using existing elevation data
 *
 * Run: node scripts/rebuild_connections.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

// Connection threshold in meters (150m to handle very large stations like Trockener Steg)
const CONNECTION_THRESHOLD = 150;

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

function buildDirectionalConnections(segments, lifts) {
  console.log('Building directional connections...');

  // Index all segment and lift endpoints
  const pisteStarts = [];
  const liftStarts = [];

  for (const seg of segments) {
    const coords = seg.geometry.coordinates;
    pisteStarts.push({
      id: seg.properties.id,
      coord: coords[0],
      elevation: seg.properties.startElevation
    });

    if (seg.properties.bidirectional) {
      pisteStarts.push({
        id: seg.properties.id,
        coord: coords[coords.length - 1],
        elevation: seg.properties.endElevation
      });
    }
  }

  for (const lift of lifts) {
    const coords = lift.geometry.coordinates;
    liftStarts.push({
      id: lift.properties.id,
      coord: coords[0],
      elevation: lift.properties.bottomElevation
    });
  }

  let totalConnections = 0;

  // For each piste segment, find what you can reach from its END
  // Preserve existing slope-to-slope connections, only add lift connections
  for (const seg of segments) {
    const coords = seg.geometry.coordinates;

    // Start with existing connections (preserve slope-to-slope from segmentation)
    const existingConns = seg.properties.connectsTo || [];
    const connections = new Set(existingConns);
    const initialSize = connections.size;

    const exitPoints = [
      { coord: coords[coords.length - 1], elev: seg.properties.endElevation }
    ];
    if (seg.properties.bidirectional) {
      exitPoints.push({ coord: coords[0], elev: seg.properties.startElevation });
    }

    for (const exit of exitPoints) {
      // Add slope-to-slope connections with elevation check
      for (const ps of pisteStarts) {
        if (ps.id === seg.properties.id) continue;
        if (connections.has(ps.id)) continue; // Already connected

        const dist = haversineDistance(exit.coord, ps.coord);
        if (dist <= CONNECTION_THRESHOLD) {
          // Allow up to 100m uphill to handle OSM elevation data errors
          // (e.g., Klein Matterhorn area has 60m errors for points only 16m apart)
          if (ps.elevation <= exit.elev + 100) {
            connections.add(ps.id);
          }
        }
      }

      // Add slope-to-lift connections
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

  // For lifts, find what you can reach from the EXIT point
  for (const lift of lifts) {
    const coords = lift.geometry.coordinates;
    const exitCoord = coords[coords.length - 1];
    const connections = new Set();

    for (const ps of pisteStarts) {
      const dist = haversineDistance(exitCoord, ps.coord);
      if (dist <= CONNECTION_THRESHOLD) {
        connections.add(ps.id);
      }
    }

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

function main() {
  console.log('Rebuilding connections with threshold:', CONNECTION_THRESHOLD, 'm\n');

  const slopesData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'slopes.json'), 'utf8'));
  const liftsData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'lifts.json'), 'utf8'));

  const segments = slopesData.features;
  const lifts = liftsData.features;

  console.log(`Loaded ${segments.length} segments and ${lifts.length} lifts\n`);

  buildDirectionalConnections(segments, lifts);

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

  // Verify the funicular connections
  console.log('\n=== VERIFICATION ===');
  const funicular = lifts.find(l => l.properties.name.includes('Sunnegga funicular'));
  if (funicular) {
    console.log(`${funicular.properties.name} connects to: ${funicular.properties.connectsTo.length} segments`);
    console.log(funicular.properties.connectsTo.slice(0, 10));
  }

  console.log('\nDone!');
}

main();
