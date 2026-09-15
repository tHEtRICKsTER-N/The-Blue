// Authored observations of ABYSS's world, rather than a scientific species database.
const species = {
  'Golden butterflyfish': ['Coral Garden', 'Golden schools weave around the first reef. Approach slowly and watch the group make room for you.'],
  'Blue chromis': ['Coral Garden', 'A blue school moves through the water beyond the entry reef. Pause beside it to see individual paths become a single flowing shape.'],
  'Reef anthias': ['Coral Garden', 'Look low over the reef for warm orange flashes. A quiet approach gives you more time beside the school.'],
  'Silver sardines': ['Emerald Kelp Forest', 'Silver bodies catch the light near the kelp. Watch the whole school turn before following it.'],
  'Moorish idols': ['Sunken Voyager approach', 'Pale, striped fish gather along the descent toward the wreck. Their school leaves space around nearby rocks.'],
  'Lanternfish': ['Twilight Depths', 'Small fish drift through the deeper water near the jellyfish garden. Let your eyes settle into the blue.'],
  'Pearly fusiliers': ['Open water', 'These roaming schools bring movement to the water between landmarks. Stay alongside them rather than swimming through their centre.'],
  'Banded wrasse': ['Open water', 'Watch for a yellow school as you explore beyond the entry reef. Its route shifts with the surrounding ocean.'],
  'Purple anthias': ['Open water', 'A purple school brightens the open stretches between dive sites. Small changes of direction travel through the group.'],
  'Lagoon damselfish': ['Open water', 'Green-tinted fish roam the wider ocean. Give the school room and watch it settle into its rhythm.'],
  'Green sea turtle': ['Coral Garden', 'A slow circuit brings these turtles back through the reef. Wait beside the route and watch the front flippers move.'],
  'Hawksbill sea turtle': ['Outer reefs', 'Look for an unhurried silhouette beyond the familiar reef. Follow at a distance to enjoy its long, gentle turns.'],
  'Giant manta ray': ['Coral Garden', 'Broad wings pass high above the reef. Looking up can reveal an encounter you would miss near the seabed.'],
  'Reef manta ray': ['Outer reefs', 'A wide, gliding silhouette moves through the outer ocean. Leave open water around its wings.'],
  'Blacktip reef shark': ['Sunken Voyager approach', 'A steady patrol circles the water near the wreck. Hold your position and watch the silhouette pass.'],
  'Moon jellyfish': ['Jellyfish Garden and kelp edge', 'Pulsing bells and long threads hang in the water. Try watching from below, then move gently around the group.'],
  'Bottlenose dolphin': ['Shallow open water', 'Wait quietly for a few seconds when a dolphin is nearby. It may circle closer; rushing toward it or crowding it makes it move away.'],
  'Blue whale': ['Deep open water', 'This large visitor appears only at intervals. A distant silhouette can be an encounter worth pausing for.'],
  'Common octopus': ['Rocky seabed', 'Look close to the bottom for a low body and moving arms. These small residents are easy to pass over.'],
  'Reef cuttlefish': ['Seagrass and seabed', 'A low, hovering shape moves just above the floor. Slow down and look beneath the larger schools.'],
  'Swimming crab': ['Seabed', 'Small legs trace a quiet route over the bottom. A close look reveals movement at a different scale.'],
  'Spotted moray eel': ['Rocky seabed', 'An elongated body ripples close to the floor. Look between the shapes of the rocks as you pass.'],
};

const places = {
  'Coral Garden': 'Your first reef: branching coral, small schools and slow-moving visitors. There is room to learn the water at your own pace.',
  'Emerald Kelp Forest': 'Tall stems break the light into narrow passages. Look between them for life at the edge of the reef.',
  'Sunken Voyager': 'An open wooden hull, exposed ribs and a cabin passage rest on the seabed. Explore around the wreck before moving inside.',
  'Crystal Grotto': 'Overlapping stone arches shelter a blue-lit chamber. Keep a clear route back through the entrance as you explore the glow.',
  'Jellyfish Garden': 'A gathering of luminous bells marks a deeper, quieter part of the ocean. Try looking upward through the group.',
  'Basalt Cathedral': 'Volcanic pillars and a broad stone arch give this site its tall silhouette. A reef manta ray circles through the opening. Wait beside the arch to watch its next pass.',
  'The Smoking Gardens': 'Mineral chimneys, rising plumes and pale colonies surround the vents. The crowns open wider after dark and withdraw under sustained direct light. Watch from beside your beam as they gradually return.',
  'Seagrass Nursery': 'A low meadow rewards close observation. A resident green sea turtle grazes between short swims. Wait nearby without crowding it; sustained direct light interrupts its feeding.',
  'Palm Cay Anchorage': 'A sheltered island coast and moored sailboat offer a place to surface. Take in the sky before returning to the water.',
  'Above the Blue': 'The waterline opens into sky. Weather, wind and daylight give this familiar crossing a different mood each time.',
  'Island Shore': 'Shallow water meets the island edge. Follow the coastline while keeping enough water beneath you.',
  'Coral Highlands': 'Coral appears across the raised seabed. Follow the contours and look for small schools above the reef.',
  'Anemone Meadows': 'Low anemones gather across the floor. Slow movement makes their gentle motion easier to notice.',
  'Sapphire Basin': 'Open seabed and blue water create longer sightlines. Watch for schools crossing between scattered formations.',
  'Sea Fan Gardens': 'Fans rise from the bottom in delicate branching shapes. Circle them to see their silhouettes against the water.',
  'Ribbon Kelp Forest': 'Kelp brings tall, swaying shapes to the outer seabed. Find a clear passage and look through the stems.',
  'Sponge Terraces': 'Sponges punctuate the seabed. Explore along the changes in height rather than rushing over them.',
};

export function fieldGuideEntry(note) {
  const entry = species[note.name];
  if (entry) return {habitat:entry[0], observation:entry[1]};
  return {habitat:note.location, observation:places[note.name] || 'An encounter from your own route through the ocean. Its place and depth are recorded below.'};
}

export function filterNotes(notes, category = 'All', query = '') {
  const needle = query.trim().toLocaleLowerCase();
  return notes.filter(note => (category === 'All' || note.kind === category) &&
    (!needle || [note.name, note.location, fieldGuideEntry(note).habitat].some(text => text.toLocaleLowerCase().includes(needle))));
}

export function diveHistory(notes) {
  const dives = new Map();
  for (const note of notes) for (const encounter of note.encounters || []) {
    const id = encounter.diveId || 'earlier';
    if (!dives.has(id)) dives.set(id, {id, at:encounter.at, entries:[]});
    const dive = dives.get(id);
    if (encounter.at && (!dive.at || encounter.at < dive.at)) dive.at = encounter.at;
    dive.entries.push({name:note.name, kind:note.kind, ...encounter});
  }
  return [...dives.values()].sort((a,b) => (b.at || '').localeCompare(a.at || ''));
}
