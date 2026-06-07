type FootballDataStatus = "SCHEDULED" | "TIMED" | "LIVE" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED" | "SUSPENDED" | "CANCELLED";

type FootballDataTeam = {
  id?: number;
  name?: string;
  shortName?: string;
  tla?: string;
};

type FootballDataScore = {
  fullTime?: { home?: number | null; away?: number | null };
  regularTime?: { home?: number | null; away?: number | null };
};

type FootballDataApiMatch = {
  id: number;
  utcDate?: string;
  status: FootballDataStatus;
  stage?: string;
  group?: string;
  homeTeam?: FootballDataTeam;
  awayTeam?: FootballDataTeam;
  score?: FootballDataScore;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function mapStatus(status: FootballDataStatus) {
  if (status === "FINISHED") return "finished";
  if (status === "LIVE" || status === "IN_PLAY" || status === "PAUSED") return "live";
  return "scheduled";
}

function getScore(score?: FootballDataScore) {
  const fullTime = score?.fullTime;
  const regularTime = score?.regularTime;
  const homeScore = fullTime?.home ?? regularTime?.home;
  const awayScore = fullTime?.away ?? regularTime?.away;
  return {
    homeScore: typeof homeScore === "number" ? homeScore : undefined,
    awayScore: typeof awayScore === "number" ? awayScore : undefined,
  };
}

function jsonResponse(body: unknown, status = 200, maxAge = 45) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${maxAge}`,
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405, 0);

  const url = new URL(request.url);
  const resource = url.searchParams.get("resource") ?? "matches";
  if (resource !== "matches") return jsonResponse({ error: "Unknown resource" }, 400, 0);

  const token = Deno.env.get("FOOTBALL_DATA_TOKEN");
  if (!token) return jsonResponse({ matches: [], source: "football-data.org", configured: false }, 200, 10);

  const apiUrl = new URL("https://api.football-data.org/v4/competitions/WC/matches");
  apiUrl.searchParams.set("season", "2026");

  const response = await fetch(apiUrl, {
    headers: {
      "X-Auth-Token": token,
    },
  });

  if (!response.ok) {
    return jsonResponse(
      {
        matches: [],
        source: "football-data.org",
        configured: true,
        error: `football-data.org responded with ${response.status}`,
      },
      200,
      10
    );
  }

  const data = await response.json();
  const matches = ((data.matches ?? []) as FootballDataApiMatch[]).map((match) => {
    const score = getScore(match.score);
    return {
      id: `fd-${match.id}`,
      providerMatchId: String(match.id),
      stage: match.group || match.stage,
      status: mapStatus(match.status),
      kickoff: match.utcDate,
      homeTeamName: match.homeTeam?.name || match.homeTeam?.shortName || match.homeTeam?.tla,
      awayTeamName: match.awayTeam?.name || match.awayTeam?.shortName || match.awayTeam?.tla,
      ...score,
    };
  });

  return jsonResponse({ matches, source: "football-data.org", configured: true });
});
