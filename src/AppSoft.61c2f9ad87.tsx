const { useEffect, useMemo, useState } = React;

type MatchStatus = "scheduled" | "live" | "finished";
type EventType = "goal" | "yellow-card" | "red-card" | "substitution" | "var";
type TabKey = "schedule" | "favorites" | "results" | "leaderboard";
type MatchOutcome = "home" | "away" | "draw";
type PredictionResult = "pending" | "exact" | "winner" | "draw" | "wrong";

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
  providerMatchId?: string;
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
  createdAt?: string;
  updatedAt: string;
  clientId?: string;
}

interface EvaluatedPrediction {
  prediction: Prediction;
  match: Match;
  result: PredictionResult;
  points: number;
}

interface LeaderboardRow {
  key: string;
  name: string;
  predictionsCount: number;
  exactCount: number;
  outcomeCount: number;
  points: number;
  order: number;
}

type DemoMode = "scores" | null;

type FootballDataMatch = {
  id: string;
  providerMatchId?: string;
  stage?: string;
  status: MatchStatus;
  kickoff?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeScore?: number;
  awayScore?: number;
};

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
const FOOTBALL_DATA_ENDPOINT = `${SUPABASE_URL}/functions/v1/football-data`;
const ADMIN_CODE = "wk2022";
const APP_VERSION = "2026.06.13.2";
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
    createdAt: row.created_at,
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

