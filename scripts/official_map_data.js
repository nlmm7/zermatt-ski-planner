/**
 * Official piste map data from skimap.org 2025/2026 season
 * Source: https://files.skimap.org/l4epgcod5cknbmggtkju94872jr0.pdf
 *
 * This is the authoritative source for:
 * - Piste names and numbers
 * - Sector assignments
 * - Difficulty levels (to be added from map colors)
 * - Connections (to be derived from map topology)
 */

// Station data with elevations from the official map
const stations = {
  // Zermatt village area
  "zermatt": { name: "Zermatt", elevation: 1620, sector: "Zermatt" },
  "furi": { name: "Furi", elevation: 1867, sector: "Matterhorn" },
  "findelbach": { name: "Findelbach", elevation: 1774, sector: "Zermatt" },
  "blatten": { name: "Blatten", elevation: null, sector: "Zermatt" },
  "zum-see": { name: "Zum See", elevation: null, sector: "Zermatt" },
  "moos": { name: "Moos", elevation: null, sector: "Zermatt" },

  // Sunnegga-Rothorn sector
  "sunnegga": { name: "Sunnegga", elevation: 2288, sector: "Sunnegga-Rothorn" },
  "blauherd": { name: "Blauherd", elevation: 2571, sector: "Sunnegga-Rothorn" },
  "rothorn": { name: "Rothorn", elevation: 3103, sector: "Sunnegga-Rothorn" },
  "kumme": { name: "Kumme", elevation: 2660, sector: "Sunnegga-Rothorn" },
  "findeln-eja": { name: "Findeln Eja", elevation: null, sector: "Sunnegga-Rothorn" },
  "breitboden": { name: "Breitboden", elevation: 2514, sector: "Sunnegga-Rothorn" },
  "patrullarve": { name: "Patrullarve", elevation: 2000, sector: "Sunnegga-Rothorn" },
  "tuftern": { name: "Tuftern", elevation: 2215, sector: "Sunnegga-Rothorn" },
  "ried": { name: "Ried", elevation: null, sector: "Sunnegga-Rothorn" },
  "fluhalp": { name: "Fluhalp", elevation: 2616, sector: "Sunnegga-Rothorn" },

  // Gornergrat sector
  "gant": { name: "Gant", elevation: 2223, sector: "Gornergrat" },
  "riffelberg": { name: "Riffelberg", elevation: 2582, sector: "Gornergrat" },
  "gornergrat": { name: "Gornergrat", elevation: 3089, sector: "Gornergrat" },
  "rotenboden": { name: "Rotenboden", elevation: 2815, sector: "Gornergrat" },
  "riffelalp": { name: "Riffelalp", elevation: 2211, sector: "Gornergrat" },
  "hohtalli": { name: "Hohtälli", elevation: 3286, sector: "Gornergrat" },
  "rote-nase": { name: "Rote Nase", elevation: 3247, sector: "Gornergrat" },
  "gifthittli": { name: "Gifthittli", elevation: 2935, sector: "Gornergrat" },
  "grunsee": { name: "Grünsee", elevation: null, sector: "Gornergrat" },
  "stockhorn": { name: "Stockhorn", elevation: 3532, sector: "Gornergrat" },

  // Matterhorn Glacier Paradise sector
  "schwarzsee": { name: "Schwarzsee", elevation: 2583, sector: "Matterhorn" },
  "hirli": { name: "Hirli", elevation: 2769, sector: "Matterhorn" },
  "trockener-steg": { name: "Trockener Steg", elevation: 2939, sector: "Matterhorn" },
  "furgg": { name: "Furgg", elevation: 2441, sector: "Matterhorn" },
  "matterhorn-glacier-paradise": { name: "Matterhorn Glacier Paradise", elevation: 3883, sector: "Matterhorn" },
  "plateau-rosa": { name: "Plateau Rosa / Testa Grigia", elevation: 3480, sector: "Matterhorn" },
  "theodulpass": { name: "Theodulpass", elevation: 3301, sector: "Matterhorn" },
  "furggsattel": { name: "Furggsattel", elevation: 3365, sector: "Matterhorn" },
  "furgggrat": { name: "Furgggrat", elevation: 3492, sector: "Matterhorn" },
  "gandegghütte": { name: "Gandegghütte", elevation: 3030, sector: "Matterhorn" },
  "stafelalp": { name: "Stafelalp", elevation: 2200, sector: "Matterhorn" },
  "aroleid": { name: "Aroleid", elevation: 2320, sector: "Matterhorn" },
  "hermetje": { name: "Hermetje", elevation: null, sector: "Matterhorn" },
  "schweigmatten": { name: "Schweigmatten", elevation: null, sector: "Matterhorn" },
  "eisfluh": { name: "Eisfluh", elevation: null, sector: "Matterhorn" },
  "sandiger-boden": { name: "Sandiger Boden", elevation: null, sector: "Matterhorn" },
  "gobba-di-rollin": { name: "Gobba di Rollin", elevation: 3899, sector: "Matterhorn" },

  // Cervinia sector
  "plan-maison": { name: "Plan Maison", elevation: 2555, sector: "Cervinia" },
  "cime-bianche-laghi": { name: "Cime Bianche Laghi", elevation: 2812, sector: "Cervinia" },
  "breuil-cervinia": { name: "Breuil-Cervinia", elevation: 2050, sector: "Cervinia" },
  "salette": { name: "Salette", elevation: 2245, sector: "Cervinia" },
  "cieloalto": { name: "Cieloalto", elevation: 2106, sector: "Cervinia" },
  "colle-inf-cime-bianche": { name: "Colle inf. Cime Bianche", elevation: 2896, sector: "Cervinia" },
  "colle-sup-cime-bianche": { name: "Colle Superiore delle Cime Bianche", elevation: 3090, sector: "Cervinia" },
  "gran-sometta": { name: "Gran Sometta", elevation: 3165, sector: "Cervinia" },
  "bec-carre": { name: "Bec Carré", elevation: 3004, sector: "Cervinia" },
  "plan-torrette": { name: "Plan Torrette", elevation: 2470, sector: "Cervinia" },

  // Valtournenche
  "valtournenche": { name: "Valtournenche", elevation: 1524, sector: "Valtournenche" },
};

