#!/usr/bin/env node
/**
 * Snap lift and slope endpoints to the nearest station.
 *
 * Usage: node scripts/snap_to_stations.js [--dry-run]
 *
 * This script:
 * 1. Reads stations.json, lifts.json, and slopes.json
 * 2. For each lift/slope, finds the nearest station to each endpoint
 * 3. Snaps the geometry endpoints to the station coordinates
 * 4. Updates fromStation/toStation references
 * 5. Saves the updated data (unless --dry-run)
 *
 * To make manual fixes:
 * 1. Edit src/data/stations.json (add/move stations)
 * 2. Run this script again
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const MAX_SNAP_DISTANCE = 500; // meters - won't snap if nearest station is further

// Haversine distance in meters
function distance(coord1, coord2) {
  const R = 6371000;
  const lat1 = coord1[1] * Math.PI / 180;
  const lat2 = coord2[1] * Math.PI / 180;
  const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Find nearest station to a coordinate
function findNearestStation(coord, stations) {
  let nearest = null;
  let nearestDist = Infinity;

  for (const station of stations) {
    const dist = distance(coord, station.coordinates);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = station;
    }
  }

  return { station: nearest, distance: nearestDist };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  console.log('Loading data...');

  const stationsData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'stations.json'), 'utf8'));
  const liftsData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'lifts.json'), 'utf8'));
  const slopesData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'slopes.json'), 'utf8'));

  const stations = stationsData.stations;
  console.log(`Loaded ${stations.length} stations, ${liftsData.features.length} lifts, ${slopesData.features.length} slopes\n`);

  let snappedCount = 0;
  let tooFarCount = 0;
  const warnings = [];

  // Process lifts
  console.log('Processing lifts...');
  for (const lift of liftsData.features) {
    const coords = lift.geometry.coordinates;
    if (coords.length < 2) continue;

    const startCoord = coords[0];
    const endCoord = coords[coords.length - 1];

    // Find nearest stations
    const startResult = findNearestStation(startCoord, stations);
    const endResult = findNearestStation(endCoord, stations);

    // Snap start
    if (startResult.distance <= MAX_SNAP_DISTANCE) {
      coords[0] = [...startResult.station.coordinates];
      lift.properties.fromStation = startResult.station.id;
      snappedCount++;
      if (verbose) {
        console.log(`  ${lift.properties.name} start -> ${startResult.station.name} (${Math.round(startResult.distance)}m)`);
      }
    } else {
      tooFarCount++;
      warnings.push(`${lift.properties.name} start: nearest station ${startResult.station.name} is ${Math.round(startResult.distance)}m away`);
    }

    // Snap end
    if (endResult.distance <= MAX_SNAP_DISTANCE) {
      coords[coords.length - 1] = [...endResult.station.coordinates];
      lift.properties.toStation = endResult.station.id;
      snappedCount++;
      if (verbose) {
        console.log(`  ${lift.properties.name} end -> ${endResult.station.name} (${Math.round(endResult.distance)}m)`);
      }
    } else {
      tooFarCount++;
      warnings.push(`${lift.properties.name} end: nearest station ${endResult.station.name} is ${Math.round(endResult.distance)}m away`);
    }
  }

  // Process slopes
  console.log('Processing slopes...');
  for (const slope of slopesData.features) {
    const coords = slope.geometry.coordinates;
    if (coords.length < 2) continue;

    const startCoord = coords[0];
    const endCoord = coords[coords.length - 1];

    // Find nearest stations
    const startResult = findNearestStation(startCoord, stations);
    const endResult = findNearestStation(endCoord, stations);

    // Snap start (top of slope)
    if (startResult.distance <= MAX_SNAP_DISTANCE) {
      coords[0] = [...startResult.station.coordinates];
      slope.properties.fromStation = startResult.station.id;
      snappedCount++;
      if (verbose) {
        console.log(`  ${slope.properties.name} start -> ${startResult.station.name} (${Math.round(startResult.distance)}m)`);
      }
    } else {
      tooFarCount++;
      warnings.push(`${slope.properties.name} start: nearest station ${startResult.station.name} is ${Math.round(startResult.distance)}m away`);
    }

    // Snap end (bottom of slope)
    if (endResult.distance <= MAX_SNAP_DISTANCE) {
      coords[coords.length - 1] = [...endResult.station.coordinates];
      slope.properties.toStation = endResult.station.id;
      snappedCount++;
      if (verbose) {
        console.log(`  ${slope.properties.name} end -> ${endResult.station.name} (${Math.round(endResult.distance)}m)`);
      }
    } else {
      tooFarCount++;
      warnings.push(`${slope.properties.name} end: nearest station ${endResult.station.name} is ${Math.round(endResult.distance)}m away`);
    }
  }

  console.log(`\nResults:`);
  console.log(`  Snapped: ${snappedCount} endpoints`);
  console.log(`  Too far (>${MAX_SNAP_DISTANCE}m): ${tooFarCount} endpoints`);

  if (warnings.length > 0) {
    console.log(`\nWarnings (endpoints not snapped - consider adding stations):`);
    warnings.slice(0, 20).forEach(w => console.log(`  - ${w}`));
    if (warnings.length > 20) {
      console.log(`  ... and ${warnings.length - 20} more`);
    }
  }

  if (dryRun) {
    console.log('\n[DRY RUN] No files were modified.');
  } else {
    console.log('\nSaving updated data...');
    fs.writeFileSync(
      path.join(DATA_DIR, 'lifts.json'),
      JSON.stringify(liftsData, null, 2)
    );
    fs.writeFileSync(
      path.join(DATA_DIR, 'slopes.json'),
      JSON.stringify(slopesData, null, 2)
    );
    console.log('Done! Run "npm run build" to verify.');
  }
}

main();
