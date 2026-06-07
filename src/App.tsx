const { useEffect, useMemo, useState } = React;

type MatchStatus = "scheduled" | "live" | "finished";
type EventType = "goal" | "yellow-card" | "red-card" | "substitution" | "var";
type TabKey = "schedule" | "favorites" | "results";

interface Team {
  id: string;
  name: string;
  shortName: string;
  flag: string;
  flagClass?: string;
  primaryColor: string;
}

interface Venue {
  id: string;
  name: string;
  city: string;
}

interface MatchEvent {
  id: string;
  minute: number;
  type: EventType;
  teamId?: string;
  player: string;
  description: string;
}

interface Match {
  id: string;
  stage: string;
  kickoff: string;
  venueId: string;
  homeTeamId: string;
  awayTeamId: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  events: MatchEvent[];
}

interface Prediction {
  id?: string;
  matchId: string;
  name: string;
  homeScore: number;
  awayScore: number;
  updatedAt: string;
  clientId?: string;
}

type SupabasePredictionRow = {
  id: string;
  match_id: string;
  name: string;
  home_score: number;
  away_score: number;
  client_id: string;
  created_at: string;
};

const SUPABASE_URL = "https://kxszledwzxhaasdjqntt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ipKEtGh_E58Cw50WphccpQ_jIDM6pwv";
const PREDICTIONS_ENDPOINT = `${SUPABASE_URL}/rest/v1/predictions`;
const SUPABASE_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

function createClientId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mapPredictionRow(row: SupabasePredictionRow): Prediction {
  return {
    id: row.id,
    matchId: row.match_id,
    name: row.name,
    homeScore: row.home_score,
    awayScore: row.away_score,
    updatedAt: row.created_at,
    clientId: row.client_id,
  };
}

async function fetchSharedPredictions(matchId: string) {
  const response = await fetch(`${PREDICTIONS_ENDPOINT}?match_id=eq.${encodeURIComponent(matchId)}&order=created_at.desc`, {
    headers: SUPABASE_HEADERS,
  });
  if (!response.ok) throw new Error("Could not load predictions");
  const rows = await response.json();
  return rows.map(mapPredictionRow);
}