// Complete piste list from official map
// Format: { number, name, sector, difficulty, fromStation, toStation }
// difficulty: green=easy, blue=medium, red=difficult, black=expert
const pistes = {
  // ==========================================
  // SUNNEGGA-ROTHORN SECTOR (1-19a)
  // ==========================================
  "1": { name: "Untere National", sector: "Sunnegga-Rothorn", difficulty: "red" },
  "2": { name: "Ried", sector: "Sunnegga-Rothorn", difficulty: "blue" },
  "2a": { name: "Riedweg (Mehrfachnutzung)", sector: "Sunnegga-Rothorn", difficulty: "blue" },
  "3": { name: "Howette", sector: "Sunnegga-Rothorn", difficulty: "red" },
  "4": { name: "Brunnjeschbord", sector: "Sunnegga-Rothorn", difficulty: "red" },
  "5": { name: "Eisfluh", sector: "Sunnegga-Rothorn", difficulty: "blue" },
  "6": { name: "Easy run", sector: "Sunnegga-Rothorn", difficulty: "blue" },
  "7": { name: "Standard", sector: "Sunnegga-Rothorn", difficulty: "blue" },
  "8": { name: "Obere National", sector: "Sunnegga-Rothorn", difficulty: "red" },
  "9": { name: "Tuftern", sector: "Sunnegga-Rothorn", difficulty: "blue" },
  "10": { name: "Paradise", sector: "Sunnegga-Rothorn", difficulty: "blue" },
  "11": { name: "Rotweng", sector: "Sunnegga-Rothorn", difficulty: "red" },
  "12": { name: "Schneehuhn", sector: "Sunnegga-Rothorn", difficulty: "red" },
  "13": { name: "Downhill", sector: "Sunnegga-Rothorn", difficulty: "black" },
  "14": { name: "Kumme", sector: "Sunnegga-Rothorn", difficulty: "red" },
  "15": { name: "Tufternkumme", sector: "Sunnegga-Rothorn", difficulty: "red" },
  "15b": { name: "Murmelbodmen", sector: "Sunnegga-Rothorn", difficulty: "black" },
  "16": { name: "Chamois", sector: "Sunnegga-Rothorn", difficulty: "red" },
  "17": { name: "Marmotte", sector: "Sunnegga-Rothorn", difficulty: "red" },
  "18": { name: "Arbzug", sector: "Sunnegga-Rothorn", difficulty: "red" },
  "19": { name: "Fluhalp", sector: "Sunnegga-Rothorn", difficulty: "red" },
  "19a": { name: "Moräne Umfahrung", sector: "Sunnegga-Rothorn", difficulty: "blue" },

  // ==========================================
  // GORNERGRAT SECTOR (25-45)
  // ==========================================
  "25": { name: "Berter", sector: "Gornergrat", difficulty: "red" },
  "26": { name: "Grünsee", sector: "Gornergrat", difficulty: "blue" },
  "27": { name: "Balmbrunnen", sector: "Gornergrat", difficulty: "red" },
  "28": { name: "White Hare", sector: "Gornergrat", difficulty: "red" },
  "29": { name: "Kelle", sector: "Gornergrat", difficulty: "red" },
  "29a": { name: "Umfahrung Kelle", sector: "Gornergrat", difficulty: "blue" },
  "30": { name: "Mittelritz", sector: "Gornergrat", difficulty: "red" },
  "31": { name: "Platte", sector: "Gornergrat", difficulty: "red" },
  "32": { name: "Grieschumme", sector: "Gornergrat", difficulty: "black" },
  "33": { name: "Triftji", sector: "Gornergrat", difficulty: "black" },
  "35": { name: "Gifthittli", sector: "Gornergrat", difficulty: "red" },
  "36": { name: "Gornergrat", sector: "Gornergrat", difficulty: "blue" },
  "37": { name: "Riffelhorn", sector: "Gornergrat", difficulty: "blue" },
  "38": { name: "Rotenboden", sector: "Gornergrat", difficulty: "red" },
  "39": { name: "Riffelalp", sector: "Gornergrat", difficulty: "red" },
  "40": { name: "Riffelboden", sector: "Gornergrat", difficulty: "red" },
  "41": { name: "Landtunnel", sector: "Gornergrat", difficulty: "blue" },
  "42": { name: "Schweigmatten", sector: "Gornergrat", difficulty: "red" },
  "43": { name: "Moos", sector: "Gornergrat", difficulty: "blue" },
  "44": { name: "Hohtälli", sector: "Gornergrat", difficulty: "black" },
  "45": { name: "Iglupiste", sector: "Gornergrat", difficulty: "blue" },

  // ==========================================
  // MATTERHORN GLACIER PARADISE SECTOR (49-75)
  // ==========================================
  "49": { name: "Bielti", sector: "Matterhorn", difficulty: "blue" },
  "50": { name: "Blatten", sector: "Matterhorn", difficulty: "red" },
  "51": { name: "Weisse Perle", sector: "Matterhorn", difficulty: "blue" },
  "52": { name: "Stafelalp", sector: "Matterhorn", difficulty: "red" },
  "53": { name: "Oberer Tiefbach", sector: "Matterhorn", difficulty: "red" },
  "54": { name: "Hörnli", sector: "Matterhorn", difficulty: "red" },
  "55": { name: "Hirli", sector: "Matterhorn", difficulty: "red" },
  "56": { name: "Kuhbodmen", sector: "Matterhorn", difficulty: "blue" },
  "57": { name: "Aroleid", sector: "Matterhorn", difficulty: "red" },
  "58": { name: "Hermetje", sector: "Matterhorn", difficulty: "red" },
  "59": { name: "Tiefbach", sector: "Matterhorn", difficulty: "red" },
  "60": { name: "Momatt", sector: "Matterhorn", difficulty: "red" },
  "61": { name: "Skiweg", sector: "Matterhorn", difficulty: "blue" },
  "62": { name: "Furgg – Furi", sector: "Matterhorn", difficulty: "black" },
  "63": { name: "Sandiger Boden", sector: "Matterhorn", difficulty: "red" },
  "64": { name: "Garten", sector: "Matterhorn", difficulty: "red" },
  "65": { name: "Rennstrecke", sector: "Matterhorn", difficulty: "red" },
  "66": { name: "Theodulsee", sector: "Matterhorn", difficulty: "blue" },
  "67": { name: "Garten Buckelpiste", sector: "Matterhorn", difficulty: "black" },
  "68": { name: "Tumigu", sector: "Matterhorn", difficulty: "red" },
  "69": { name: "Matterhorn", sector: "Matterhorn", difficulty: "red" },
  "70": { name: "Schusspiste", sector: "Matterhorn", difficulty: "red" },
  "71": { name: "Theodulgletscher", sector: "Matterhorn", difficulty: "red" },
  "72": { name: "Furggsattel", sector: "Matterhorn", difficulty: "red" },
  "73": { name: "Gandegg", sector: "Matterhorn", difficulty: "blue" },
  "75": { name: "Verbindung Theodulsee", sector: "Matterhorn", difficulty: "blue" },

  // ==========================================
  // SOMMERSKI / THEODULGLETSCHER (80-88)
  // ==========================================
  "80": { name: "Testa Grigia", sector: "Glacier", difficulty: "red" },
  "81": { name: "Fiererpiste", sector: "Glacier", difficulty: "red" },
  "83": { name: "Plateau Rosa", sector: "Glacier", difficulty: "red" },
  "84": { name: "Ventina Glacier", sector: "Glacier", difficulty: "black" },
  "85": { name: "Matterhorn Glacier Paradise", sector: "Glacier", difficulty: "red" },
  "85a": { name: "Kilometro Lanciato", sector: "Glacier", difficulty: "black" },
  "87": { name: "Verbindungspiste", sector: "Glacier", difficulty: "blue" },
  "88": { name: "Testa II", sector: "Glacier", difficulty: "red" },

  // ==========================================
  // BREUIL-CERVINIA (Italian numbering)
  // ==========================================
  "C2": { name: "Cretaz", sector: "Cervinia", difficulty: "blue" },
  "C3": { name: "Plan Torrette-Pre de Veau", sector: "Cervinia", difficulty: "red" },
  "C3.0": { name: "Pre de Veau-Pirovano", sector: "Cervinia", difficulty: "red" },
  "C3.00": { name: "Pirovano-Cervinia", sector: "Cervinia", difficulty: "red" },
  "C3bis": { name: "Falliniere", sector: "Cervinia", difficulty: "red" },
  "C4": { name: "Plan Torrette", sector: "Cervinia", difficulty: "blue" },
  "C5": { name: "Plan Maison-Cervinia", sector: "Cervinia", difficulty: "blue" },
  "C5bis": { name: "Vallone 5", sector: "Cervinia", difficulty: "red" },
  "C6": { name: "Plateau Rosa-Bontadini", sector: "Cervinia", difficulty: "red" },
  "C6.0": { name: "Fornet 1", sector: "Cervinia", difficulty: "red" },
  "C6.00": { name: "Plan Maison", sector: "Cervinia", difficulty: "red" },
  "C6bis": { name: "Theodulo-Plan Maison", sector: "Cervinia", difficulty: "red" },
  "C7": { name: "Ventina Ghiacciaio", sector: "Cervinia", difficulty: "black" },
  "C7.0": { name: "Ventina Goillet", sector: "Cervinia", difficulty: "red" },
  "C7.00": { name: "Ventina Bardoney 1", sector: "Cervinia", difficulty: "red" },
  "C7bis": { name: "Coppa del Mondo", sector: "Cervinia", difficulty: "black" },
  "C8": { name: "Baby La Vieille 1", sector: "Cervinia", difficulty: "blue" },
  "C8bis": { name: "Baby La Vieille 2", sector: "Cervinia", difficulty: "blue" },
  "C9bis": { name: "Morene del Furggen", sector: "Cervinia", difficulty: "red" },
  "C10": { name: "Alpe Giomein 2", sector: "Cervinia", difficulty: "blue" },
  "C11": { name: "Gran Roc-Pre de Veau", sector: "Cervinia", difficulty: "red" },
  "C12": { name: "Muro Europa", sector: "Cervinia", difficulty: "black" },
  "C13": { name: "Ventina-Cieloalto", sector: "Cervinia", difficulty: "red" },
  "C14": { name: "Baby Cretaz", sector: "Cervinia", difficulty: "blue" },
  "C16": { name: "Cieloalto-Cervinia", sector: "Cervinia", difficulty: "red" },
  "C16bis": { name: "Cieloalto Cervinia", sector: "Cervinia", difficulty: "red" },
  "C21": { name: "Cieloalto 1", sector: "Cervinia", difficulty: "black" },
  "C22": { name: "Cieloalto 2", sector: "Cervinia", difficulty: "black" },
  "C24": { name: "Pancheron", sector: "Cervinia", difficulty: "red" },
  "C24bis": { name: "Variante Pancheron", sector: "Cervinia", difficulty: "red" },
  "C26": { name: "Rocce Nere 1", sector: "Cervinia", difficulty: "black" },
  "C27": { name: "Snowpark", sector: "Cervinia", difficulty: "red" },
  "C29": { name: "Rocce Bianche", sector: "Cervinia", difficulty: "red" },
  "C29bis": { name: "Alpe Giomein 1", sector: "Cervinia", difficulty: "red" },
  "C30": { name: "Cretaz V-Plan Torrette", sector: "Cervinia", difficulty: "blue" },
  "C33": { name: "Bardoney", sector: "Cervinia", difficulty: "red" },
  "C34": { name: "Raccordo Cieloalto-Bardoney", sector: "Cervinia", difficulty: "red" },
  "C35": { name: "Ventina-Colle Cime Bianche", sector: "Cervinia", difficulty: "red" },
  "C36": { name: "Gran Sometta 1", sector: "Cervinia", difficulty: "red" },
  "C37": { name: "Gran Sometta 3", sector: "Cervinia", difficulty: "red" },
  "C38": { name: "Gran Sometta 2", sector: "Cervinia", difficulty: "red" },
  "C39": { name: "Gaspard", sector: "Cervinia", difficulty: "red" },
  "C46": { name: "Bontadini 2", sector: "Cervinia", difficulty: "red" },
  "C47": { name: "Fornet 2", sector: "Cervinia", difficulty: "red" },
  "C59": { name: "Pista Nera del Cervino", sector: "Cervinia", difficulty: "black" },
  "C62": { name: "Gran Roc", sector: "Cervinia", difficulty: "black" },

  // ==========================================
  // VALTOURNENCHE
  // ==========================================
  "V1": { name: "Reine Blanche", sector: "Valtournenche", difficulty: "red" },
  "V1a": { name: "Chateau", sector: "Valtournenche", difficulty: "red" },
  "V1b": { name: "Trecar", sector: "Valtournenche", difficulty: "red" },
  "V2": { name: "Campetto", sector: "Valtournenche", difficulty: "blue" },
  "V3": { name: "Crot", sector: "Valtournenche", difficulty: "blue" },
  "V4": { name: "Motta", sector: "Valtournenche", difficulty: "blue" },
  "V5": { name: "Manca", sector: "Valtournenche", difficulty: "red" },
  "V5bis": { name: "S. Canestrini", sector: "Valtournenche", difficulty: "red" },
  "V6": { name: "Canalino", sector: "Valtournenche", difficulty: "red" },
  "V7": { name: "Rientro 1", sector: "Valtournenche", difficulty: "red" },

  // ==========================================
  // ADDITIONAL CERVINIA PISTES
  // ==========================================
  "C8-R": { name: "Roisette", sector: "Cervinia", difficulty: "red" },
  "C8a": { name: "Becca d'Aran", sector: "Cervinia", difficulty: "red" },
  "C8b": { name: "Salette", sector: "Cervinia", difficulty: "blue" },
  "C9": { name: "Baracon", sector: "Cervinia", difficulty: "blue" },
  "C10-DC": { name: "Du Col", sector: "Cervinia", difficulty: "blue" },
  "C11-GS": { name: "Gran Sometta", sector: "Cervinia", difficulty: "blue" },
  "C12-GL": { name: "Gran Lago", sector: "Cervinia", difficulty: "red" },
  "C14-T": { name: "Tunnel", sector: "Cervinia", difficulty: "blue" },
  "C15": { name: "E. Noussan", sector: "Cervinia", difficulty: "red" },
  "C15a": { name: "Sigari", sector: "Cervinia", difficulty: "black" },
  "C16-GC": { name: "Gran Collet", sector: "Cervinia", difficulty: "red" },
  "C20": { name: "Skicross + Boardercross", sector: "Cervinia", difficulty: "red" },
};

// Export for use in processing
module.exports = { stations, pistes };

console.log(`Loaded ${Object.keys(stations).length} stations`);
console.log(`Loaded ${Object.keys(pistes).length} pistes`);
console.log('\nPistes by sector:');
const bySector = {};
for (const [id, piste] of Object.entries(pistes)) {
  bySector[piste.sector] = (bySector[piste.sector] || 0) + 1;
}
for (const [sector, count] of Object.entries(bySector).sort((a,b) => b[1] - a[1])) {
  console.log(`  ${sector}: ${count}`);
}