async function fetchAllSharedPredictions() {
  const response = await fetch(`${PREDICTIONS_ENDPOINT}?select=*&order=created_at.desc`, {
    headers: SUPABASE_HEADERS,
  });
  if (!response.ok) throw new Error("Could not load all predictions");
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

async function deleteSharedPrediction(predictionId: string, clientId: string, admin = false) {
  const clientFilter = admin ? "" : `&client_id=eq.${clientId}`;
  const response = await fetch(`${PREDICTIONS_ENDPOINT}?id=eq.${predictionId}${clientFilter}`, {
    method: "DELETE",
    headers: SUPABASE_HEADERS,
  });
  if (!response.ok) throw new Error("Could not delete prediction");
}

async function deleteSharedPredictionsForMatch(matchId: string) {
  const response = await fetch(`${PREDICTIONS_ENDPOINT}?match_id=eq.${encodeURIComponent(matchId)}`, {
    method: "DELETE",
    headers: SUPABASE_HEADERS,
  });
  if (!response.ok) throw new Error("Could not delete predictions");
}

async function renameSharedPredictionsForClient(clientId: string, name: string) {
  const response = await fetch(`${PREDICTIONS_ENDPOINT}?client_id=eq.${clientId}`, {
    method: "PATCH",
    headers: { ...SUPABASE_HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error("Could not rename predictions");
  const rows = await response.json();
  return rows.map(mapPredictionRow);
}

async function fetchFootballDataMatches() {
  const response = await fetch(`${FOOTBALL_DATA_ENDPOINT}?resource=matches`, {
    cache: "no-store",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!response.ok) throw new Error("Could not load football-data.org matches");
  const data = await response.json();
  return (data.matches ?? []) as FootballDataMatch[];
}

const teams: Team[] = [
  { id: "alg", name: "Algerije", shortName: "ALG", flag: "🇩🇿", primaryColor: "#15803d" },
  { id: "aus", name: "Australië", shortName: "AUS", flag: "🇦🇺", primaryColor: "#facc15" },
  { id: "aut", name: "Oostenrijk", shortName: "AUT", flag: "🇦🇹", primaryColor: "#dc2626" },
  { id: "bel", name: "België", shortName: "BEL", flag: "🇧🇪", primaryColor: "#111827" },
  { id: "bih", name: "Bosnië H", shortName: "BIH", flag: "🇧🇦", primaryColor: "#1d4ed8" },
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
  { id: "eng", name: "Engeland", shortName: "ENG", flag: "", flagClass: "england", primaryColor: "#e5e7eb" },
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
  { id: "sco", name: "Schotland", shortName: "SCO", flag: "", flagClass: "scotland", primaryColor: "#1d4ed8" },
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

function getDemoMode(): DemoMode {
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") === "scores" ? "scores" : null;
}

function createDemoMatches(baseMatches: Match[]) {
  const demoScores: Record<string, Pick<Match, "status" | "homeScore" | "awayScore" | "events">> = {
    m1: {
      status: "finished",
      homeScore: 2,
      awayScore: 1,
      events: [
        { id: "demo-m1-1", minute: 18, type: "goal", teamId: "mex", player: "Gimenez", description: "Doelpunt Mexico" },
        { id: "demo-m1-2", minute: 51, type: "goal", teamId: "rsa", player: "Mokoena", description: "Doelpunt Zuid-Afrika" },
        { id: "demo-m1-3", minute: 77, type: "goal", teamId: "mex", player: "Lozano", description: "Doelpunt Mexico" },
      ],
    },
    m2: {
      status: "finished",
      homeScore: 0,
      awayScore: 0,
      events: [
        { id: "demo-m2-1", minute: 62, type: "yellow-card", teamId: "cze", player: "Soucek", description: "Gele kaart" },
      ],
    },
    m3: {
      status: "live",
      homeScore: 1,
      awayScore: 0,
      events: [
        { id: "demo-m3-1", minute: 32, type: "goal", teamId: "can", player: "David", description: "Doelpunt Canada" },
        { id: "demo-m3-2", minute: 58, type: "var", player: "VAR", description: "Doelpuntcontrole" },
      ],
    },
  };

  return baseMatches.map((match) => (demoScores[match.id] ? { ...match, ...demoScores[match.id] } : match));
}

function normalizeMatchName(value?: string) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getTeamAliases(team: Team) {
  const aliases: Record<string, string[]> = {
    alg: ["algeria"],
    aus: ["australia"],
    aut: ["austria"],
    bel: ["belgium"],
    bih: ["bosniaandherzegovina", "bosniaherzegovina"],
    bra: ["brazil"],
    civ: ["cotedivoire", "cotedivoire", "ivorycoast", "coteivoire"],
    cod: ["congodr", "drcongo", "congodemocraticrepublic", "democraticrepublicofcongo"],
    cpv: ["capeverde", "caboverde", "cabo verde", "kaapverdie"],
    cro: ["croatia"],
    cuw: ["curacao", "curaçao"],
    cze: ["czechia", "czechrepublic", "tsjechie"],
    egy: ["egypt"],
    eng: ["england", "engeland"],
    esp: ["spain"],
    fra: ["france"],
    ger: ["germany", "duitsland"],
    hai: ["haiti", "haiti"],
    irn: ["iran", "iriran", "ir iran"],
    irq: ["iraq"],
    jor: ["jordan"],
    kor: ["korearepublic", "southkorea", "republicofkorea"],
    mar: ["morocco"],
    ned: ["netherlands", "thenetherlands", "holland", "nederland"],
    nzl: ["newzealand", "nieuwzeeland"],
    nor: ["norway"],
    rsa: ["southafrica", "zuidafrika"],
    sco: ["scotland", "schotland"],
    ksa: ["saudiarabia", "saudi arabia"],
    sui: ["switzerland", "zwitserland"],
    swe: ["sweden"],
    tun: ["tunisia"],
    tur: ["turkiye", "turkey", "turkije"],
    usa: ["unitedstates", "unitedstatesofamerica", "usa", "verenigdestaten"],
    uzb: ["uzbekistan"],
  };
  return [team.name, team.shortName, ...(aliases[team.id] ?? [])].map(normalizeMatchName);
}

const teamAliasEntries = teams.flatMap((team) => getTeamAliases(team).map((alias) => ({ alias, teamId: team.id })));

function findTeamIdByProviderName(name?: string) {
  const normalized = normalizeMatchName(name);
  if (!normalized) return null;
  const exact = teamAliasEntries.find((entry) => entry.alias === normalized);
  if (exact) return exact.teamId;
  const partial = teamAliasEntries.find((entry) => normalized.includes(entry.alias) || entry.alias.includes(normalized));
  return partial?.teamId ?? null;
}

function createProviderTeamId(name?: string, fallback = "team") {
  const existingTeamId = findTeamIdByProviderName(name);
  if (existingTeamId) return existingTeamId;
  const normalized = normalizeMatchName(name);
  return normalized ? `api-${normalized}` : `api-${fallback}`;
}

function createFallbackTeam(teamId: string): Team {
  return {
    id: teamId,
    name: "Onbekend",
    shortName: "TBD",
    flag: "–",
    flagClass: "code",
    primaryColor: "#9ca3af",
  };
}

function formatProviderStage(stage?: string) {
  const normalized = normalizeProviderStage(stage);
  const labels: Record<string, string> = {
    last32: "Zestiende finales",
    last16: "Achtste finales",
    quarterfinals: "Kwartfinales",
    semifinal: "Halve finales",
    semifinals: "Halve finales",
    thirdplace: "Troostfinale",
    thirdplaceplayoff: "Troostfinale",
    final: "Finale",
  };
  return labels[normalized] ?? stage ?? "WK 2026";
}

function getProviderMatchKey(match: FootballDataMatch) {
  const homeTeamId = findTeamIdByProviderName(match.homeTeamName);
  const awayTeamId = findTeamIdByProviderName(match.awayTeamName);
  if (!homeTeamId || !awayTeamId || !match.kickoff) return null;
  return `${getDateKey(match.kickoff)}:${homeTeamId}:${awayTeamId}`;
}

function normalizeProviderStage(stage?: string) {
  return (stage ?? "").toLowerCase().replace("groep", "group").replace(/[^a-z0-9]/g, "");
}

function getProviderTeamPairKey(match: FootballDataMatch) {
  const homeTeamId = findTeamIdByProviderName(match.homeTeamName);
  const awayTeamId = findTeamIdByProviderName(match.awayTeamName);
  if (!homeTeamId || !awayTeamId) return null;
  return `${normalizeProviderStage(match.stage)}:${homeTeamId}:${awayTeamId}`;
}

function getLocalTeamPairKey(match: Match) {
  return `${normalizeProviderStage(match.stage)}:${match.homeTeamId}:${match.awayTeamId}`;
}

function mergeFootballDataMatches(baseMatches: Match[], providerMatches: FootballDataMatch[]) {
  if (!providerMatches.length) return baseMatches;
  const byKey = new Map<string, FootballDataMatch>();
  const byTeamPair = new Map<string, FootballDataMatch>();
  providerMatches.forEach((providerMatch) => {
    const key = getProviderMatchKey(providerMatch);
    if (key) byKey.set(key, providerMatch);
    const teamPairKey = getProviderTeamPairKey(providerMatch);
    if (teamPairKey) byTeamPair.set(teamPairKey, providerMatch);
  });

  const matchedProviderIds = new Set<string>();
  const mergedMatches = baseMatches.map((match) => {
    const key = `${getDateKey(match.kickoff)}:${match.homeTeamId}:${match.awayTeamId}`;
    const reversedKey = `${getDateKey(match.kickoff)}:${match.awayTeamId}:${match.homeTeamId}`;
    const teamPairKey = getLocalTeamPairKey(match);
    const reversedTeamPairKey = `${normalizeProviderStage(match.stage)}:${match.awayTeamId}:${match.homeTeamId}`;
    const providerMatch = byKey.get(key) ?? byKey.get(reversedKey) ?? byTeamPair.get(teamPairKey) ?? byTeamPair.get(reversedTeamPairKey);
    if (!providerMatch) return match;
    const isReversed = (byKey.has(reversedKey) && !byKey.has(key)) || (byTeamPair.has(reversedTeamPairKey) && !byTeamPair.has(teamPairKey));
    if (providerMatch.providerMatchId) matchedProviderIds.add(providerMatch.providerMatchId);

    return {
      ...match,
      providerMatchId: providerMatch.providerMatchId,
      kickoff: providerMatch.kickoff ?? match.kickoff,
      status: providerMatch.status,
      homeScore: isReversed ? providerMatch.awayScore : providerMatch.homeScore,
      awayScore: isReversed ? providerMatch.homeScore : providerMatch.awayScore,
    };
  });

  const providerOnlyMatches = providerMatches
    .filter((providerMatch) => providerMatch.providerMatchId && !matchedProviderIds.has(providerMatch.providerMatchId))
    .filter((providerMatch) => providerMatch.kickoff)
    .map((providerMatch) => ({
      id: `fd-${providerMatch.providerMatchId}`,
      providerMatchId: providerMatch.providerMatchId,
      stage: formatProviderStage(providerMatch.stage),
      kickoff: providerMatch.kickoff!,
      venueId: "api-venue",
      homeTeamId: createProviderTeamId(providerMatch.homeTeamName, `${providerMatch.providerMatchId}-home`),
      awayTeamId: createProviderTeamId(providerMatch.awayTeamName, `${providerMatch.providerMatchId}-away`),
      status: providerMatch.status,
      homeScore: providerMatch.homeScore,
      awayScore: providerMatch.awayScore,
      events: [],
    }));

  return [...mergedMatches, ...providerOnlyMatches];
}

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

function isPlayedMatch(match: Match) {
  return match.status === "finished" || isBeforeToday(match.kickoff);
}

function hasMatchStarted(match: Match, now = new Date()) {
  return new Date(match.kickoff).getTime() <= now.getTime();
}

function getEffectiveMatchStatus(match: Match, now = new Date()): MatchStatus {
  if (match.status === "finished") return "finished";
  if (match.status === "live") return "live";
  return hasMatchStarted(match, now) ? "live" : "scheduled";
}

function applyEffectiveMatchStatuses(matchList: Match[], now: Date) {
  return matchList.map((match) => {
    const status = getEffectiveMatchStatus(match, now);
    return status === match.status ? match : { ...match, status };
  });
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function getMatchTeams(match: Match) {
  return {
    home: teamById.get(match.homeTeamId) ?? createFallbackTeam(match.homeTeamId),
    away: teamById.get(match.awayTeamId) ?? createFallbackTeam(match.awayTeamId),
  };
}

function getMatchVenue(match: Match) {
  return venueById.get(match.venueId) ?? { id: match.venueId, name: "Locatie volgt", city: "" };
}

function hasDutchTeam(match: Match) {
  return match.homeTeamId === "ned" || match.awayTeamId === "ned";
}

function matchSearchesCountry(match: Match, query: string) {
  const search = query.trim().toLowerCase();
  if (!search) return true;
  const { home, away } = getMatchTeams(match);
  return [home, away].some((team) =>
    [team.name, team.shortName].some((value) => value.toLowerCase().includes(search))
  );
}

function normalizePlayerName(name: string) {
  return name.trim().toLowerCase();
}

function isValidPrediction(prediction: Prediction) {
  return (
    Boolean(prediction.matchId) &&
    Boolean(prediction.name.trim()) &&
    Number.isFinite(prediction.homeScore) &&
    Number.isFinite(prediction.awayScore) &&
    prediction.homeScore >= 0 &&
    prediction.awayScore >= 0
  );
}

function getPredictionTime(prediction: Prediction) {
  return new Date(prediction.updatedAt || prediction.createdAt || "").getTime() || 0;
}

function getLatestPredictions(predictions: Prediction[]) {
  const latest = new Map<string, Prediction>();

  predictions.filter(isValidPrediction).forEach((prediction) => {
    const key = `${normalizePlayerName(prediction.name)}:${prediction.matchId}`;
    const existing = latest.get(key);
    if (!existing || getPredictionTime(prediction) >= getPredictionTime(existing)) {
      latest.set(key, prediction);
    }
  });

  return [...latest.values()];
}

function getMatchOutcome(homeScore: number, awayScore: number): MatchOutcome {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

function evaluatePrediction(prediction: Prediction, match: Match): { result: PredictionResult; points: number } {
  if (match.status !== "finished" || match.homeScore === undefined || match.awayScore === undefined) {
    return { result: "pending", points: 0 };
  }

  if (prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore) {
    return { result: "exact", points: 3 };
  }

  const predictedOutcome = getMatchOutcome(prediction.homeScore, prediction.awayScore);
  const actualOutcome = getMatchOutcome(match.homeScore, match.awayScore);
  if (predictedOutcome !== actualOutcome) return { result: "wrong", points: 0 };

  return { result: actualOutcome === "draw" ? "draw" : "winner", points: 1 };
}

function buildLeaderboard(predictions: Prediction[], allMatches: Match[]) {
  const matchById = new Map(allMatches.map((match) => [match.id, match]));
  const rows = new Map<string, LeaderboardRow>();

  getLatestPredictions(predictions).forEach((prediction) => {
    const match = matchById.get(prediction.matchId);
    if (!match) return;

    const key = normalizePlayerName(prediction.name);
    const existing = rows.get(key);
    const evaluation = evaluatePrediction(prediction, match);
    const row =
      existing ??
      {
        key,
        name: prediction.name.trim(),
        predictionsCount: 0,
        exactCount: 0,
        outcomeCount: 0,
        points: 0,
        order: rows.size,
      };

    row.predictionsCount += 1;
    if (evaluation.result === "exact") row.exactCount += 1;
    if (evaluation.result === "winner" || evaluation.result === "draw") row.outcomeCount += 1;
    row.points += evaluation.points;
    rows.set(key, row);
  });

  return [...rows.values()].sort((a, b) => (
    b.points - a.points ||
    b.exactCount - a.exactCount ||
    b.outcomeCount - a.outcomeCount ||
    b.predictionsCount - a.predictionsCount ||
    a.order - b.order
  ));
}

function getPredictionsForPlayer(name: string, predictions: Prediction[], allMatches: Match[]): EvaluatedPrediction[] {
  const playerKey = normalizePlayerName(name);
  const matchById = new Map(allMatches.map((match) => [match.id, match]));

  return getLatestPredictions(predictions)
    .filter((prediction) => normalizePlayerName(prediction.name) === playerKey)
    .map((prediction) => {
      const match = matchById.get(prediction.matchId);
      if (!match) return null;
      const evaluation = evaluatePrediction(prediction, match);
      return { prediction, match, ...evaluation };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a!.match.kickoff).getTime() - new Date(b!.match.kickoff).getTime()) as EvaluatedPrediction[];
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

function isNewerVersion(remoteVersion: string, currentVersion: string) {
  const remoteParts = remoteVersion.split(".").map((part) => Number(part));
  const currentParts = currentVersion.split(".").map((part) => Number(part));
  const length = Math.max(remoteParts.length, currentParts.length);

  for (let index = 0; index < length; index += 1) {
    const remote = Number.isFinite(remoteParts[index]) ? remoteParts[index] : 0;
    const current = Number.isFinite(currentParts[index]) ? currentParts[index] : 0;
    if (remote > current) return true;
    if (remote < current) return false;
  }

  return remoteVersion !== currentVersion;
}

function App() {
  const demoMode = getDemoMode();
  const [footballDataMatches, setFootballDataMatches] = useState<FootballDataMatch[]>([]);
  const [now, setNow] = useState(() => new Date());
  const appMatches = useMemo(() => {
    const baseMatches = demoMode === "scores" ? createDemoMatches(matches) : matches;
    const sourceMatches = demoMode === "scores" ? baseMatches : mergeFootballDataMatches(baseMatches, footballDataMatches);
    return applyEffectiveMatchStatuses(sourceMatches, now);
  }, [demoMode, footballDataMatches, now]);
  const [activeTab, setActiveTab] = useState<TabKey>("schedule");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [favoriteIds, setFavoriteIds] = useLocalStorageState<string[]>("wk:favorites", []);
  const [clientId] = useLocalStorageState<string>("wk:client-id", createClientId());
  const [playerName, setPlayerName] = useLocalStorageState<string>("wk:player-name", "");
  const [predictionsByMatch, setPredictionsByMatch] = useLocalStorageState<Record<string, Prediction[]>>("wk:predictions", {});
  const [adminUnlocked, setAdminUnlocked] = useLocalStorageState<boolean>("wk:admin", false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [serviceWorkerRegistration, setServiceWorkerRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const sortedMatches = useMemo(
    () => [...appMatches].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()),
    [appMatches]
  );
  const scheduleMatches = sortedMatches.filter((match) => match.status !== "finished");

  const selectedMatch = selectedMatchId ? appMatches.find((match) => match.id === selectedMatchId) ?? null : null;
  const favoriteSet = new Set(favoriteIds);
  const filterBySearch = (match: Match) => matchSearchesCountry(match, searchQuery);
  const filteredScheduleMatches = scheduleMatches.filter(filterBySearch);
  const filteredFavoriteMatches = sortedMatches.filter((match) => favoriteSet.has(match.id));
  const filteredResultMatches = sortedMatches;
  const allPredictions = useMemo(() => Object.values(predictionsByMatch).flat(), [predictionsByMatch]);
  const leaderboard = useMemo(() => buildLeaderboard(allPredictions, appMatches), [allPredictions, appMatches]);
  const ownPlayerKeys = useMemo(
    () => new Set(getLatestPredictions(allPredictions).filter((prediction) => prediction.clientId === clientId).map((prediction) => normalizePlayerName(prediction.name))),
    [allPredictions, clientId]
  );
  const selectedPlayerPredictions = selectedPlayerName
    ? getPredictionsForPlayer(selectedPlayerName, allPredictions, appMatches)
    : [];

  useEffect(() => {
    if (playerName.trim()) return;
    const latestOwnPrediction = getLatestPredictions(allPredictions)
      .filter((prediction) => prediction.clientId === clientId && prediction.name.trim())
      .sort((a, b) => getPredictionTime(b) - getPredictionTime(a))[0];
    if (latestOwnPrediction) setPlayerName(latestOwnPrediction.name.trim());
  }, [allPredictions, clientId, playerName, setPlayerName]);

  useEffect(() => {
    if (!selectedMatch && !selectedPlayerName) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedMatch, selectedPlayerName]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  async function loadFootballDataMatches() {
    const providerMatches = await fetchFootballDataMatches();
    setFootballDataMatches(providerMatches);
  }

  useEffect(() => {
    if (demoMode === "scores") return;

    loadFootballDataMatches().catch(() => {
      // Mock data remains the fallback when the free API is unavailable or not configured yet.
    });

    function refreshFootballDataWhenVisible() {
      if (document.visibilityState === "visible") loadFootballDataMatches().catch(() => undefined);
    }

    const intervalId = window.setInterval(() => {
      loadFootballDataMatches().catch(() => undefined);
    }, 90000);
    document.addEventListener("visibilitychange", refreshFootballDataWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshFootballDataWhenVisible);
    };
  }, [demoMode]);

  async function loadAllPredictions() {
    const sharedPredictions = await fetchAllSharedPredictions();
    const grouped = sharedPredictions.reduce<Record<string, Prediction[]>>((groups, prediction) => {
      groups[prediction.matchId] = [...(groups[prediction.matchId] ?? []), prediction];
      return groups;
    }, {});
    setPredictionsByMatch(grouped);
  }

  useEffect(() => {
    let isActive = true;

    fetchAllSharedPredictions()
      .then((sharedPredictions) => {
        if (!isActive) return;
        const grouped = sharedPredictions.reduce<Record<string, Prediction[]>>((groups, prediction) => {
          groups[prediction.matchId] = [...(groups[prediction.matchId] ?? []), prediction];
          return groups;
        }, {});
        setPredictionsByMatch(grouped);
      })
      .catch(() => {
        // LocalStorage remains available when the shared backend cannot be reached.
      });

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") loadAllPredictions().catch(() => undefined);
    }

    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      isActive = false;
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

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

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let isActive = true;

    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        if (!isActive) return;
        setServiceWorkerRegistration(registration);
        registration.update();

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch(() => {
        // The app still works without a service worker.
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function checkForUpdate() {
      try {
        const response = await fetch(`./version.json?ts=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (isActive && data.version && isNewerVersion(data.version, APP_VERSION)) setUpdateAvailable(true);
      } catch {
        // Update checks should never interrupt app usage.
      }
    }

    function checkWhenVisible() {
      if (document.visibilityState === "visible") checkForUpdate();
    }

    checkForUpdate();
    const intervalId = window.setInterval(checkForUpdate, 60000);
    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, []);

  function toggleFavorite(matchId: string) {
    setFavoriteIds((current: string[]) =>
      current.includes(matchId) ? current.filter((id) => id !== matchId) : [...current, matchId]
    );
  }

  async function savePrediction(prediction: Prediction) {
    const trimmedName = prediction.name.trim();
    if (trimmedName) setPlayerName(trimmedName);
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

  async function deletePredictionAsAdmin(matchId: string, prediction: Prediction) {
    if (prediction.id) await deleteSharedPrediction(prediction.id, clientId, true);
    setPredictionsByMatch((current: Record<string, Prediction[]>) => {
      const existing = current[matchId] ?? [];
      return { ...current, [matchId]: existing.filter((item) => item.id !== prediction.id) };
    });
  }

  async function deleteAllPredictionsAsAdmin(matchId: string) {
    await deleteSharedPredictionsForMatch(matchId);
    setPredictionsByMatch((current: Record<string, Prediction[]>) => ({ ...current, [matchId]: [] }));
  }

  async function renameOwnPredictions(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Name is required");
    await renameSharedPredictionsForClient(clientId, trimmedName);
    setPredictionsByMatch((current: Record<string, Prediction[]>) =>
      Object.fromEntries(
        Object.entries(current).map(([matchId, predictionList]) => [
          matchId,
          predictionList.map((prediction) =>
            prediction.clientId === clientId ? { ...prediction, name: trimmedName, updatedAt: new Date().toISOString() } : prediction
          ),
        ])
      )
    );
    setPlayerName(trimmedName);
    setSelectedPlayerName(trimmedName);
  }

  function loginAdmin(code: string) {
    const isValid = code.trim() === ADMIN_CODE;
    if (isValid) setAdminUnlocked(true);
    return isValid;
  }

  function changeTab(tab: TabKey) {
    setActiveTab(tab);
    if (tab === "schedule") {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  async function updateNow() {
    setIsUpdating(true);

    try {
      const registration =
        serviceWorkerRegistration ?? (await navigator.serviceWorker?.getRegistration?.());
      await registration?.update();
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.filter((name) => name.startsWith("app-cache-")).map((name) => caches.delete(name)));
      }
    } catch {
      // A plain reload is still the best fallback in standalone iOS mode.
    } finally {
      window.location.reload();
    }
  }

  return (
    <main className="app-shell">
      <Header
        liveCount={appMatches.filter((match) => match.status === "live").length}
        searchQuery={searchQuery}
        showSearch={activeTab === "schedule"}
        onSearchChange={setSearchQuery}
        adminUnlocked={adminUnlocked}
        onAdminLogin={loginAdmin}
        onAdminLogout={() => setAdminUnlocked(false)}
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
        {activeTab === "leaderboard" && (
          <LeaderboardView
            leaderboard={leaderboard}
            ownPlayerKeys={ownPlayerKeys}
            onSelectPlayer={setSelectedPlayerName}
          />
        )}
      </section>

      <BottomNav activeTab={activeTab} onChange={changeTab} />

      {selectedPlayerName && (
        <PlayerPredictionsDetail
          playerName={selectedPlayerName}
          items={selectedPlayerPredictions}
          clientId={clientId}
          isOwnPlayer={ownPlayerKeys.has(normalizePlayerName(selectedPlayerName))}
          onClose={() => setSelectedPlayerName(null)}
          onOpenMatch={setSelectedMatchId}
          onSavePrediction={savePrediction}
          onRenamePlayer={renameOwnPredictions}
        />
      )}

      {selectedMatch && (
        <MatchDetail
          match={selectedMatch}
          allMatches={appMatches}
          isFavorite={favoriteSet.has(selectedMatch.id)}
          favoriteSet={favoriteSet}
          predictions={predictionsByMatch[selectedMatch.id] ?? []}
          clientId={clientId}
          playerName={playerName}
          adminUnlocked={adminUnlocked}
          onClose={() => setSelectedMatchId(null)}
          onToggleFavorite={() => toggleFavorite(selectedMatch.id)}
          onToggleMatchFavorite={toggleFavorite}
          onSavePrediction={savePrediction}
          onDeletePrediction={(prediction) => deletePrediction(selectedMatch.id, prediction)}
          onAdminDeletePrediction={(prediction) => deletePredictionAsAdmin(selectedMatch.id, prediction)}
          onAdminDeleteAll={() => deleteAllPredictionsAsAdmin(selectedMatch.id)}
        />
      )}

      {updateAvailable && <UpdatePrompt isUpdating={isUpdating} onUpdate={updateNow} />}
    </main>
  );
}

function Header({
  liveCount,
  searchQuery,
  showSearch,
  onSearchChange,
  adminUnlocked,
  onAdminLogin,
  onAdminLogout,
}: {
  liveCount: number;
  searchQuery: string;
  showSearch: boolean;
  onSearchChange: (value: string) => void;
  adminUnlocked: boolean;
  onAdminLogin: (code: string) => boolean;
  onAdminLogout: () => void;
}) {
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [adminMessage, setAdminMessage] = useState("");

  function submitAdminLogin(event: React.FormEvent) {
    event.preventDefault();
    if (onAdminLogin(adminCode)) {
      setAdminCode("");
      setAdminMessage("");
      setAdminOpen(false);
      return;
    }
    setAdminMessage("Code klopt niet.");
  }

  return (
    <header className="topbar">
      <div className="app-mark" aria-label="WK 2026">WK 2026</div>
      <div className="topbar-actions">
        {showSearch && (
          <div className="search-control">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Zoek op land"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Zoek land"
            />
            {searchQuery && (
              <button type="button" onClick={() => onSearchChange("")} aria-label="Zoekopdracht wissen">
                ×
              </button>
            )}
          </div>
        )}
        <div className="admin-menu">
          <button
            className={`admin-icon-button ${adminUnlocked ? "active" : ""}`}
            type="button"
            onClick={() => setAdminOpen((current) => !current)}
            aria-label="Admin"
          >
            ⚙
            {adminUnlocked && <span className="admin-dot" />}
          </button>
          {adminOpen && (
            <div className="admin-popover">
              {adminUnlocked ? (
                <div className="admin-popover-actions">
                  <span>Adminmodus actief</span>
                  <button type="button" onClick={onAdminLogout}>Uitloggen</button>
                </div>
              ) : (
                <form className="admin-login" onSubmit={submitAdminLogin}>
                  <label>
                    Wachtwoord
                    <input
                      value={adminCode}
                      onChange={(event) => setAdminCode(event.target.value)}
                      placeholder="Wachtwoord"
                      type="password"
                    />
                  </label>
                  <button type="submit">Inloggen</button>
                  {adminMessage && <p>{adminMessage}</p>}
                </form>
              )}
            </div>
          )}
        </div>
        {liveCount > 0 && <span className="pill live-dot">{liveCount} live</span>}
      </div>
    </header>
  );
}

function UpdatePrompt({ isUpdating, onUpdate }: { isUpdating: boolean; onUpdate: () => void }) {
  return (
    <div className="update-modal-backdrop" role="dialog" aria-modal="true" aria-label="Nieuwe versie beschikbaar">
      <section className="update-modal">
        <div>
          <h2>Nieuwe versie beschikbaar</h2>
          <p>Er staat een nieuwere versie van de WK-app klaar.</p>
        </div>
        <button type="button" onClick={onUpdate} disabled={isUpdating}>
          {isUpdating ? "Updaten..." : "Update nu"}
        </button>
      </section>
    </div>
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
  const [playedOpen, setPlayedOpen] = useState(false);
  const upcomingMatches = props.matches.filter((match) => !isPlayedMatch(match));
  const playedMatches = props.matches.filter(isPlayedMatch);

  return (
    <>
      <SectionTitle title="Mijn wedstrijden" />
      {props.matches.length ? (
        <div className="favorites-sections">
          {playedMatches.length > 0 && (
            <section className="played-favorites">
              <button type="button" onClick={() => setPlayedOpen((current) => !current)}>
                <span>Gespeelde wedstrijden</span>
                <small>{playedMatches.length}</small>
                <b>{playedOpen ? "−" : "+"}</b>
              </button>
              {playedOpen && <MatchList {...props} matches={playedMatches} />}
            </section>
          )}
          {upcomingMatches.length > 0 && <MatchList {...props} matches={upcomingMatches} />}
        </div>
      ) : (
        <EmptyState
          title="Nog geen favorieten"
          text="Tik op de ster bij een wedstrijd om hem hier te bewaren."
        />
      )}
    </>
  );
}

function ResultsView({ matches, ...rest }: MatchListProps) {
  const [viewMode, setViewMode] = useState<"results" | "standings">("results");
  const resultMatches = matches.filter(
    (match) => isBeforeToday(match.kickoff) || match.status === "live" || match.status === "finished"
  );

  return (
    <>
      <ViewTabs
        items={[
          { key: "results", label: "Uitslagen" },
          { key: "standings", label: "Standen" },
        ]}
        activeKey={viewMode}
        onChange={(key) => setViewMode(key as "results" | "standings")}
      />
      {viewMode === "results" && resultMatches.length ? (
        <MatchList matches={resultMatches} {...rest} />
      ) : viewMode === "results" ? (
        <EmptyState
          title="Nog geen uitslagen"
          text="Het WK 2026 begint op 11 juni. Zodra wedstrijden live zijn of afgelopen, verschijnen ze hier."
        />
      ) : (
        <StandingsOverview matches={matches} />
      )}
    </>
  );
}

function ViewTabs({
  items,
  activeKey,
  onChange,
}: {
  items: { key: string; label: string }[];
  activeKey: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="view-tabs">
      {items.map((item) => (
        <button
          key={item.key}
          className={activeKey === item.key ? "active" : ""}
          type="button"
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function StandingsOverview({ matches }: { matches: Match[] }) {
  const groups = matches.reduce<string[]>((stages, match) => {
    if (!match.stage.startsWith("Groep") || stages.includes(match.stage)) return stages;
    return [...stages, match.stage];
  }, []);

  return (
    <div className="standings-overview">
      {groups.map((stage) => (
        <section className="standings-panel" key={stage}>
          <div className="panel-title">
            <h2>{stage}</h2>
          </div>
          <StandingsTable standings={getGroupStandings(stage, matches)} />
        </section>
      ))}
    </div>
  );
}

function LeaderboardView({
  leaderboard,
  ownPlayerKeys,
  onSelectPlayer,
}: {
  leaderboard: LeaderboardRow[];
  ownPlayerKeys: Set<string>;
  onSelectPlayer: (name: string) => void;
}) {
  return (
    <>
      <SectionTitle title="Scorebord" />
      {leaderboard.length ? (
        <div className="leaderboard-list">
          {leaderboard.map((row, index) => {
            const isOwn = ownPlayerKeys.has(row.key);
            return (
              <button className={`leaderboard-row ${isOwn ? "own" : ""}`} type="button" key={row.key} onClick={() => onSelectPlayer(row.name)}>
                <span className="leaderboard-position">{index + 1}</span>
                <div className="leaderboard-player">
                  <strong>{row.name}{isOwn && <em>Jij</em>}</strong>
                  <span>
                  {row.predictionsCount} voorspeld · {row.exactCount} exact · {row.outcomeCount} winnaar goed
                  </span>
                </div>
                <b>{row.points} punten</b>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Nog geen scorebord"
          text="Zodra er voorspellingen zijn ingevuld, verschijnen de deelnemers hier."
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
  const isDutchMatch = hasDutchTeam(match);
  const cardTone = isFavorite ? (isDutchMatch ? "dutch-favorite" : "favorite-match") : "";
  const starTone = isDutchMatch ? "dutch-star" : "";

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
        className={`favorite-button ${starTone} ${isFavorite ? "active" : ""}`}
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
  return (
    <span className={`status-badge ${status}`}>
      {status === "live" && <span className="live-pulse" />}
      {statusLabel(status)}
    </span>
  );
}

function MatchDetail({
  match,
  allMatches,
  isFavorite,
  favoriteSet,
  predictions,
  clientId,
  playerName,
  adminUnlocked,
  onClose,
  onToggleFavorite,
  onToggleMatchFavorite,
  onSavePrediction,
  onDeletePrediction,
  onAdminDeletePrediction,
  onAdminDeleteAll,
}: {
  match: Match;
  allMatches: Match[];
  isFavorite: boolean;
  favoriteSet: Set<string>;
  predictions: Prediction[];
  clientId: string;
  playerName: string;
  adminUnlocked: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  onToggleMatchFavorite: (matchId: string) => void;
  onSavePrediction: (prediction: Prediction) => Promise<void> | void;
  onDeletePrediction: (prediction?: Prediction) => Promise<void> | void;
  onAdminDeletePrediction: (prediction: Prediction) => Promise<void> | void;
  onAdminDeleteAll: () => Promise<void> | void;
}) {
  const { home, away } = getMatchTeams(match);
  const venue = getMatchVenue(match);
  const predictionClosed = match.status !== "scheduled";
  const starTone = hasDutchTeam(match) ? "dutch-star" : "";

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="detail-sheet" onClick={(event) => event.stopPropagation()}>
        <section className="detail-match-card">
          <div className="detail-header">
            <button className="icon-button" onClick={onClose} aria-label="Terug">←</button>
            {match.status !== "scheduled" && <StatusBadge status={match.status} />}
            <button className={`icon-button star ${starTone} ${isFavorite ? "active" : ""}`} onClick={onToggleFavorite} aria-label="Favoriet">
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
          playerName={playerName}
          adminUnlocked={adminUnlocked}
          disabled={predictionClosed}
          onSavePrediction={onSavePrediction}
          onDeletePrediction={onDeletePrediction}
          onAdminDeletePrediction={onAdminDeletePrediction}
          onAdminDeleteAll={onAdminDeleteAll}
        />

        <GroupStandings match={match} allMatches={allMatches} />
        <GroupFixtures match={match} allMatches={allMatches} favoriteSet={favoriteSet} onToggleFavorite={onToggleMatchFavorite} />
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
  playerName,
  adminUnlocked,
  disabled,
  onSavePrediction,
  onDeletePrediction,
  onAdminDeletePrediction,
  onAdminDeleteAll,
}: {
  match: Match;
  predictions: Prediction[];
  clientId: string;
  playerName: string;
  adminUnlocked: boolean;
  disabled: boolean;
  onSavePrediction: (prediction: Prediction) => Promise<void> | void;
  onDeletePrediction: (prediction?: Prediction) => Promise<void> | void;
  onAdminDeletePrediction: (prediction: Prediction) => Promise<void> | void;
  onAdminDeleteAll: () => Promise<void> | void;
}) {
  const { home, away } = getMatchTeams(match);
  const ownPrediction = predictions.find((prediction) => prediction.clientId === clientId);
  const hasCurrentScore = match.homeScore !== undefined && match.awayScore !== undefined;
  const [name, setName] = useState(ownPrediction?.name ?? playerName);
  const [homeScore, setHomeScore] = useState(String(ownPrediction?.homeScore ?? ""));
  const [awayScore, setAwayScore] = useState(String(ownPrediction?.awayScore ?? ""));
  const [message, setMessage] = useState("");

  useEffect(() => {
    setName(ownPrediction?.name ?? playerName);
    setHomeScore(String(ownPrediction?.homeScore ?? ""));
    setAwayScore(String(ownPrediction?.awayScore ?? ""));
  }, [match.id, ownPrediction?.name, ownPrediction?.homeScore, ownPrediction?.awayScore, playerName]);

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

  async function deletePredictionForAdmin(prediction: Prediction) {
    try {
      await onAdminDeletePrediction(prediction);
      setMessage("Voorspelling verwijderd.");
    } catch {
      setMessage("Admin verwijderen lukt nog niet. Controleer de Supabase rechten.");
    }
  }

  async function deleteAllForAdmin() {
    try {
      await onAdminDeleteAll();
      setMessage("Alle voorspellingen voor deze wedstrijd zijn verwijderd.");
    } catch {
      setMessage("Alles verwijderen lukt nog niet. Controleer de Supabase rechten.");
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
                {prediction.clientId === clientId && !adminUnlocked && (
                  <button type="button" onClick={deleteSavedPrediction} aria-label="Verwijder voorspelling">×</button>
                )}
                {adminUnlocked && (
                  <button type="button" onClick={() => deletePredictionForAdmin(prediction)} aria-label="Verwijder voorspelling als admin">×</button>
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
      {adminUnlocked && (
        <section className="admin-panel">
          <div className="admin-actions">
            <span>Adminmodus actief</span>
            <button type="button" onClick={deleteAllForAdmin} disabled={!predictions.length}>Alles verwijderen</button>
          </div>
        </section>
      )}
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

function getGroupStandings(stage: string, allMatches: Match[]) {
  const groupMatches = allMatches.filter((match) => match.stage === stage);
  const teamOrder: string[] = [];

  groupMatches.forEach((match) => {
    [match.homeTeamId, match.awayTeamId].forEach((teamId) => {
      if (!teamOrder.includes(teamId)) teamOrder.push(teamId);
    });
  });

  const rows = new Map<string, StandingRow>();
  teamOrder.forEach((teamId, order) => {
    const team = teamById.get(teamId) ?? createFallbackTeam(teamId);
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

function GroupStandings({ match, allMatches }: { match: Match; allMatches: Match[] }) {
  const standings = getGroupStandings(match.stage, allMatches);

  return (
    <section className="standings-panel">
      <div className="panel-title">
        <h2>Stand {match.stage}</h2>
      </div>
      <StandingsTable standings={standings} />
    </section>
  );
}

function StandingsTable({ standings }: { standings: StandingRow[] }) {
  return (
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
  );
}

function GroupFixtures({
  match,
  allMatches,
  favoriteSet,
  onToggleFavorite,
}: {
  match: Match;
  allMatches: Match[];
  favoriteSet: Set<string>;
  onToggleFavorite: (matchId: string) => void;
}) {
  const groupMatches = allMatches
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
          const starTone = hasDutchTeam(groupMatch) ? "dutch-star" : "";
          return (
            <div className="group-fixture-row" key={groupMatch.id}>
              <div>
                <span>{formatDate(groupMatch.kickoff)}</span>
                <button
                  className={`group-favorite-button ${starTone} ${isFavorite ? "active" : ""}`}
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

function predictionResultLabel(result: PredictionResult) {
  if (result === "pending") return "Nog niet gespeeld";
  if (result === "exact") return "Exact goed";
  if (result === "winner") return "Winnaar goed";
  if (result === "draw") return "Gelijkspel goed";
  return "Fout";
}

function PlayerPredictionsDetail({
  playerName,
  items,
  clientId,
  isOwnPlayer,
  onClose,
  onOpenMatch,
  onSavePrediction,
  onRenamePlayer,
}: {
  playerName: string;
  items: EvaluatedPrediction[];
  clientId: string;
  isOwnPlayer: boolean;
  onClose: () => void;
  onOpenMatch: (matchId: string) => void;
  onSavePrediction: (prediction: Prediction) => Promise<void> | void;
  onRenamePlayer: (name: string) => Promise<void> | void;
}) {
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [nameValue, setNameValue] = useState(playerName);
  const [editingItem, setEditingItem] = useState<EvaluatedPrediction | null>(null);
  const [message, setMessage] = useState("");
  const totalPoints = items.reduce((total, item) => total + item.points, 0);

  useEffect(() => {
    setNameValue(playerName);
  }, [playerName]);

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    try {
      await onRenamePlayer(nameValue);
      setNameEditOpen(false);
      setMessage("Naam aangepast.");
    } catch {
      setMessage("Naam aanpassen lukt nog niet.");
    }
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="detail-sheet player-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="detail-header">
          <button className="icon-button" onClick={onClose} aria-label="Terug">←</button>
          <div className="player-title">
            <h2>{playerName}</h2>
            {isOwnPlayer && (
              <button type="button" onClick={() => setNameEditOpen(true)} aria-label="Naam aanpassen">
                ✎
              </button>
            )}
          </div>
          <span className="player-total">{totalPoints} pt</span>
        </div>
        {message && <p className="feedback compact">{message}</p>}
        <div className="player-prediction-list">
          {items.map((item) => {
            const { home, away } = getMatchTeams(item.match);
            const hasActualScore = item.match.homeScore !== undefined && item.match.awayScore !== undefined;
            const canEditScore = item.prediction.clientId === clientId && item.match.status === "scheduled";
            return (
              <article className="player-prediction-card" key={`${item.prediction.matchId}-${item.prediction.id ?? item.prediction.updatedAt}`}>
                <div className="player-prediction-meta">
                  <span>{formatDate(item.match.kickoff)} · {formatTime(item.match.kickoff)}</span>
                  <b className={`prediction-result ${item.result}`}>{predictionResultLabel(item.result)}</b>
                </div>
                <button className="player-match-button" type="button" onClick={() => onOpenMatch(item.match.id)}>
                  {home.name} - {away.name}
                </button>
                <div className="player-score-row">
                  <span>Voorspeld</span>
                  <div>
                    <b>{item.prediction.homeScore} - {item.prediction.awayScore}</b>
                    {canEditScore && (
                      <button type="button" onClick={() => setEditingItem(item)} aria-label="Voorspelling aanpassen">
                        ✎
                      </button>
                    )}
                  </div>
                </div>
                <div className="player-score-row">
                  <span>Uitslag</span>
                  <div>
                    <b>{hasActualScore ? `${item.match.homeScore} - ${item.match.awayScore}` : "-"}</b>
                    <small>{item.points} punten</small>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      {nameEditOpen && (
        <div className="inline-modal-backdrop" role="dialog" aria-modal="true" onClick={(event) => {
          event.stopPropagation();
          setNameEditOpen(false);
        }}>
          <form className="inline-modal" onSubmit={saveName} onClick={(event) => event.stopPropagation()}>
            <h3>Naam aanpassen</h3>
            <label>
              Naam
              <input value={nameValue} onChange={(event) => setNameValue(event.target.value)} autoFocus />
            </label>
            <div className="inline-modal-actions">
              <button type="button" onClick={() => setNameEditOpen(false)}>Annuleren</button>
              <button type="submit">Opslaan</button>
            </div>
          </form>
        </div>
      )}
      {editingItem && (
        <QuickPredictionEditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={async (prediction) => {
            await onSavePrediction(prediction);
            setEditingItem(null);
            setMessage("Voorspelling aangepast.");
          }}
        />
      )}
    </div>
  );
}

function QuickPredictionEditModal({
  item,
  onClose,
  onSave,
}: {
  item: EvaluatedPrediction;
  onClose: () => void;
  onSave: (prediction: Prediction) => Promise<void> | void;
}) {
  const { home, away } = getMatchTeams(item.match);
  const [homeScore, setHomeScore] = useState(String(item.prediction.homeScore));
  const [awayScore, setAwayScore] = useState(String(item.prediction.awayScore));
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (homeScore === "" || awayScore === "") {
      setMessage("Vul beide scores in.");
      return;
    }
    try {
      await onSave({
        ...item.prediction,
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
        updatedAt: new Date().toISOString(),
      });
    } catch {
      setMessage("Opslaan lukt nog niet.");
    }
  }

  return (
    <div className="inline-modal-backdrop" role="dialog" aria-modal="true" onClick={(event) => {
      event.stopPropagation();
      onClose();
    }}>
      <form className="inline-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <h3>Score aanpassen</h3>
        <div className="score-inputs">
          <label>
            {home.shortName}
            <input min="0" max="20" type="number" value={homeScore} onChange={(event) => setHomeScore(event.target.value)} autoFocus />
          </label>
          <label>
            {away.shortName}
            <input min="0" max="20" type="number" value={awayScore} onChange={(event) => setAwayScore(event.target.value)} />
          </label>
        </div>
        {message && <p className="feedback compact">{message}</p>}
        <div className="inline-modal-actions">
          <button type="button" onClick={onClose}>Annuleren</button>
          <button type="submit">Opslaan</button>
        </div>
      </form>
    </div>
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
  const items: { key: TabKey; label: string; icon?: string; materialIcon?: string }[] = [
    { key: "schedule", label: "Speelschema", materialIcon: "sports_soccer" },
    { key: "favorites", label: "Mijn wedstrijden", icon: "★" },
    { key: "results", label: "Uitslagen", materialIcon: "sports_score" },
    { key: "leaderboard", label: "Scorebord", materialIcon: "crown" },
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
          {item.materialIcon ? (
            <span className="material-symbols-rounded" aria-hidden="true">
              {item.materialIcon}
            </span>
          ) : (
            <span>{item.icon}</span>
          )}
        </button>
      ))}
    </nav>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