async function saveSharedPrediction(prediction: Prediction, clientId: string) {
  const existingId = prediction.id;
  const body = {
    match_id: prediction.matchId,
    name: prediction.name,
    home_score: prediction.homeScore,
    away_score: prediction.awayScore,
    client_id: clientId,
  };

  const response = await fetch(existingId ? `${PREDICTIONS_ENDPOINT}?id=eq.${existingId}&client_id=eq.${clientId}` : PREDICTIONS_ENDPOINT, {
    method: existingId ? "PATCH" : "POST",
    headers: { ...SUPABASE_HEADERS, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Could not save prediction");
  const rows = await response.json();
  return mapPredictionRow(rows[0]);
}

async function deleteSharedPrediction(predictionId: string, clientId: string) {
  const response = await fetch(`${PREDICTIONS_ENDPOINT}?id=eq.${predictionId}&client_id=eq.${clientId}`, {
    method: "DELETE",
    headers: SUPABASE_HEADERS,
  });
  if (!response.ok) throw new Error("Could not delete prediction");
}

const teams: Team[] = [
  { id: "alg", name: "Algerije", shortName: "ALG", flag: "🇩🇿", primaryColor: "#15803d" },
  { id: "aus", name: "Australië", shortName: "AUS", flag: "🇦🇺", primaryColor: "#facc15" },
  { id: "aut", name: "Oostenrijk", shortName: "AUT", flag: "🇦🇹", primaryColor: "#dc2626" },
  { id: "bel", name: "België", shortName: "BEL", flag: "🇧🇪", primaryColor: "#111827" },
  { id: "bih", name: "Bosnië en Herzegovina", shortName: "BIH", flag: "🇧🇦", primaryColor: "#1d4ed8" },
  { id: "can", name: "Canada", shortName: "CAN", flag: "🇨🇦", primaryColor: "#dc2626" },
  { id: "cpv", name: "Kaapverdië", shortName: "CPV", flag: "🇨🇻", primaryColor: "#2563eb" },
  { id: "civ", name: "Ivoorkust", shortName: "CIV", flag: "🇨🇮", primaryColor: "#f97316" },
  { id: "col", name: "Colombia", shortName: "COL", flag: "🇨🇴", primaryColor: "#facc15" },
  { id: "cod", name: "Congo DR", shortName: "COD", flag: "🇨🇩", primaryColor: "#38bdf8" },
  { id: "cro", name: "Kroatië", shortName: "CRO", flag: "🇭🇷", primaryColor: "#2563eb" },
  { id: "cuw", name: "Curaçao", shortName: "CUW", flag: "🇨🇼", primaryColor: "#38bdf8" },
  { id: "cze", name: "Tsjechië", shortName: "CZE", flag: "🇨🇿", primaryColor: "#2563eb" },
  { id: "ecu", name: "Ecuador", shortName: "ECU", flag: "🇪🇨", primaryColor: "#eab308" },
  { id: "egy", name: "Egypte", shortName: "EGY", flag: "🇪🇬", primaryColor: "#dc2626" },
  { id: "eng", name: "Engeland", shortName: "ENG", flag: "ENG", flagClass: "code", primaryColor: "#e5e7eb" },
  { id: "ned", name: "Nederland", shortName: "NED", flag: "🇳🇱", primaryColor: "#f97316" },
  { id: "bra", name: "Brazilië", shortName: "BRA", flag: "🇧🇷", primaryColor: "#16a34a" },
  { id: "arg", name: "Argentinië", shortName: "ARG", flag: "🇦🇷", primaryColor: "#38bdf8" },
  { id: "jpn", name: "Japan", shortName: "JPN", flag: "🇯🇵", primaryColor: "#dc2626" },
  { id: "fra", name: "Frankrijk", shortName: "FRA", flag: "🇫🇷", primaryColor: "#2563eb" },
  { id: "gha", name: "Ghana", shortName: "GHA", flag: "🇬🇭", primaryColor: "#facc15" },
  { id: "ger", name: "Duitsland", shortName: "GER", flag: "🇩🇪", primaryColor: "#111827" },
  { id: "hai", name: "Haïti", shortName: "HAI", flag: "🇭🇹", primaryColor: "#1d4ed8" },
  { id: "irn", name: "Iran", shortName: "IRN", flag: "🇮🇷", primaryColor: "#15803d" },
  { id: "irq", name: "Irak", shortName: "IRQ", flag: "🇮🇶", primaryColor: "#dc2626" },
  { id: "jor", name: "Jordanië", shortName: "JOR", flag: "🇯🇴", primaryColor: "#15803d" },
  { id: "kor", name: "Korea Republic", shortName: "KOR", flag: "🇰🇷", primaryColor: "#2563eb" },
  { id: "mar", name: "Marokko", shortName: "MAR", flag: "🇲🇦", primaryColor: "#15803d" },
  { id: "mex", name: "Mexico", shortName: "MEX", flag: "🇲🇽", primaryColor: "#047857" },
  { id: "nzl", name: "Nieuw-Zeeland", shortName: "NZL", flag: "🇳🇿", primaryColor: "#111827" },
  { id: "nor", name: "Noorwegen", shortName: "NOR", flag: "🇳🇴", primaryColor: "#dc2626" },
  { id: "pan", name: "Panama", shortName: "PAN", flag: "🇵🇦", primaryColor: "#dc2626" },
  { id: "par", name: "Paraguay", shortName: "PAR", flag: "🇵🇾", primaryColor: "#2563eb" },
  { id: "por", name: "Portugal", shortName: "POR", flag: "🇵🇹", primaryColor: "#dc2626" },
  { id: "qat", name: "Qatar", shortName: "QAT", flag: "🇶🇦", primaryColor: "#7f1d1d" },
  { id: "ksa", name: "Saudi-Arabië", shortName: "KSA", flag: "🇸🇦", primaryColor: "#15803d" },
  { id: "sco", name: "Schotland", shortName: "SCO", flag: "SCO", flagClass: "code", primaryColor: "#1d4ed8" },
  { id: "sen", name: "Senegal", shortName: "SEN", flag: "🇸🇳", primaryColor: "#16a34a" },
  { id: "rsa", name: "Zuid-Afrika", shortName: "RSA", flag: "🇿🇦", primaryColor: "#16a34a" },
  { id: "esp", name: "Spanje", shortName: "ESP", flag: "🇪🇸", primaryColor: "#eab308" },
  { id: "sui", name: "Zwitserland", shortName: "SUI", flag: "🇨🇭", primaryColor: "#dc2626" },
  { id: "swe", name: "Zweden", shortName: "SWE", flag: "🇸🇪", primaryColor: "#eab308" },
  { id: "tun", name: "Tunesië", shortName: "TUN", flag: "🇹🇳", primaryColor: "#dc2626" },
  { id: "tur", name: "Turkije", shortName: "TUR", flag: "🇹🇷", primaryColor: "#dc2626" },
  { id: "uru", name: "Uruguay", shortName: "URU", flag: "🇺🇾", primaryColor: "#38bdf8" },
  { id: "usa", name: "Verenigde Staten", shortName: "USA", flag: "🇺🇸", primaryColor: "#1d4ed8" },
  { id: "uzb", name: "Oezbekistan", shortName: "UZB", flag: "🇺🇿", primaryColor: "#38bdf8" },
];

const venues: Venue[] = [
  { id: "atlanta", name: "Atlanta Stadium", city: "Atlanta" },
  { id: "boston", name: "Boston Stadium", city: "Boston" },
  { id: "dallas", name: "Dallas Stadium", city: "Dallas" },
  { id: "guadalajara", name: "Estadio Guadalajara", city: "Guadalajara" },
  { id: "houston", name: "Houston Stadium", city: "Houston" },
  { id: "kansas", name: "Kansas City Stadium", city: "Kansas City" },
  { id: "la", name: "Los Angeles Stadium", city: "Los Angeles" },
  { id: "mexico-city", name: "Mexico City Stadium", city: "Mexico-Stad" },
  { id: "miami", name: "Miami Stadium", city: "Miami" },
  { id: "monterrey", name: "Estadio Monterrey", city: "Monterrey" },
  { id: "ny-nj", name: "New York/New Jersey Stadium", city: "New York/New Jersey" },
  { id: "philadelphia", name: "Philadelphia Stadium", city: "Philadelphia" },
  { id: "sf-bay", name: "San Francisco Bay Area Stadium", city: "San Francisco Bay Area" },
  { id: "seattle", name: "Seattle Stadium", city: "Seattle" },
  { id: "toronto", name: "Toronto Stadium", city: "Toronto" },
  { id: "vancouver", name: "BC Place Vancouver", city: "Vancouver" },
];

const matches: Match[] = [
  { id: "m1", stage: "Groep A", kickoff: "2026-06-11T21:00:00+02:00", venueId: "mexico-city", homeTeamId: "mex", awayTeamId: "rsa", status: "scheduled", events: [] },
  { id: "m2", stage: "Groep A", kickoff: "2026-06-12T04:00:00+02:00", venueId: "guadalajara", homeTeamId: "kor", awayTeamId: "cze", status: "scheduled", events: [] },
  { id: "m3", stage: "Groep B", kickoff: "2026-06-12T21:00:00+02:00", venueId: "toronto", homeTeamId: "can", awayTeamId: "bih", status: "scheduled", events: [] },
  { id: "m4", stage: "Groep D", kickoff: "2026-06-13T03:00:00+02:00", venueId: "la", homeTeamId: "usa", awayTeamId: "par", status: "scheduled", events: [] },
  { id: "m5", stage: "Groep B", kickoff: "2026-06-13T21:00:00+02:00", venueId: "sf-bay", homeTeamId: "qat", awayTeamId: "sui", status: "scheduled", events: [] },
  { id: "m6", stage: "Groep C", kickoff: "2026-06-14T00:00:00+02:00", venueId: "boston", homeTeamId: "bra", awayTeamId: "mar", status: "scheduled", events: [] },
  { id: "m7", stage: "Groep C", kickoff: "2026-06-14T03:00:00+02:00", venueId: "ny-nj", homeTeamId: "hai", awayTeamId: "sco", status: "scheduled", events: [] },
  { id: "m8", stage: "Groep D", kickoff: "2026-06-14T06:00:00+02:00", venueId: "vancouver", homeTeamId: "aus", awayTeamId: "tur", status: "scheduled", events: [] },
  { id: "m9", stage: "Groep E", kickoff: "2026-06-14T19:00:00+02:00", venueId: "houston", homeTeamId: "ger", awayTeamId: "cuw", status: "scheduled", events: [] },
  { id: "m10", stage: "Groep F", kickoff: "2026-06-14T22:00:00+02:00", venueId: "dallas", homeTeamId: "ned", awayTeamId: "jpn", status: "scheduled", events: [] },
  { id: "m11", stage: "Groep E", kickoff: "2026-06-15T01:00:00+02:00", venueId: "philadelphia", homeTeamId: "civ", awayTeamId: "ecu", status: "scheduled", events: [] },
  { id: "m12", stage: "Groep F", kickoff: "2026-06-15T04:00:00+02:00", venueId: "monterrey", homeTeamId: "swe", awayTeamId: "tun", status: "scheduled", events: [] },
  { id: "m13", stage: "Groep H", kickoff: "2026-06-15T18:00:00+02:00", venueId: "atlanta", homeTeamId: "esp", awayTeamId: "cpv", status: "scheduled", events: [] },
  { id: "m14", stage: "Groep G", kickoff: "2026-06-15T21:00:00+02:00", venueId: "seattle", homeTeamId: "bel", awayTeamId: "egy", status: "scheduled", events: [] },
  { id: "m15", stage: "Groep H", kickoff: "2026-06-16T00:00:00+02:00", venueId: "miami", homeTeamId: "ksa", awayTeamId: "uru", status: "scheduled", events: [] },
  { id: "m16", stage: "Groep G", kickoff: "2026-06-16T03:00:00+02:00", venueId: "la", homeTeamId: "irn", awayTeamId: "nzl", status: "scheduled", events: [] },
  { id: "m17", stage: "Groep I", kickoff: "2026-06-16T21:00:00+02:00", venueId: "ny-nj", homeTeamId: "fra", awayTeamId: "sen", status: "scheduled", events: [] },
  { id: "m18", stage: "Groep I", kickoff: "2026-06-17T00:00:00+02:00", venueId: "boston", homeTeamId: "irq", awayTeamId: "nor", status: "scheduled", events: [] },
  { id: "m19", stage: "Groep J", kickoff: "2026-06-17T03:00:00+02:00", venueId: "kansas", homeTeamId: "arg", awayTeamId: "alg", status: "scheduled", events: [] },
  { id: "m20", stage: "Groep J", kickoff: "2026-06-17T06:00:00+02:00", venueId: "sf-bay", homeTeamId: "aut", awayTeamId: "jor", status: "scheduled", events: [] },
  { id: "m21", stage: "Groep K", kickoff: "2026-06-17T19:00:00+02:00", venueId: "houston", homeTeamId: "por", awayTeamId: "cod", status: "scheduled", events: [] },
  { id: "m22", stage: "Groep L", kickoff: "2026-06-17T22:00:00+02:00", venueId: "dallas", homeTeamId: "eng", awayTeamId: "cro", status: "scheduled", events: [] },
  { id: "m23", stage: "Groep L", kickoff: "2026-06-18T01:00:00+02:00", venueId: "toronto", homeTeamId: "gha", awayTeamId: "pan", status: "scheduled", events: [] },
  { id: "m24", stage: "Groep K", kickoff: "2026-06-18T04:00:00+02:00", venueId: "mexico-city", homeTeamId: "uzb", awayTeamId: "col", status: "scheduled", events: [] },
  { id: "m25", stage: "Groep A", kickoff: "2026-06-18T18:00:00+02:00", venueId: "atlanta", homeTeamId: "cze", awayTeamId: "rsa", status: "scheduled", events: [] },
  { id: "m26", stage: "Groep B", kickoff: "2026-06-18T21:00:00+02:00", venueId: "la", homeTeamId: "sui", awayTeamId: "bih", status: "scheduled", events: [] },
  { id: "m27", stage: "Groep B", kickoff: "2026-06-19T00:00:00+02:00", venueId: "vancouver", homeTeamId: "can", awayTeamId: "qat", status: "scheduled", events: [] },
  { id: "m28", stage: "Groep A", kickoff: "2026-06-20T03:00:00+02:00", venueId: "guadalajara", homeTeamId: "mex", awayTeamId: "kor", status: "scheduled", events: [] },
  { id: "m29", stage: "Groep D", kickoff: "2026-06-19T21:00:00+02:00", venueId: "seattle", homeTeamId: "usa", awayTeamId: "aus", status: "scheduled", events: [] },
  { id: "m30", stage: "Groep C", kickoff: "2026-06-20T00:00:00+02:00", venueId: "philadelphia", homeTeamId: "sco", awayTeamId: "mar", status: "scheduled", events: [] },
  { id: "m31", stage: "Groep C", kickoff: "2026-06-20T03:00:00+02:00", venueId: "boston", homeTeamId: "bra", awayTeamId: "hai", status: "scheduled", events: [] },
  { id: "m32", stage: "Groep D", kickoff: "2026-06-20T06:00:00+02:00", venueId: "sf-bay", homeTeamId: "tur", awayTeamId: "par", status: "scheduled", events: [] },
  { id: "m33", stage: "Groep F", kickoff: "2026-06-20T19:00:00+02:00", venueId: "houston", homeTeamId: "ned", awayTeamId: "swe", status: "scheduled", events: [] },
  { id: "m34", stage: "Groep E", kickoff: "2026-06-20T22:00:00+02:00", venueId: "toronto", homeTeamId: "ger", awayTeamId: "civ", status: "scheduled", events: [] },
  { id: "m35", stage: "Groep E", kickoff: "2026-06-21T02:00:00+02:00", venueId: "kansas", homeTeamId: "ecu", awayTeamId: "cuw", status: "scheduled", events: [] },
  { id: "m36", stage: "Groep F", kickoff: "2026-06-21T06:00:00+02:00", venueId: "monterrey", homeTeamId: "tun", awayTeamId: "jpn", status: "scheduled", events: [] },
  { id: "m37", stage: "Groep H", kickoff: "2026-06-21T18:00:00+02:00", venueId: "atlanta", homeTeamId: "esp", awayTeamId: "ksa", status: "scheduled", events: [] },
  { id: "m38", stage: "Groep G", kickoff: "2026-06-21T21:00:00+02:00", venueId: "la", homeTeamId: "bel", awayTeamId: "irn", status: "scheduled", events: [] },
  { id: "m39", stage: "Groep H", kickoff: "2026-06-22T00:00:00+02:00", venueId: "miami", homeTeamId: "uru", awayTeamId: "cpv", status: "scheduled", events: [] },
  { id: "m40", stage: "Groep G", kickoff: "2026-06-22T03:00:00+02:00", venueId: "vancouver", homeTeamId: "nzl", awayTeamId: "egy", status: "scheduled", events: [] },
  { id: "m41", stage: "Groep J", kickoff: "2026-06-22T19:00:00+02:00", venueId: "dallas", homeTeamId: "arg", awayTeamId: "aut", status: "scheduled", events: [] },
  { id: "m42", stage: "Groep I", kickoff: "2026-06-22T23:00:00+02:00", venueId: "philadelphia", homeTeamId: "fra", awayTeamId: "irq", status: "scheduled", events: [] },
  { id: "m43", stage: "Groep K", kickoff: "2026-06-23T19:00:00+02:00", venueId: "houston", homeTeamId: "por", awayTeamId: "uzb", status: "scheduled", events: [] },
  { id: "m44", stage: "Groep I", kickoff: "2026-06-23T02:00:00+02:00", venueId: "ny-nj", homeTeamId: "nor", awayTeamId: "sen", status: "scheduled", events: [] },
  { id: "m45", stage: "Groep J", kickoff: "2026-06-23T05:00:00+02:00", venueId: "sf-bay", homeTeamId: "jor", awayTeamId: "alg", status: "scheduled", events: [] },
  { id: "m46", stage: "Groep L", kickoff: "2026-06-23T22:00:00+02:00", venueId: "boston", homeTeamId: "eng", awayTeamId: "gha", status: "scheduled", events: [] },
  { id: "m47", stage: "Groep K", kickoff: "2026-06-24T04:00:00+02:00", venueId: "guadalajara", homeTeamId: "col", awayTeamId: "cod", status: "scheduled", events: [] },
  { id: "m48", stage: "Groep L", kickoff: "2026-06-24T01:00:00+02:00", venueId: "toronto", homeTeamId: "pan", awayTeamId: "cro", status: "scheduled", events: [] },
  { id: "m49", stage: "Groep B", kickoff: "2026-06-24T21:00:00+02:00", venueId: "vancouver", homeTeamId: "sui", awayTeamId: "can", status: "scheduled", events: [] },
  { id: "m50", stage: "Groep B", kickoff: "2026-06-24T21:00:00+02:00", venueId: "seattle", homeTeamId: "bih", awayTeamId: "qat", status: "scheduled", events: [] },
  { id: "m51", stage: "Groep C", kickoff: "2026-06-25T00:00:00+02:00", venueId: "miami", homeTeamId: "sco", awayTeamId: "bra", status: "scheduled", events: [] },
  { id: "m52", stage: "Groep C", kickoff: "2026-06-25T00:00:00+02:00", venueId: "atlanta", homeTeamId: "mar", awayTeamId: "hai", status: "scheduled", events: [] },
  { id: "m53", stage: "Groep A", kickoff: "2026-06-25T03:00:00+02:00", venueId: "mexico-city", homeTeamId: "cze", awayTeamId: "mex", status: "scheduled", events: [] },
  { id: "m54", stage: "Groep A", kickoff: "2026-06-25T03:00:00+02:00", venueId: "monterrey", homeTeamId: "rsa", awayTeamId: "kor", status: "scheduled", events: [] },
  { id: "m55", stage: "Groep E", kickoff: "2026-06-25T22:00:00+02:00", venueId: "philadelphia", homeTeamId: "cuw", awayTeamId: "civ", status: "scheduled", events: [] },
  { id: "m56", stage: "Groep E", kickoff: "2026-06-25T22:00:00+02:00", venueId: "ny-nj", homeTeamId: "ecu", awayTeamId: "ger", status: "scheduled", events: [] },
  { id: "m57", stage: "Groep F", kickoff: "2026-06-26T01:00:00+02:00", venueId: "dallas", homeTeamId: "jpn", awayTeamId: "swe", status: "scheduled", events: [] },
  { id: "m58", stage: "Groep F", kickoff: "2026-06-26T01:00:00+02:00", venueId: "kansas", homeTeamId: "tun", awayTeamId: "ned", status: "scheduled", events: [] },
  { id: "m59", stage: "Groep D", kickoff: "2026-06-26T04:00:00+02:00", venueId: "la", homeTeamId: "tur", awayTeamId: "usa", status: "scheduled", events: [] },
  { id: "m60", stage: "Groep D", kickoff: "2026-06-26T04:00:00+02:00", venueId: "sf-bay", homeTeamId: "par", awayTeamId: "aus", status: "scheduled", events: [] },
  { id: "m61", stage: "Groep I", kickoff: "2026-06-26T21:00:00+02:00", venueId: "boston", homeTeamId: "nor", awayTeamId: "fra", status: "scheduled", events: [] },
  { id: "m62", stage: "Groep I", kickoff: "2026-06-26T21:00:00+02:00", venueId: "toronto", homeTeamId: "sen", awayTeamId: "irq", status: "scheduled", events: [] },
  { id: "m63", stage: "Groep H", kickoff: "2026-06-27T02:00:00+02:00", venueId: "houston", homeTeamId: "cpv", awayTeamId: "ksa", status: "scheduled", events: [] },
  { id: "m64", stage: "Groep H", kickoff: "2026-06-27T02:00:00+02:00", venueId: "guadalajara", homeTeamId: "uru", awayTeamId: "esp", status: "scheduled", events: [] },
  { id: "m65", stage: "Groep G", kickoff: "2026-06-27T05:00:00+02:00", venueId: "seattle", homeTeamId: "egy", awayTeamId: "irn", status: "scheduled", events: [] },
  { id: "m66", stage: "Groep G", kickoff: "2026-06-27T05:00:00+02:00", venueId: "vancouver", homeTeamId: "nzl", awayTeamId: "bel", status: "scheduled", events: [] },
  { id: "m67", stage: "Groep L", kickoff: "2026-06-27T23:00:00+02:00", venueId: "ny-nj", homeTeamId: "pan", awayTeamId: "eng", status: "scheduled", events: [] },
  { id: "m68", stage: "Groep L", kickoff: "2026-06-27T23:00:00+02:00", venueId: "philadelphia", homeTeamId: "cro", awayTeamId: "gha", status: "scheduled", events: [] },
  { id: "m69", stage: "Groep K", kickoff: "2026-06-28T01:30:00+02:00", venueId: "miami", homeTeamId: "col", awayTeamId: "por", status: "scheduled", events: [] },
  { id: "m70", stage: "Groep K", kickoff: "2026-06-28T01:30:00+02:00", venueId: "atlanta", homeTeamId: "cod", awayTeamId: "uzb", status: "scheduled", events: [] },
  { id: "m71", stage: "Groep J", kickoff: "2026-06-28T04:00:00+02:00", venueId: "kansas", homeTeamId: "alg", awayTeamId: "aut", status: "scheduled", events: [] },
  { id: "m72", stage: "Groep J", kickoff: "2026-06-28T04:00:00+02:00", venueId: "dallas", homeTeamId: "jor", awayTeamId: "arg", status: "scheduled", events: [] },
];

const teamById = new Map(teams.map((team) => [team.id, team]));
const venueById = new Map(venues.map((venue) => [venue.id, venue]));

function useLocalStorageState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

function formatDayHeading(iso: string) {
  const label = new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getDateKey(iso: string) {
  return getDateKeyFromDate(new Date(iso));
}

function getDateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isBeforeToday(iso: string) {
  const matchDate = new Date(iso);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const matchDayStart = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
  return matchDayStart.getTime() < todayStart.getTime();
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function getMatchTeams(match: Match) {
  return {
    home: teamById.get(match.homeTeamId)!,
    away: teamById.get(match.awayTeamId)!,
  };
}

function getMatchVenue(match: Match) {
  return venueById.get(match.venueId)!;
}

function matchSearchesCountry(match: Match, query: string) {
  const search = query.trim().toLowerCase();
  if (!search) return true;
  const { home, away } = getMatchTeams(match);
  return [home, away].some((team) =>
    [team.name, team.shortName].some((value) => value.toLowerCase().includes(search))
  );
}

function statusLabel(status: MatchStatus) {
  if (status === "scheduled") return "Gepland";
  if (status === "live") return "LIVE";
  return "Afgelopen";
}

function eventIcon(type: EventType) {
  const icons: Record<EventType, string> = {
    goal: "⚽",
    "yellow-card": "🟨",
    "red-card": "🟥",
    substitution: "↔",
    var: "VAR",
  };
  return icons[type];
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("schedule");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [favoriteIds, setFavoriteIds] = useLocalStorageState<string[]>("wk:favorites", []);
  const [clientId] = useLocalStorageState<string>("wk:client-id", createClientId());
  const [predictionsByMatch, setPredictionsByMatch] = useLocalStorageState<Record<string, Prediction[]>>("wk:predictions", {});

  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()),
    []
  );
  const scheduleMatches = sortedMatches.filter((match) => !isBeforeToday(match.kickoff));

  const selectedMatch = selectedMatchId ? matches.find((match) => match.id === selectedMatchId) ?? null : null;
  const favoriteSet = new Set(favoriteIds);
  const filterBySearch = (match: Match) => matchSearchesCountry(match, searchQuery);
  const filteredScheduleMatches = scheduleMatches.filter(filterBySearch);
  const filteredFavoriteMatches = sortedMatches.filter((match) => favoriteSet.has(match.id) && filterBySearch(match));
  const filteredResultMatches = sortedMatches.filter(filterBySearch);

  useEffect(() => {
    if (!selectedMatchId) return;
    let isActive = true;

    fetchSharedPredictions(selectedMatchId)
      .then((sharedPredictions) => {
        if (!isActive) return;
        setPredictionsByMatch((current: Record<string, Prediction[]>) => ({
          ...current,
          [selectedMatchId]: sharedPredictions,
        }));
      })
      .catch(() => {
        if (!isActive) return;
        setPredictionsByMatch((current: Record<string, Prediction[]>) => ({
          ...current,
          [selectedMatchId]: current[selectedMatchId] ?? [],
        }));
      });

    return () => {
      isActive = false;
    };
  }, [selectedMatchId]);

  function toggleFavorite(matchId: string) {
    setFavoriteIds((current: string[]) =>
      current.includes(matchId) ? current.filter((id) => id !== matchId) : [...current, matchId]
    );
  }

  async function savePrediction(prediction: Prediction) {
    const localPrediction = { ...prediction, clientId, updatedAt: new Date().toISOString() };
    const savedPrediction = await saveSharedPrediction(localPrediction, clientId);
    setPredictionsByMatch((current: Record<string, Prediction[]>) => {
      const existing = current[prediction.matchId] ?? [];
      const withoutOwn = existing.filter((item) => item.clientId !== clientId);
      return { ...current, [prediction.matchId]: [savedPrediction, ...withoutOwn] };
    });
  }

  async function deletePrediction(matchId: string, prediction?: Prediction) {
    if (prediction?.id) await deleteSharedPrediction(prediction.id, clientId);
    setPredictionsByMatch((current: Record<string, Prediction[]>) => {
      const existing = current[matchId] ?? [];
      return { ...current, [matchId]: existing.filter((item) => item.clientId !== clientId) };
    });
  }

  return (
    <main className="app-shell">
      <Header
        liveCount={matches.filter((match) => match.status === "live").length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <section className="content">
        {activeTab === "schedule" && (
          <ScheduleView
            matches={filteredScheduleMatches}
            favoriteSet={favoriteSet}
            onToggleFavorite={toggleFavorite}
            onSelectMatch={setSelectedMatchId}
          />
        )}
        {activeTab === "favorites" && (
          <FavoritesView
            matches={filteredFavoriteMatches}
            favoriteSet={favoriteSet}
            onToggleFavorite={toggleFavorite}
            onSelectMatch={setSelectedMatchId}
          />
        )}
        {activeTab === "results" && (
          <ResultsView
            matches={filteredResultMatches}
            favoriteSet={favoriteSet}
            onToggleFavorite={toggleFavorite}
            onSelectMatch={setSelectedMatchId}
          />
        )}
      </section>

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />

      {selectedMatch && (
        <MatchDetail
          match={selectedMatch}
          isFavorite={favoriteSet.has(selectedMatch.id)}
          favoriteSet={favoriteSet}
          predictions={predictionsByMatch[selectedMatch.id] ?? []}
          clientId={clientId}
          onClose={() => setSelectedMatchId(null)}
          onToggleFavorite={() => toggleFavorite(selectedMatch.id)}
          onToggleMatchFavorite={toggleFavorite}
          onSavePrediction={savePrediction}
          onDeletePrediction={(prediction) => deletePrediction(selectedMatch.id, prediction)}
        />
      )}
    </main>
  );
}

function Header({
  liveCount,
  searchQuery,
  onSearchChange,
}: {
  liveCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <header className="topbar">
      <div className="app-mark" aria-label="WK 2026">WK 2026</div>
      <div className="topbar-actions">
        <label className="search-control" aria-label="Zoek op land">
          <span>⌕</span>
          <input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Zoek land"
          />
        </label>
        {liveCount > 0 && <span className="pill live-dot">{liveCount} live</span>}
      </div>
    </header>
  );
}

function ScheduleView(props: MatchListProps) {
  return (
    <>
      <SectionTitle title="Speelschema" />
      <MatchList {...props} />
    </>
  );
}

function FavoritesView(props: MatchListProps) {
  return (
    <>
      <SectionTitle title="Mijn wedstrijden" />
      {props.matches.length ? (
        <MatchList {...props} />
      ) : (
        <EmptyState
          title="Nog geen favorieten"
          text="Tik op de ster bij een wedstrijd om hem hier te bewaren."
          action="Ga naar Speelschema"
        />
      )}
    </>
  );
}

function ResultsView({ matches, ...rest }: MatchListProps) {
  const resultMatches = matches.filter(
    (match) => isBeforeToday(match.kickoff) || match.status === "live" || match.status === "finished"
  );

  return (
    <>
      <SectionTitle title="Uitslagen" />
      {resultMatches.length ? (
        <MatchList matches={resultMatches} {...rest} />
      ) : (
        <EmptyState
          title="Nog geen uitslagen"
          text="Het WK 2026 begint op 11 juni. Zodra wedstrijden live zijn of afgelopen, verschijnen ze hier."
        />
      )}
    </>
  );
}

interface MatchListProps {
  matches: Match[];
  favoriteSet: Set<string>;
  compact?: boolean;
  onToggleFavorite: (matchId: string) => void;
  onSelectMatch: (matchId: string) => void;
}

function MatchList({ matches, favoriteSet, compact, onToggleFavorite, onSelectMatch }: MatchListProps) {
  const groups = matches.reduce<{ key: string; label: string; matches: Match[] }[]>((days, match) => {
    const key = getDateKey(match.kickoff);
    const existing = days.find((day) => day.key === key);
    if (existing) {
      existing.matches.push(match);
      return days;
    }
    return [...days, { key, label: formatDayHeading(match.kickoff), matches: [match] }];
  }, []);

  return (
    <div className="match-list">
      {groups.map((group) => (
        <section className="match-day" data-day-key={group.key} key={group.key}>
          <h3>{group.label}</h3>
          <div className="match-day-list">
            {group.matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                compact={compact}
                isFavorite={favoriteSet.has(match.id)}
                onToggleFavorite={onToggleFavorite}
                onSelectMatch={onSelectMatch}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MatchCard({
  match,
  isFavorite,
  compact,
  onToggleFavorite,
  onSelectMatch,
}: {
  match: Match;
  isFavorite: boolean;
  compact?: boolean;
  onToggleFavorite: (matchId: string) => void;
  onSelectMatch: (matchId: string) => void;
}) {
  const { home, away } = getMatchTeams(match);
  const venue = getMatchVenue(match);
  const isDutchMatch = home.id === "ned" || away.id === "ned";
  const cardTone = isFavorite ? (isDutchMatch ? "dutch-favorite" : "favorite-match") : "";

  return (
    <article className={`match-card ${match.status} ${cardTone}`} onClick={() => onSelectMatch(match.id)}>
      <div className="match-meta">
        <span>{formatTime(match.kickoff)}</span>
        <small>{match.stage}</small>
      </div>
      <div className="match-main">
        <TeamLine team={home} />
        <ScoreBlock match={match} />
        <TeamLine team={away} align="right" />
      </div>
      {!compact && (
        <div className="match-footer">
          <span>{venue.name}</span>
          {match.status !== "scheduled" && <StatusBadge status={match.status} />}
        </div>
      )}
      <button
        className={`favorite-button ${isFavorite ? "active" : ""}`}
        aria-label={isFavorite ? "Verwijder favoriet" : "Markeer als favoriet"}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite(match.id);
        }}
      >
        {isFavorite ? "★" : "☆"}
      </button>
    </article>
  );
}

function TeamLine({ team, align = "left" }: { team: Team; align?: "left" | "right" }) {
  return (
    <div className={`team-line ${align}`}>
      <TeamFlag team={team} />
      <div>
        <strong>{team.name}</strong>
      </div>
    </div>
  );
}

function TeamFlag({ team }: { team: Team }) {
  return (
    <span className={`flag ${team.flagClass ? `flag-${team.flagClass}` : ""}`} aria-label={`Vlag ${team.name}`}>
      {team.flag}
    </span>
  );
}

function ScoreBlock({ match }: { match: Match }) {
  const hasScore = match.homeScore !== undefined && match.awayScore !== undefined;
  return (
    <div className={`score-block ${hasScore ? "has-score" : "empty"}`}>
      {hasScore ? (
        <>
          <strong>{match.homeScore}</strong>
          <span>-</span>
          <strong>{match.awayScore}</strong>
        </>
      ) : (
        <span className="versus">-</span>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: MatchStatus }) {
  return <span className={`status-badge ${status}`}>{statusLabel(status)}</span>;
}

function MatchDetail({
  match,
  isFavorite,
  favoriteSet,
  predictions,
  clientId,
  onClose,
  onToggleFavorite,
  onToggleMatchFavorite,
  onSavePrediction,
  onDeletePrediction,
}: {
  match: Match;
  isFavorite: boolean;
  favoriteSet: Set<string>;
  predictions: Prediction[];
  clientId: string;
  onClose: () => void;
  onToggleFavorite: () => void;
  onToggleMatchFavorite: (matchId: string) => void;
  onSavePrediction: (prediction: Prediction) => Promise<void> | void;
  onDeletePrediction: (prediction?: Prediction) => Promise<void> | void;
}) {
  const { home, away } = getMatchTeams(match);
  const venue = getMatchVenue(match);
  const predictionClosed = match.status !== "scheduled";

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true">
      <section className="detail-sheet">
        <section className="detail-match-card">
          <div className="detail-header">
            <button className="icon-button" onClick={onClose} aria-label="Terug">←</button>
            {match.status !== "scheduled" && <StatusBadge status={match.status} />}
            <button className={`icon-button star ${isFavorite ? "active" : ""}`} onClick={onToggleFavorite} aria-label="Favoriet">
              {isFavorite ? "★" : "☆"}
            </button>
          </div>

          <div className="match-meta detail-meta">
            <span>{formatTime(match.kickoff)}</span>
            <small>{formatDate(match.kickoff)} · {match.stage}</small>
          </div>

          <div className="detail-score">
            <TeamHero team={home} />
            <ScoreBlock match={match} />
            <TeamHero team={away} />
          </div>

          <p className="venue-line">{venue.name}</p>
        </section>

        <PredictionForm
          match={match}
          predictions={predictions}
          clientId={clientId}
          disabled={predictionClosed}
          onSavePrediction={onSavePrediction}
          onDeletePrediction={onDeletePrediction}
        />

        <GroupStandings match={match} />
        <GroupFixtures match={match} favoriteSet={favoriteSet} onToggleFavorite={onToggleMatchFavorite} />
      </section>
    </div>
  );
}

function TeamHero({ team }: { team: Team }) {
  return (
    <div
      className="team-hero"
      style={{ "--team-color": team.primaryColor } as React.CSSProperties}
    >
      <TeamFlag team={team} />
      <strong>{team.name}</strong>
    </div>
  );
}

function PredictionForm({
  match,
  predictions,
  clientId,
  disabled,
  onSavePrediction,
  onDeletePrediction,
}: {
  match: Match;
  predictions: Prediction[];
  clientId: string;
  disabled: boolean;
  onSavePrediction: (prediction: Prediction) => Promise<void> | void;
  onDeletePrediction: (prediction?: Prediction) => Promise<void> | void;
}) {
  const { home, away } = getMatchTeams(match);
  const ownPrediction = predictions.find((prediction) => prediction.clientId === clientId);
  const hasCurrentScore = match.homeScore !== undefined && match.awayScore !== undefined;
  const [name, setName] = useState(ownPrediction?.name ?? "");
  const [homeScore, setHomeScore] = useState(String(ownPrediction?.homeScore ?? ""));
  const [awayScore, setAwayScore] = useState(String(ownPrediction?.awayScore ?? ""));
  const [message, setMessage] = useState("");

  useEffect(() => {
    setName(ownPrediction?.name ?? "");
    setHomeScore(String(ownPrediction?.homeScore ?? ""));
    setAwayScore(String(ownPrediction?.awayScore ?? ""));
  }, [match.id, ownPrediction?.name, ownPrediction?.homeScore, ownPrediction?.awayScore]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (disabled) return;
    if (!name.trim() || homeScore === "" || awayScore === "") {
      setMessage("Vul je naam en beide scores in.");
      return;
    }
    try {
      await onSavePrediction({
        id: ownPrediction?.id,
        matchId: match.id,
        name: name.trim(),
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
        updatedAt: new Date().toISOString(),
        clientId,
      });
      setMessage("Voorspelling opgeslagen.");
    } catch {
      setMessage("Opslaan lukt nog niet. Controleer de Supabase tabel.");
    }
  }

  async function deleteSavedPrediction() {
    try {
      await onDeletePrediction(ownPrediction);
      setName("");
      setHomeScore("");
      setAwayScore("");
      setMessage("Voorspelling verwijderd.");
    } catch {
      setMessage("Verwijderen lukt nog niet. Controleer de Supabase rechten.");
    }
  }

  function matchesCurrentScore(prediction: Prediction) {
    return hasCurrentScore && prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore;
  }

  return (
    <section className="prediction-panel">
      <div className="panel-title">
        <h2>Voorspellingen</h2>
        {disabled && <span>Voorspellingen zijn gesloten.</span>}
      </div>
      <div className="prediction-list">
        {predictions.length ? (
          predictions.map((prediction) => (
            <div className="saved-prediction" key={prediction.id ?? prediction.clientId ?? `${prediction.name}-${prediction.updatedAt}`}>
              <span>{matchesCurrentScore(prediction) && <span className="prediction-trophy">🏆</span>}{prediction.name}</span>
              <div className="saved-prediction-score">
                <strong>{prediction.homeScore} - {prediction.awayScore}</strong>
                {prediction.clientId === clientId && (
                  <button type="button" onClick={deleteSavedPrediction} aria-label="Verwijder voorspelling">×</button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="prediction-empty">Nog geen voorspellingen.</p>
        )}
      </div>
      <form onSubmit={submit}>
        <label>
          Naam
          <input value={name} onChange={(event) => setName(event.target.value)} disabled={disabled} placeholder="Bijv. Denzel" />
        </label>
        <div className="score-inputs">
          <label>
            {home.shortName}
            <input min="0" max="20" type="number" value={homeScore} onChange={(event) => setHomeScore(event.target.value)} disabled={disabled} />
          </label>
          <label>
            {away.shortName}
            <input min="0" max="20" type="number" value={awayScore} onChange={(event) => setAwayScore(event.target.value)} disabled={disabled} />
          </label>
        </div>
        <button className="primary-button" type="submit" disabled={disabled}>{ownPrediction ? "Aanpassen" : "Opslaan"}</button>
      </form>
      {message && <p className="feedback">{message}</p>}
    </section>
  );
}

type StandingRow = {
  team: Team;
  order: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

function getGroupStandings(stage: string) {
  const groupMatches = matches.filter((match) => match.stage === stage);
  const teamOrder: string[] = [];

  groupMatches.forEach((match) => {
    [match.homeTeamId, match.awayTeamId].forEach((teamId) => {
      if (!teamOrder.includes(teamId)) teamOrder.push(teamId);
    });
  });

  const rows = new Map<string, StandingRow>();
  teamOrder.forEach((teamId, order) => {
    const team = teamById.get(teamId)!;
    rows.set(teamId, {
      team,
      order,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    });
  });

  groupMatches.forEach((match) => {
    if (match.status === "scheduled" || match.homeScore === undefined || match.awayScore === undefined) return;

    const home = rows.get(match.homeTeamId)!;
    const away = rows.get(match.awayTeamId)!;

    home.played += 1;
    away.played += 1;
    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (match.homeScore < match.awayScore) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  return [...rows.values()].sort((a, b) => {
    const goalDifferenceA = a.goalsFor - a.goalsAgainst;
    const goalDifferenceB = b.goalsFor - b.goalsAgainst;
    return (
      b.points - a.points ||
      goalDifferenceB - goalDifferenceA ||
      b.goalsFor - a.goalsFor ||
      a.order - b.order
    );
  });
}

function GroupStandings({ match }: { match: Match }) {
  const standings = getGroupStandings(match.stage);

  return (
    <section className="standings-panel">
      <div className="panel-title">
        <h2>Stand {match.stage}</h2>
      </div>
      <table className="standings-table">
        <thead>
          <tr>
            <th>Land</th>
            <th>W</th>
            <th>G</th>
            <th>V</th>
            <th>DS</th>
            <th>P</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => (
            <tr key={row.team.id}>
              <td>
                <TeamFlag team={row.team} />
                {row.team.name}
              </td>
              <td>{row.wins}</td>
              <td>{row.draws}</td>
              <td>{row.losses}</td>
              <td>{row.goalsFor - row.goalsAgainst}</td>
              <td>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function GroupFixtures({
  match,
  favoriteSet,
  onToggleFavorite,
}: {
  match: Match;
  favoriteSet: Set<string>;
  onToggleFavorite: (matchId: string) => void;
}) {
  const groupMatches = matches
    .filter((groupMatch) => groupMatch.stage === match.stage)
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

  return (
    <section className="group-fixtures-panel">
      <div className="panel-title">
        <h2>Wedstrijden {match.stage}</h2>
      </div>
      <div className="group-fixtures-list">
        {groupMatches.map((groupMatch) => {
          const { home, away } = getMatchTeams(groupMatch);
          const isFavorite = favoriteSet.has(groupMatch.id);
          return (
            <div className="group-fixture-row" key={groupMatch.id}>
              <div>
                <span>{formatDate(groupMatch.kickoff)}</span>
                <button
                  className={`group-favorite-button ${isFavorite ? "active" : ""}`}
                  type="button"
                  onClick={() => onToggleFavorite(groupMatch.id)}
                  aria-label={isFavorite ? "Verwijder favoriet" : "Markeer als favoriet"}
                >
                  {isFavorite ? "★" : "☆"}
                </button>
              </div>
              <strong>{formatTime(groupMatch.kickoff)} · {home.name} - {away.name}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
    </div>
  );
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">★</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <span>{action}</span>}
    </div>
  );
}

function BottomNav({ activeTab, onChange }: { activeTab: TabKey; onChange: (tab: TabKey) => void }) {
  const items: { key: TabKey; label: string; icon: string }[] = [
    { key: "schedule", label: "Speelschema", icon: "▦" },
    { key: "favorites", label: "Mijn wedstrijden", icon: "★" },
    { key: "results", label: "Uitslagen", icon: "✓" },
  ];

  return (
    <nav className="bottom-nav" aria-label="Primaire navigatie">
      {items.map((item) => (
        <button
          key={item.key}
          className={activeTab === item.key ? "active" : ""}
          onClick={() => onChange(item.key)}
          aria-label={item.label}
          title={item.label}
        >
          <span>{item.icon}</span>
        </button>
      ))}
    </nav>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
