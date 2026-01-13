#!/usr/bin/env node
/**
 * Fetch ski area data directly from OpenStreetMap
 *
 * This script:
 * 1. Fetches all pistes and lifts from OSM with full geometry
 * 2. Builds a connection graph based on where geometries actually meet
 * 3. Generates GeoJSON files for the app
 *
 * Run: node scripts/fetch_osm_data.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

// Zermatt + Cervinia bounding box
const BBOX = {
  south: 45.88,
  west: 7.58,
  north: 46.10,
  east: 7.85
};

// Distance threshold for considering two points as "connected" (meters)
const CONNECTION_THRESHOLD = 50;

// ============================================================================
// OVERPASS API QUERIES
// ============================================================================

function buildPistesQuery() {
  return `[out:json][timeout:120];
(
  way["piste:type"="downhill"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out body geom;`;
}

function buildLiftsQuery() {
  return `[out:json][timeout:120];
(
  way["aerialway"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out body geom;`;
}

async function queryOverpass(query) {
  const { execSync } = require('child_process');

  // Write query to temp file to avoid shell escaping issues
  const tempFile = '/tmp/overpass_query.txt';
  require('fs').writeFileSync(tempFile, query);

  const cmd = `curl -s --data-urlencode "data@${tempFile}" "https://overpass-api.de/api/interpreter"`;

  try {
    const result = execSync(cmd, { maxBuffer: 100 * 1024 * 1024, timeout: 180000 });
    return JSON.parse(result.toString());
  } catch (e) {
    throw new Error(`Overpass query failed: ${e.message}`);
  }
}

// ============================================================================
// GEOMETRY HELPERS
// ============================================================================

function haversineDistance(coord1, coord2) {
  const R = 6371000; // Earth radius in meters
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
  return Math.round(total);
}

function getElevationDrop(coordinates) {
  if (coordinates.length < 2) return 0;
  const startElev = coordinates[0][2] || 0;
  const endElev = coordinates[coordinates.length - 1][2] || 0;
  return Math.round(startElev - endElev);
}

// ============================================================================
// DATA PROCESSING
// ============================================================================

function processPistes(osmData) {
  const features = [];

  for (const element of osmData.elements) {
    if (element.type !== 'way' || !element.geometry) continue;

    const tags = element.tags || {};
    const coordinates = element.geometry.map(node => [node.lon, node.lat]);

    // Skip very short segments
    const length = getLineLength(coordinates);
    if (length < 50) continue;

    // Map OSM difficulty to our format
    const difficultyMap = {
      'novice': 'green',
      'easy': 'blue',
      'intermediate': 'red',
      'advanced': 'black',
      'expert': 'black',
      'freeride': 'black'
    };

    const difficulty = difficultyMap[tags['piste:difficulty']] || 'red';

    // Determine sector from location
    const centerLat = coordinates[Math.floor(coordinates.length/2)][1];
    const centerLon = coordinates[Math.floor(coordinates.length/2)][0];
    let sector = 'Zermatt';
    if (centerLon < 7.68) sector = 'Cervinia';
    else if (centerLat < 45.96) sector = 'Matterhorn';
    else if (centerLon > 7.78) sector = 'Gornergrat';
    else if (centerLat > 46.01) sector = 'Sunnegga-Rothorn';

    features.push({
      type: 'Feature',
      properties: {
        id: `piste-${element.id}`,
        osmId: element.id,
        name: tags.name || tags.ref || 'Unnamed',
        number: tags.ref || null,
        difficulty: difficulty,
        length: length,
        verticalDrop: getElevationDrop(coordinates),
        sector: sector,
        // These will be computed later
        connectsTo: []
      },
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      }
    });
  }

  return features;
}

function processLifts(osmData) {
  const features = [];

  // Map OSM aerialway types to our format
  const liftTypeMap = {
    'cable_car': 'cable_car',
    'gondola': 'gondola',
    'chair_lift': 'chairlift',
    'mixed_lift': 'chairlift',
    'drag_lift': 'drag_lift',
    't-bar': 't_bar',
    'j-bar': 'drag_lift',
    'platter': 'drag_lift',
    'rope_tow': 'drag_lift',
    'funicular': 'funicular',
    'magic_carpet': 'drag_lift'
  };

  for (const element of osmData.elements) {
    if (element.type !== 'way' || !element.geometry) continue;

    const tags = element.tags || {};
    const aerialway = tags.aerialway;

    // Skip non-transport aerialways
    if (!aerialway || aerialway === 'station' || aerialway === 'pylon') continue;

    const coordinates = element.geometry.map(node => [node.lon, node.lat]);

    // Skip very short segments
    const length = getLineLength(coordinates);
    if (length < 50) continue;

    const liftType = liftTypeMap[aerialway] || 'chairlift';

    // Determine sector from location
    const centerLat = coordinates[Math.floor(coordinates.length/2)][1];
    const centerLon = coordinates[Math.floor(coordinates.length/2)][0];
    let sector = 'Zermatt';
    if (centerLon < 7.68) sector = 'Cervinia';
    else if (centerLat < 45.96) sector = 'Matterhorn';
    else if (centerLon > 7.78) sector = 'Gornergrat';
    else if (centerLat > 46.01) sector = 'Sunnegga-Rothorn';

    // Estimate duration based on length and type
    const speedMap = {
      'cable_car': 10, // m/s
      'gondola': 6,
      'chairlift': 4,
      'funicular': 8,
      't_bar': 3,
      'drag_lift': 2.5,
      'railway': 5
    };
    const speed = speedMap[liftType] || 5;
    const duration = Math.round(length / speed / 60); // minutes

    features.push({
      type: 'Feature',
      properties: {
        id: `lift-${element.id}`,
        osmId: element.id,
        name: tags.name || 'Unnamed Lift',
        type: liftType,
        bottomElevation: 0, // Would need DEM data for accurate elevations
        topElevation: 0,
        verticalRise: Math.abs(getElevationDrop(coordinates)),
        capacity: parseInt(tags['aerialway:capacity']) || 2000,
        duration: duration || 5,
        sector: sector
      },
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      }
    });
  }

  return features;
}

// ============================================================================
// CONNECTION BUILDING
// ============================================================================

function buildConnections(pistes, lifts) {
  console.log('Building connection graph...');

  // Create a spatial index of all endpoints
  const endpoints = [];

  // Add piste endpoints
  for (const piste of pistes) {
    const coords = piste.geometry.coordinates;
    endpoints.push({
      type: 'piste',
      id: piste.properties.id,
      name: piste.properties.name,
      position: 'start',
      coord: coords[0]
    });
    endpoints.push({
      type: 'piste',
      id: piste.properties.id,
      name: piste.properties.name,
      position: 'end',
      coord: coords[coords.length - 1]
    });
  }

  // Add lift endpoints
  for (const lift of lifts) {
    const coords = lift.geometry.coordinates;
    endpoints.push({
      type: 'lift',
      id: lift.properties.id,
      name: lift.properties.name,
      position: 'bottom',
      coord: coords[0]
    });
    endpoints.push({
      type: 'lift',
      id: lift.properties.id,
      name: lift.properties.name,
      position: 'top',
      coord: coords[coords.length - 1]
    });
  }

  // For each piste end, find what it connects to
  for (const piste of pistes) {
    const endCoord = piste.geometry.coordinates[piste.geometry.coordinates.length - 1];
    const connections = [];

    for (const ep of endpoints) {
      // Don't connect to self
      if (ep.id === piste.properties.id) continue;

      const dist = haversineDistance(endCoord, ep.coord);

      if (dist <= CONNECTION_THRESHOLD) {
        // For lifts, only connect to their bottom (where you board)
        if (ep.type === 'lift' && ep.position === 'bottom') {
          connections.push(ep.id);
        }
        // For pistes, connect to their start (where you can continue skiing)
        if (ep.type === 'piste' && ep.position === 'start') {
          connections.push(ep.id);
        }
      }
    }

    // Also check if piste end is near any point along another piste (not just endpoints)
    for (const otherPiste of pistes) {
      if (otherPiste.properties.id === piste.properties.id) continue;
      if (connections.includes(otherPiste.properties.id)) continue;

      // Check distance to all points along the other piste
      for (const coord of otherPiste.geometry.coordinates) {
        const dist = haversineDistance(endCoord, coord);
        if (dist <= CONNECTION_THRESHOLD) {
          connections.push(otherPiste.properties.id);
          break;
        }
      }
    }

    piste.properties.connectsTo = [...new Set(connections)];
  }

  // Count connections
  let totalConnections = 0;
  let connectedPistes = 0;
  for (const piste of pistes) {
    if (piste.properties.connectsTo.length > 0) {
      connectedPistes++;
      totalConnections += piste.properties.connectsTo.length;
    }
  }

  console.log(`  ${connectedPistes}/${pistes.length} pistes have connections`);
  console.log(`  ${totalConnections} total connections found`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('Fetching ski area data from OpenStreetMap...\n');

  // Fetch pistes
  console.log('Fetching pistes...');
  const pistesData = await queryOverpass(buildPistesQuery());
  console.log(`  Received ${pistesData.elements?.length || 0} elements`);

  const pistes = processPistes(pistesData);
  console.log(`  Processed ${pistes.length} pistes`);

  // Fetch lifts
  console.log('\nFetching lifts...');
  const liftsData = await queryOverpass(buildLiftsQuery());
  console.log(`  Received ${liftsData.elements?.length || 0} elements`);

  const lifts = processLifts(liftsData);
  console.log(`  Processed ${lifts.length} lifts`);

  // Build connections
  console.log('');
  buildConnections(pistes, lifts);

  // Generate output files
  console.log('\nWriting output files...');

  const slopesGeoJSON = {
    type: 'FeatureCollection',
    features: pistes
  };
  fs.writeFileSync(
    path.join(DATA_DIR, 'slopes.json'),
    JSON.stringify(slopesGeoJSON, null, 2)
  );
  console.log(`  slopes.json: ${pistes.length} pistes`);

  const liftsGeoJSON = {
    type: 'FeatureCollection',
    features: lifts
  };
  fs.writeFileSync(
    path.join(DATA_DIR, 'lifts.json'),
    JSON.stringify(liftsGeoJSON, null, 2)
  );
  console.log(`  lifts.json: ${lifts.length} lifts`);

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Pistes: ${pistes.length}`);
  console.log(`Lifts: ${lifts.length}`);

  // Show some sample connections
  console.log('\n=== SAMPLE CONNECTIONS ===');
  const connected = pistes.filter(p => p.properties.connectsTo.length > 0);
  for (const p of connected.slice(0, 5)) {
    console.log(`${p.properties.name} (${p.properties.number || 'no #'}) -> ${p.properties.connectsTo.length} connections`);
  }

  console.log('\nDone! Run "npm run build" to verify.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
