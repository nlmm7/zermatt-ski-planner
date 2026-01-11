#!/usr/bin/env node
/**
 * Build curated ski area data from official map + API coordinates
 * Source: Official skimap.org 2025/2026 piste map
 *
 * Run: node scripts/build_curated_data.js
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// STATIONS - All connection points with official elevations
// Coordinates verified against OpenSkiMap/OSM where possible
// ============================================================================
const stations = [
  // === ZERMATT VILLAGE AREA ===
  { id: "zermatt", name: "Zermatt", elevation: 1620, coordinates: [7.7516, 46.0207], sector: "Zermatt" },
  { id: "furi", name: "Furi", elevation: 1867, coordinates: [7.7483, 46.0078], sector: "Matterhorn" },
  { id: "findelbach", name: "Findelbach", elevation: 1774, coordinates: [7.7695, 46.0099], sector: "Zermatt" },
  { id: "blatten", name: "Blatten", elevation: 1750, coordinates: [7.7407, 46.0125], sector: "Zermatt" },
  { id: "zum-see", name: "Zum See", elevation: 1766, coordinates: [7.7350, 46.0090], sector: "Zermatt" },

  // === SUNNEGGA-ROTHORN SECTOR ===
  { id: "sunnegga", name: "Sunnegga", elevation: 2288, coordinates: [7.7700, 46.0173], sector: "Sunnegga-Rothorn" },
  { id: "blauherd", name: "Blauherd", elevation: 2571, coordinates: [7.7857, 46.0170], sector: "Sunnegga-Rothorn" },
  { id: "rothorn", name: "Rothorn", elevation: 3103, coordinates: [7.7975, 46.0210], sector: "Sunnegga-Rothorn" },
  { id: "kumme", name: "Kumme", elevation: 2660, coordinates: [7.8050, 46.0150], sector: "Sunnegga-Rothorn" },
  { id: "patrullarve", name: "Patrullarve", elevation: 2000, coordinates: [7.7467, 46.0030], sector: "Sunnegga-Rothorn" },
  { id: "tuftern", name: "Tuftern", elevation: 2215, coordinates: [7.7580, 46.0150], sector: "Sunnegga-Rothorn" },
  { id: "ried", name: "Ried", elevation: 1900, coordinates: [7.7688, 46.0260], sector: "Sunnegga-Rothorn" },
  { id: "findeln", name: "Findeln / Eja", elevation: 2051, coordinates: [7.7695, 46.0099], sector: "Sunnegga-Rothorn" },
  { id: "fluhalp", name: "Fluhalp", elevation: 2616, coordinates: [7.7980, 46.0080], sector: "Sunnegga-Rothorn" },
  { id: "breitboden", name: "Breitboden", elevation: 2514, coordinates: [7.7727, 46.0018], sector: "Sunnegga-Rothorn" },
  { id: "grunsee", name: "Grünsee", elevation: 2300, coordinates: [7.7800, 46.0050], sector: "Sunnegga-Rothorn" },

  // === GORNERGRAT SECTOR ===
  { id: "gant", name: "Gant", elevation: 2223, coordinates: [7.7818, 46.0011], sector: "Gornergrat" },
  { id: "riffelberg", name: "Riffelberg", elevation: 2582, coordinates: [7.7678, 45.9933], sector: "Gornergrat" },
  { id: "gornergrat", name: "Gornergrat", elevation: 3089, coordinates: [7.7847, 45.9831], sector: "Gornergrat" },
  { id: "rotenboden", name: "Rotenboden", elevation: 2815, coordinates: [7.7720, 45.9870], sector: "Gornergrat" },
  { id: "riffelalp", name: "Riffelalp", elevation: 2211, coordinates: [7.7530, 46.0050], sector: "Gornergrat" },
  { id: "hohtalli", name: "Hohtälli", elevation: 3286, coordinates: [7.8023, 45.9890], sector: "Gornergrat" },
  { id: "rote-nase", name: "Rote Nase", elevation: 3247, coordinates: [7.7950, 45.9900], sector: "Gornergrat" },
  { id: "gifthittli", name: "Gifthittli", elevation: 2935, coordinates: [7.7752, 45.9861], sector: "Gornergrat" },
  { id: "stockhorn", name: "Stockhorn", elevation: 3532, coordinates: [7.8230, 45.9868], sector: "Gornergrat" },

  // === MATTERHORN GLACIER PARADISE SECTOR ===
  { id: "schwarzsee", name: "Schwarzsee", elevation: 2583, coordinates: [7.7091, 45.9922], sector: "Matterhorn" },
  { id: "hirli", name: "Hirli", elevation: 2769, coordinates: [7.6987, 45.9890], sector: "Matterhorn" },
  { id: "trockener-steg", name: "Trockener Steg", elevation: 2939, coordinates: [7.7220, 45.9710], sector: "Matterhorn" },
  { id: "furgg", name: "Furgg", elevation: 2441, coordinates: [7.7137, 45.9850], sector: "Matterhorn" },
  { id: "matterhorn-glacier-paradise", name: "Matterhorn Glacier Paradise", elevation: 3883, coordinates: [7.7295, 45.9393], sector: "Matterhorn" },
  { id: "plateau-rosa", name: "Plateau Rosa / Testa Grigia", elevation: 3480, coordinates: [7.7162, 45.9364], sector: "Matterhorn" },
  { id: "theodulpass", name: "Theodulpass", elevation: 3301, coordinates: [7.7068, 45.9343], sector: "Matterhorn" },
  { id: "furggsattel", name: "Furggsattel", elevation: 3365, coordinates: [7.7043, 45.9507], sector: "Matterhorn" },
  { id: "gandegghutte", name: "Gandegghütte", elevation: 3030, coordinates: [7.7150, 45.9600], sector: "Matterhorn" },
  { id: "stafelalp", name: "Stafelalp", elevation: 2200, coordinates: [7.7095, 45.9912], sector: "Matterhorn" },
  { id: "aroleid", name: "Aroleid", elevation: 2320, coordinates: [7.7109, 45.9911], sector: "Matterhorn" },
  { id: "hermetje", name: "Hermetje", elevation: 2050, coordinates: [7.7200, 45.9980], sector: "Matterhorn" },
  { id: "schweigmatten", name: "Schweigmatten", elevation: 2100, coordinates: [7.7050, 46.0020], sector: "Matterhorn" },
  { id: "sandiger-boden", name: "Sandiger Boden", elevation: 2700, coordinates: [7.7180, 45.9776], sector: "Matterhorn" },
  { id: "gobba-di-rollin", name: "Gobba di Rollin", elevation: 3899, coordinates: [7.6912, 45.9283], sector: "Matterhorn" },
  { id: "theodulsee", name: "Theodulsee", elevation: 2700, coordinates: [7.7100, 45.9650], sector: "Matterhorn" },

  // === CERVINIA SECTOR ===
  { id: "plan-maison", name: "Plan Maison", elevation: 2555, coordinates: [7.6320, 45.9330], sector: "Cervinia" },
  { id: "cime-bianche-laghi", name: "Cime Bianche Laghi", elevation: 2812, coordinates: [7.6801, 45.9301], sector: "Cervinia" },
  { id: "breuil-cervinia", name: "Breuil-Cervinia", elevation: 2050, coordinates: [7.6314, 45.9371], sector: "Cervinia" },
  { id: "salette", name: "Salette", elevation: 2245, coordinates: [7.6500, 45.9200], sector: "Cervinia" },
  { id: "cieloalto", name: "Cieloalto", elevation: 2106, coordinates: [7.6400, 45.9250], sector: "Cervinia" },
  { id: "gran-sometta", name: "Gran Sometta", elevation: 3165, coordinates: [7.6808, 45.9109], sector: "Cervinia" },
  { id: "bec-carre", name: "Bec Carré", elevation: 3004, coordinates: [7.6750, 45.9050], sector: "Cervinia" },
  { id: "plan-torrette", name: "Plan Torrette", elevation: 2470, coordinates: [7.6380, 45.9300], sector: "Cervinia" },
  { id: "valtournenche", name: "Valtournenche", elevation: 1524, coordinates: [7.6200, 45.8800], sector: "Valtournenche" },
  { id: "colle-cime-bianche", name: "Colle Sup. Cime Bianche", elevation: 3090, coordinates: [7.6850, 45.9200], sector: "Cervinia" },
  { id: "fornet", name: "Fornet", elevation: 2800, coordinates: [7.6750, 45.9350], sector: "Cervinia" },
  { id: "bontadini", name: "Bontadini", elevation: 2900, coordinates: [7.6900, 45.9380], sector: "Cervinia" },
];

// ============================================================================
// LIFTS - All lifts with from/to stations
// ============================================================================
const lifts = [
  // === ZERMATT - SUNNEGGA-ROTHORN ===
  { id: "sunnegga-express", name: "Sunnegga Express", type: "funicular", from: "zermatt", to: "sunnegga", capacity: 2400, duration: 4 },
  { id: "sunnegga-blauherd", name: "Sunnegga - Blauherd", type: "gondola", from: "sunnegga", to: "blauherd", capacity: 2800, duration: 6 },
  { id: "blauherd-rothorn", name: "Blauherd - Rothorn", type: "cable_car", from: "blauherd", to: "rothorn", capacity: 2000, duration: 5 },
  { id: "findelbahn", name: "Findelbahn", type: "chairlift", from: "findeln", to: "sunnegga", capacity: 2400, duration: 6 },
  { id: "patrullarve", name: "Patrullarve", type: "chairlift", from: "patrullarve", to: "blauherd", capacity: 2400, duration: 8 },
  { id: "kumme", name: "Kumme", type: "chairlift", from: "blauherd", to: "kumme", capacity: 1800, duration: 5 },
  { id: "tuftern-shuttle", name: "Tuftern Shuttle", type: "chairlift", from: "tuftern", to: "sunnegga", capacity: 1200, duration: 4 },

  // === ZERMATT - GORNERGRAT ===
  { id: "gornergrat-bahn", name: "Gornergrat Bahn", type: "railway", from: "zermatt", to: "gornergrat", capacity: 500, duration: 33 },
  { id: "riffelberg-express", name: "Riffelberg Express", type: "gondola", from: "furi", to: "riffelberg", capacity: 2400, duration: 8 },
  { id: "gant-hohtalli", name: "Gant - Hohtälli", type: "cable_car", from: "gant", to: "hohtalli", capacity: 1800, duration: 6 },
  { id: "gifthittli", name: "Gifthittli", type: "chairlift", from: "riffelberg", to: "gifthittli", capacity: 2400, duration: 5 },

  // === ZERMATT - MATTERHORN GLACIER PARADISE ===
  { id: "matterhorn-express-1", name: "Matterhorn Express I (Zermatt-Furi)", type: "gondola", from: "zermatt", to: "furi", capacity: 2400, duration: 8 },
  { id: "matterhorn-express-2", name: "Matterhorn Express II (Furi-Schwarzsee)", type: "gondola", from: "furi", to: "schwarzsee", capacity: 2400, duration: 10 },
  { id: "schwarzsee-furgg", name: "Schwarzsee - Furgg", type: "chairlift", from: "schwarzsee", to: "furgg", capacity: 2400, duration: 6 },
  { id: "furgg-trockener-steg", name: "Furgg - Trockener Steg", type: "cable_car", from: "furgg", to: "trockener-steg", capacity: 2000, duration: 8 },
  { id: "furi-trockener-steg", name: "Furi - Trockener Steg", type: "cable_car", from: "furi", to: "trockener-steg", capacity: 2000, duration: 12 },
  { id: "glacier-ride-1", name: "Matterhorn Glacier Ride I", type: "cable_car", from: "trockener-steg", to: "matterhorn-glacier-paradise", capacity: 2000, duration: 9 },
  { id: "hirli-lift", name: "Hirli", type: "chairlift", from: "schwarzsee", to: "hirli", capacity: 2400, duration: 6 },
  { id: "furggsattel", name: "Furggsattel", type: "chairlift", from: "trockener-steg", to: "furggsattel", capacity: 1800, duration: 8 },
  { id: "gandegg", name: "Gandegg", type: "chairlift", from: "trockener-steg", to: "gandegghutte", capacity: 1200, duration: 6 },

  // === GLACIER / PLATEAU ROSA ===
  { id: "glacier-ride-2", name: "Matterhorn Glacier Ride II", type: "cable_car", from: "matterhorn-glacier-paradise", to: "plateau-rosa", capacity: 2000, duration: 4 },
  { id: "plateau-rosa-cable", name: "Plateau Rosa Cable Car", type: "cable_car", from: "cime-bianche-laghi", to: "plateau-rosa", capacity: 1500, duration: 6 },

  // === CERVINIA ===
  { id: "plan-maison-gondola", name: "Plan Maison Gondola", type: "gondola", from: "breuil-cervinia", to: "plan-maison", capacity: 2400, duration: 8 },
  { id: "fornet-chairlift", name: "Fornet", type: "chairlift", from: "plan-maison", to: "fornet", capacity: 2000, duration: 6 },
  { id: "bontadini-chairlift", name: "Bontadini", type: "chairlift", from: "fornet", to: "bontadini", capacity: 2000, duration: 5 },
  { id: "cime-bianche-gondola", name: "Cime Bianche Laghi", type: "gondola", from: "plan-maison", to: "cime-bianche-laghi", capacity: 2200, duration: 10 },
  { id: "gran-sometta-chairlift", name: "Gran Sometta", type: "chairlift", from: "cime-bianche-laghi", to: "gran-sometta", capacity: 1800, duration: 8 },
];

// ============================================================================
// PISTES - All slopes with connections
// Format: from = top station, to = bottom station, connectsTo = what you can reach at bottom
// ============================================================================
const pistes = [
  // === SUNNEGGA-ROTHORN SECTOR (1-19) ===
  { id: "1", number: "1", name: "Untere National", sector: "Sunnegga-Rothorn", difficulty: "red", from: "sunnegga", to: "ried", connectsTo: ["zermatt"] },
  { id: "2", number: "2", name: "Ried", sector: "Sunnegga-Rothorn", difficulty: "blue", from: "sunnegga", to: "ried", connectsTo: ["zermatt"] },
  { id: "3", number: "3", name: "Howette", sector: "Sunnegga-Rothorn", difficulty: "red", from: "blauherd", to: "sunnegga", connectsTo: ["sunnegga-blauherd", "sunnegga-express", "findelbahn"] },
  { id: "4", number: "4", name: "Brunnjeschbord", sector: "Sunnegga-Rothorn", difficulty: "red", from: "sunnegga", to: "findeln", connectsTo: ["findelbahn"] },
  { id: "5", number: "5", name: "Eisfluh", sector: "Sunnegga-Rothorn", difficulty: "blue", from: "sunnegga", to: "findeln", connectsTo: ["findelbahn"] },
  { id: "6", number: "6", name: "Easy run", sector: "Sunnegga-Rothorn", difficulty: "blue", from: "blauherd", to: "sunnegga", connectsTo: ["sunnegga-blauherd", "sunnegga-express"] },
  { id: "7", number: "7", name: "Standard", sector: "Sunnegga-Rothorn", difficulty: "blue", from: "blauherd", to: "sunnegga", connectsTo: ["sunnegga-blauherd", "sunnegga-express"] },
  { id: "8", number: "8", name: "Obere National", sector: "Sunnegga-Rothorn", difficulty: "red", from: "rothorn", to: "blauherd", connectsTo: ["blauherd-rothorn", "sunnegga-blauherd", "patrullarve"] },
  { id: "9", number: "9", name: "Tuftern", sector: "Sunnegga-Rothorn", difficulty: "blue", from: "sunnegga", to: "tuftern", connectsTo: ["tuftern-shuttle"] },
  { id: "10", number: "10", name: "Paradise", sector: "Sunnegga-Rothorn", difficulty: "blue", from: "blauherd", to: "patrullarve", connectsTo: ["patrullarve"] },
  { id: "11", number: "11", name: "Rotweng", sector: "Sunnegga-Rothorn", difficulty: "red", from: "rothorn", to: "blauherd", connectsTo: ["blauherd-rothorn", "sunnegga-blauherd"] },
  { id: "12", number: "12", name: "Schneehuhn", sector: "Sunnegga-Rothorn", difficulty: "red", from: "rothorn", to: "blauherd", connectsTo: ["blauherd-rothorn", "sunnegga-blauherd"] },
  { id: "13", number: "13", name: "Downhill", sector: "Sunnegga-Rothorn", difficulty: "black", from: "rothorn", to: "patrullarve", connectsTo: ["patrullarve"] },
  { id: "14", number: "14", name: "Kumme", sector: "Sunnegga-Rothorn", difficulty: "red", from: "kumme", to: "blauherd", connectsTo: ["kumme", "sunnegga-blauherd"] },
  { id: "15", number: "15", name: "Tufternkumme", sector: "Sunnegga-Rothorn", difficulty: "red", from: "kumme", to: "tuftern", connectsTo: ["tuftern-shuttle"] },
  { id: "15b", number: "15b", name: "Murmelbodmen", sector: "Sunnegga-Rothorn", difficulty: "black", from: "kumme", to: "tuftern", connectsTo: ["tuftern-shuttle"] },
  { id: "16", number: "16", name: "Chamois", sector: "Sunnegga-Rothorn", difficulty: "red", from: "blauherd", to: "gant", connectsTo: ["gant-hohtalli"] },
  { id: "17", number: "17", name: "Marmotte", sector: "Sunnegga-Rothorn", difficulty: "red", from: "blauherd", to: "gant", connectsTo: ["gant-hohtalli"] },

  // === GORNERGRAT SECTOR (25-45) ===
  { id: "25", number: "25", name: "Berter", sector: "Gornergrat", difficulty: "red", from: "sunnegga", to: "findeln", connectsTo: ["findelbahn"] },
  { id: "26", number: "26", name: "Grünsee", sector: "Gornergrat", difficulty: "blue", from: "gant", to: "grunsee", connectsTo: ["26-continuation"] },
  { id: "29", number: "29", name: "Kelle", sector: "Gornergrat", difficulty: "red", from: "gifthittli", to: "riffelberg", connectsTo: ["gifthittli", "gornergrat-bahn"] },
  { id: "31", number: "31", name: "Platte", sector: "Gornergrat", difficulty: "red", from: "gornergrat", to: "riffelberg", connectsTo: ["gifthittli", "gornergrat-bahn"] },
  { id: "32", number: "32", name: "Grieschumme", sector: "Gornergrat", difficulty: "black", from: "hohtalli", to: "gant", connectsTo: ["gant-hohtalli"] },
  { id: "33", number: "33", name: "Triftji", sector: "Gornergrat", difficulty: "black", from: "hohtalli", to: "gant", connectsTo: ["gant-hohtalli"] },
  { id: "35", number: "35", name: "Gifthittli", sector: "Gornergrat", difficulty: "red", from: "gifthittli", to: "riffelberg", connectsTo: ["gifthittli", "gornergrat-bahn"] },
  { id: "36", number: "36", name: "Gornergrat", sector: "Gornergrat", difficulty: "blue", from: "gornergrat", to: "riffelberg", connectsTo: ["gifthittli", "gornergrat-bahn"] },
  { id: "37", number: "37", name: "Riffelhorn", sector: "Gornergrat", difficulty: "blue", from: "rotenboden", to: "riffelberg", connectsTo: ["gifthittli", "gornergrat-bahn"] },
  { id: "39", number: "39", name: "Riffelalp", sector: "Gornergrat", difficulty: "red", from: "riffelberg", to: "riffelalp", connectsTo: ["zermatt", "43"] },
  { id: "42", number: "42", name: "Schweigmatten", sector: "Gornergrat", difficulty: "red", from: "schwarzsee", to: "schweigmatten", connectsTo: ["furi", "matterhorn-express-1"] },
  { id: "43", number: "43", name: "Moos", sector: "Gornergrat", difficulty: "blue", from: "riffelalp", to: "zermatt", connectsTo: ["matterhorn-express-1", "sunnegga-express", "gornergrat-bahn"] },
  { id: "44", number: "44", name: "Hohtälli", sector: "Gornergrat", difficulty: "black", from: "hohtalli", to: "gant", connectsTo: ["gant-hohtalli"] },

  // === MATTERHORN GLACIER PARADISE SECTOR (49-75) ===
  { id: "49", number: "49", name: "Bielti", sector: "Matterhorn", difficulty: "blue", from: "schwarzsee", to: "furi", connectsTo: ["matterhorn-express-1", "riffelberg-express", "furi-trockener-steg"] },
  { id: "50", number: "50", name: "Blatten", sector: "Matterhorn", difficulty: "red", from: "furi", to: "blatten", connectsTo: ["zermatt"] },
  { id: "51", number: "51", name: "Weisse Perle", sector: "Matterhorn", difficulty: "blue", from: "trockener-steg", to: "schwarzsee", connectsTo: ["matterhorn-express-2", "hirli-lift", "schwarzsee-furgg"] },
  { id: "52", number: "52", name: "Stafelalp", sector: "Matterhorn", difficulty: "red", from: "hirli", to: "stafelalp", connectsTo: ["53", "54"] },
  { id: "53", number: "53", name: "Oberer Tiefbach", sector: "Matterhorn", difficulty: "red", from: "hirli", to: "stafelalp", connectsTo: ["59", "60"] },
  { id: "54", number: "54", name: "Hörnli", sector: "Matterhorn", difficulty: "red", from: "hirli", to: "schwarzsee", connectsTo: ["matterhorn-express-2", "hirli-lift"] },
  { id: "55", number: "55", name: "Hirli", sector: "Matterhorn", difficulty: "red", from: "hirli", to: "schwarzsee", connectsTo: ["matterhorn-express-2", "hirli-lift"] },
  { id: "56", number: "56", name: "Kuhbodmen", sector: "Matterhorn", difficulty: "blue", from: "furgg", to: "schwarzsee", connectsTo: ["matterhorn-express-2", "hirli-lift"] },
  { id: "57", number: "57", name: "Aroleid", sector: "Matterhorn", difficulty: "red", from: "aroleid", to: "stafelalp", connectsTo: ["59"] },
  { id: "58", number: "58", name: "Hermetje", sector: "Matterhorn", difficulty: "red", from: "stafelalp", to: "hermetje", connectsTo: ["furi"] },
  { id: "59", number: "59", name: "Tiefbach", sector: "Matterhorn", difficulty: "red", from: "stafelalp", to: "furi", connectsTo: ["matterhorn-express-1", "riffelberg-express"] },
  { id: "60", number: "60", name: "Momatt", sector: "Matterhorn", difficulty: "red", from: "stafelalp", to: "furi", connectsTo: ["matterhorn-express-1"] },
  { id: "61", number: "61", name: "Skiweg", sector: "Matterhorn", difficulty: "blue", from: "furgg", to: "schwarzsee", connectsTo: ["matterhorn-express-2"] },
  { id: "62", number: "62", name: "Furgg - Furi", sector: "Matterhorn", difficulty: "black", from: "furgg", to: "furi", connectsTo: ["matterhorn-express-1", "furi-trockener-steg"] },
  { id: "63", number: "63", name: "Sandiger Boden", sector: "Matterhorn", difficulty: "red", from: "sandiger-boden", to: "furgg", connectsTo: ["schwarzsee-furgg", "furgg-trockener-steg"] },
  { id: "64", number: "64", name: "Garten", sector: "Matterhorn", difficulty: "red", from: "trockener-steg", to: "furgg", connectsTo: ["furgg-trockener-steg", "schwarzsee-furgg"] },
  { id: "66", number: "66", name: "Theodulsee", sector: "Matterhorn", difficulty: "blue", from: "theodulsee", to: "trockener-steg", connectsTo: ["glacier-ride-1", "furggsattel"] },
  { id: "67", number: "67", name: "Garten Buckelpiste", sector: "Matterhorn", difficulty: "black", from: "trockener-steg", to: "furgg", connectsTo: ["furgg-trockener-steg"] },
  { id: "68", number: "68", name: "Tumigu", sector: "Matterhorn", difficulty: "red", from: "trockener-steg", to: "schwarzsee", connectsTo: ["matterhorn-express-2", "hirli-lift"] },
  { id: "69", number: "69", name: "Matterhorn", sector: "Matterhorn", difficulty: "red", from: "trockener-steg", to: "schwarzsee", connectsTo: ["matterhorn-express-2"] },
  { id: "70", number: "70", name: "Schusspiste", sector: "Matterhorn", difficulty: "red", from: "trockener-steg", to: "furgg", connectsTo: ["furgg-trockener-steg"] },
  { id: "71", number: "71", name: "Theodulgletscher", sector: "Matterhorn", difficulty: "red", from: "furggsattel", to: "trockener-steg", connectsTo: ["glacier-ride-1", "furggsattel"] },
  { id: "72", number: "72", name: "Furggsattel", sector: "Matterhorn", difficulty: "red", from: "furggsattel", to: "trockener-steg", connectsTo: ["glacier-ride-1", "gandegg"] },
  { id: "73", number: "73", name: "Gandegg", sector: "Matterhorn", difficulty: "blue", from: "gandegghutte", to: "trockener-steg", connectsTo: ["glacier-ride-1"] },

  // === GLACIER / THEODULGLETSCHER (80-88) ===
  { id: "80", number: "80", name: "Testa Grigia", sector: "Glacier", difficulty: "red", from: "plateau-rosa", to: "theodulpass", connectsTo: ["71"] },
  { id: "83", number: "83", name: "Plateau Rosa", sector: "Glacier", difficulty: "red", from: "plateau-rosa", to: "trockener-steg", connectsTo: ["glacier-ride-1"] },
  { id: "84", number: "84", name: "Ventina Glacier", sector: "Glacier", difficulty: "black", from: "plateau-rosa", to: "cime-bianche-laghi", connectsTo: ["plateau-rosa-cable", "cime-bianche-gondola"] },
  { id: "85", number: "85", name: "Matterhorn Glacier Paradise", sector: "Glacier", difficulty: "red", from: "matterhorn-glacier-paradise", to: "trockener-steg", connectsTo: ["glacier-ride-1", "furggsattel", "gandegg"] },
  { id: "87", number: "87", name: "Verbindungspiste", sector: "Glacier", difficulty: "blue", from: "plateau-rosa", to: "trockener-steg", connectsTo: ["glacier-ride-1"] },
  { id: "88", number: "88", name: "Testa II", sector: "Glacier", difficulty: "red", from: "plateau-rosa", to: "cime-bianche-laghi", connectsTo: ["plateau-rosa-cable"] },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getStationById(id) {
  return stations.find(s => s.id === id);
}

function calculateDistance(coord1, coord2) {
  const R = 6371000; // Earth radius in meters
  const lat1 = coord1[1] * Math.PI / 180;
  const lat2 = coord2[1] * Math.PI / 180;
  const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ============================================================================
// GENERATE OUTPUT FILES
// ============================================================================

function generateStationsGeoJSON() {
  return {
    type: "FeatureCollection",
    features: stations.map(s => ({
      type: "Feature",
      properties: {
        id: s.id,
        name: s.name,
        elevation: s.elevation,
        sector: s.sector
      },
      geometry: {
        type: "Point",
        coordinates: s.coordinates
      }
    }))
  };
}

function generateLiftsGeoJSON() {
  return {
    type: "FeatureCollection",
    features: lifts.map(l => {
      const fromStation = getStationById(l.from);
      const toStation = getStationById(l.to);

      if (!fromStation || !toStation) {
        console.error(`Missing station for lift ${l.name}: from=${l.from}, to=${l.to}`);
        return null;
      }

      const verticalRise = toStation.elevation - fromStation.elevation;

      return {
        type: "Feature",
        properties: {
          id: l.id,
          name: l.name,
          type: l.type,
          bottomElevation: fromStation.elevation,
          topElevation: toStation.elevation,
          verticalRise: verticalRise,
          capacity: l.capacity,
          duration: l.duration,
          sector: fromStation.sector,
          fromStation: l.from,
          toStation: l.to
        },
        geometry: {
          type: "LineString",
          coordinates: [fromStation.coordinates, toStation.coordinates]
        }
      };
    }).filter(Boolean)
  };
}

function generateSlopesGeoJSON() {
  return {
    type: "FeatureCollection",
    features: pistes.map(p => {
      const fromStation = getStationById(p.from);
      const toStation = getStationById(p.to);

      if (!fromStation || !toStation) {
        console.error(`Missing station for piste ${p.name}: from=${p.from}, to=${p.to}`);
        return null;
      }

      const verticalDrop = fromStation.elevation - toStation.elevation;
      const length = Math.round(calculateDistance(fromStation.coordinates, toStation.coordinates));

      return {
        type: "Feature",
        properties: {
          id: p.id,
          number: p.number,
          name: p.name,
          difficulty: p.difficulty,
          length: length,
          verticalDrop: verticalDrop,
          sector: p.sector,
          fromStation: p.from,
          toStation: p.to,
          connectsTo: p.connectsTo
        },
        geometry: {
          type: "LineString",
          coordinates: [fromStation.coordinates, toStation.coordinates]
        }
      };
    }).filter(Boolean)
  };
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const dataDir = path.join(__dirname, '..', 'src', 'data');

  console.log('Generating curated ski area data...\n');

  // Generate stations
  const stationsGeoJSON = generateStationsGeoJSON();
  fs.writeFileSync(path.join(dataDir, 'stations.json'), JSON.stringify(stationsGeoJSON, null, 2));
  console.log(`✓ stations.json: ${stationsGeoJSON.features.length} stations`);

  // Generate lifts
  const liftsGeoJSON = generateLiftsGeoJSON();
  fs.writeFileSync(path.join(dataDir, 'lifts.json'), JSON.stringify(liftsGeoJSON, null, 2));
  console.log(`✓ lifts.json: ${liftsGeoJSON.features.length} lifts`);

  // Generate slopes
  const slopesGeoJSON = generateSlopesGeoJSON();
  fs.writeFileSync(path.join(dataDir, 'slopes.json'), JSON.stringify(slopesGeoJSON, null, 2));
  console.log(`✓ slopes.json: ${slopesGeoJSON.features.length} slopes`);

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Stations: ${stationsGeoJSON.features.length}`);
  console.log(`Lifts: ${liftsGeoJSON.features.length}`);
  console.log(`Slopes: ${slopesGeoJSON.features.length}`);

  // Show connections summary
  console.log('\n=== SAMPLE CONNECTIONS ===');
  const weissePerle = pistes.find(p => p.name === 'Weisse Perle');
  if (weissePerle) {
    console.log(`Weisse Perle (${weissePerle.from} → ${weissePerle.to})`);
    console.log(`  Connects to: ${weissePerle.connectsTo.join(', ')}`);
  }

  const hirli = pistes.find(p => p.number === '55');
  if (hirli) {
    console.log(`Hirli (${hirli.from} → ${hirli.to})`);
    console.log(`  Connects to: ${hirli.connectsTo.join(', ')}`);
  }
}

main();
