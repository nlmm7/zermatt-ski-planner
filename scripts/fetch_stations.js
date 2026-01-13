#!/usr/bin/env node
/**
 * Fetch station data from OpenStreetMap and compute connections
 *
 * Run: node scripts/fetch_stations.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

// Zermatt + Cervinia + Valtournenche bounding box
const BBOX = {
  south: 45.85,
  west: 7.58,
  north: 46.10,
  east: 7.85
};

// Distance threshold for connecting stations to lifts/slopes
const CONNECTION_THRESHOLD = 100;

// Distance threshold for clustering duplicate stations (500m to merge station areas)
const CLUSTER_THRESHOLD = 500;

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

async function fetchStations() {
  console.log('Fetching stations from OSM...');

  const query = `[out:json][timeout:30];(node["aerialway"="station"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}););out body;`;

  const tempFile = '/tmp/stations_query.txt';
  fs.writeFileSync(tempFile, query);

  // Use alternative endpoint if main one is busy
  const cmd = `curl -s --data-urlencode "data@${tempFile}" "https://overpass.kumi.systems/api/interpreter"`;

  try {
    const result = execSync(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: 60000 });
    const data = JSON.parse(result.toString());
    console.log(`  Found ${data.elements.length} station nodes`);
    return data.elements;
  } catch (e) {
    throw new Error(`Failed to fetch stations: ${e.message}`);
  }
}

function clusterStations(stations) {
  console.log('Clustering nearby stations...');

  const clusters = [];
  const used = new Set();

  for (const station of stations) {
    if (used.has(station.id)) continue;
    if (!station.tags?.name) continue; // Skip unnamed stations

    const cluster = {
      name: station.tags.name,
      nodes: [station],
      lat: station.lat,
      lon: station.lon
    };

    used.add(station.id);

    // Find other stations with same name nearby
    for (const other of stations) {
      if (used.has(other.id)) continue;
      if (other.tags?.name !== station.tags.name) continue;

      const dist = haversineDistance(
        [station.lon, station.lat],
        [other.lon, other.lat]
      );

      if (dist <= CLUSTER_THRESHOLD) {
        cluster.nodes.push(other);
        used.add(other.id);
      }
    }

    // Calculate centroid
    if (cluster.nodes.length > 1) {
      cluster.lat = cluster.nodes.reduce((sum, n) => sum + n.lat, 0) / cluster.nodes.length;
      cluster.lon = cluster.nodes.reduce((sum, n) => sum + n.lon, 0) / cluster.nodes.length;
    }

    clusters.push(cluster);
  }

  console.log(`  Clustered into ${clusters.length} unique stations`);
  return clusters;
}

function findConnections(stations, lifts, slopes) {
  console.log('Finding connections for each station...');

  let totalConnections = 0;

  for (const station of stations) {
    const coord = [station.lon, station.lat];
    const connectedLifts = [];
    const connectedSlopes = [];

    // Find lifts that start or end near this station
    for (const lift of lifts.features) {
      const liftStart = lift.geometry.coordinates[0];
      const liftEnd = lift.geometry.coordinates[lift.geometry.coordinates.length - 1];

      const distToStart = haversineDistance(coord, liftStart);
      const distToEnd = haversineDistance(coord, liftEnd);

      if (distToStart <= CONNECTION_THRESHOLD || distToEnd <= CONNECTION_THRESHOLD) {
        connectedLifts.push({
          id: lift.properties.id,
          name: lift.properties.name,
          position: distToStart <= CONNECTION_THRESHOLD ? 'start' : 'end'
        });
      }
    }

    // Find slopes that start or end near this station
    for (const slope of slopes.features) {
      const slopeStart = slope.geometry.coordinates[0];
      const slopeEnd = slope.geometry.coordinates[slope.geometry.coordinates.length - 1];

      const distToStart = haversineDistance(coord, slopeStart);
      const distToEnd = haversineDistance(coord, slopeEnd);

      if (distToStart <= CONNECTION_THRESHOLD || distToEnd <= CONNECTION_THRESHOLD) {
        connectedSlopes.push({
          id: slope.properties.id,
          name: slope.properties.name,
          position: distToStart <= CONNECTION_THRESHOLD ? 'start' : 'end'
        });
      }
    }

    station.connectedLifts = connectedLifts;
    station.connectedSlopes = connectedSlopes;
    totalConnections += connectedLifts.length + connectedSlopes.length;
  }

  console.log(`  Found ${totalConnections} total connections`);
}

function determineElevation(station, lifts) {
  // Try to determine elevation from connected lifts
  for (const conn of station.connectedLifts || []) {
    const lift = lifts.features.find(l => l.properties.id === conn.id);
    if (lift) {
      if (conn.position === 'start') {
        return lift.properties.bottomElevation;
      } else {
        return lift.properties.topElevation;
      }
    }
  }
  return null;
}

async function main() {
  console.log('Fetching and processing station data...\n');

  // Fetch stations from OSM
  const rawStations = await fetchStations();

  // Cluster nearby stations with same name
  const clusteredStations = clusterStations(rawStations);

  // Load existing lift and slope data
  const lifts = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'lifts.json'), 'utf8'));
  const slopes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'slopes.json'), 'utf8'));

  // Find connections
  findConnections(clusteredStations, lifts, slopes);

  // Build final station objects
  const filteredStations = clusteredStations
    .filter(s => (s.connectedLifts?.length > 0 || s.connectedSlopes?.length > 0))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Make names unique by adding elevation suffix for duplicates
  const nameCounts = {};
  const stations = filteredStations.map((s, index) => {
    const elevation = determineElevation(s, lifts);
    let name = s.name;

    // Count occurrences of this name
    nameCounts[s.name] = (nameCounts[s.name] || 0) + 1;

    return {
      id: `station-${index}`,
      baseName: s.name,
      name: name,
      coordinates: [s.lon, s.lat],
      elevation: elevation,
      connectedLifts: s.connectedLifts || [],
      connectedSlopes: s.connectedSlopes || []
    };
  });

  // Add elevation suffix to duplicate names
  const seenNames = {};
  for (const station of stations) {
    if (nameCounts[station.baseName] > 1 && station.elevation) {
      station.name = `${station.baseName} (${station.elevation}m)`;
    }
    delete station.baseName;
  }

  console.log(`\nFiltered to ${stations.length} stations with connections`);

  // Write output
  fs.writeFileSync(
    path.join(DATA_DIR, 'stations.json'),
    JSON.stringify(stations, null, 2)
  );
  console.log(`\nWritten to stations.json`);

  // Print summary
  console.log('\n=== STATIONS ===');
  for (const s of stations.slice(0, 15)) {
    console.log(`${s.name}: ${s.connectedLifts.length} lifts, ${s.connectedSlopes.length} slopes`);
  }
  if (stations.length > 15) {
    console.log(`... and ${stations.length - 15} more`);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
