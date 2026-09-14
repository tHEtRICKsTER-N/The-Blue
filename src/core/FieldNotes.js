export const FIELD_NOTES_KEY = 'abyss-field-notes-v1';

const dateOrNull = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const locationOrUnknown = value => typeof value === 'string' ? value.slice(0, 100) : 'Unknown location';
const safeDepth = value => Number.isFinite(value) ? Math.max(0, value) : 0;

function encountersFor(note) {
  const fallback = {at:note.firstSeen, location:note.location, depth:note.depth, diveId:'earlier'};
  const encounters = Array.isArray(note.encounters) && note.encounters.length ? note.encounters : [fallback];
  const seen = new Set();
  return encounters.slice(-30).filter(encounter => {
    if (!encounter || typeof encounter.diveId !== 'string' || !encounter.diveId || seen.has(encounter.diveId)) return false;
    seen.add(encounter.diveId); return true;
  }).map(encounter => ({at:dateOrNull(encounter.at), location:locationOrUnknown(encounter.location), depth:safeDepth(encounter.depth), diveId:encounter.diveId.slice(0, 100)}));
}

export function normalizeNotes(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.slice(0, 500).filter(note => {
    if (!note || typeof note.name !== 'string' || !note.name.trim() || note.name.length > 100 ||
        !['Species', 'Location', 'Habitat'].includes(note.kind) || seen.has(note.name)) return false;
    seen.add(note.name);
    return true;
  }).map(note => ({
    name: note.name, kind: note.kind,
    location: locationOrUnknown(note.location),
    depth: safeDepth(note.depth),
    firstSeen: dateOrNull(note.firstSeen),
    encounters: encountersFor(note),
  }));
}

export function loadNotes(storage) {
  try { const data = JSON.parse(storage.getItem(FIELD_NOTES_KEY)); return [1, 2].includes(data?.version) ? normalizeNotes(data.notes) : []; }
  catch { return []; }
}

export function saveNotes(storage, notes) {
  try { storage.setItem(FIELD_NOTES_KEY, JSON.stringify({version: 2, notes: normalizeNotes(notes)})); return true; }
  catch { return false; }
}

export function recordEncounter(notes, note, diveId) {
  const existing = notes.find(entry => entry.name === note.name);
  const encounter = {at:note.firstSeen, location:note.location, depth:note.depth, diveId};
  if (!existing) return [...notes, {...note, encounters:[encounter]}];
  if (existing.encounters?.some(entry => entry.diveId === diveId)) return notes;
  return notes.map(entry => entry === existing ? {...entry, encounters:[...encountersFor(entry), encounter].slice(-30)} : entry);
}
