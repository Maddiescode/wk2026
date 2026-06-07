# WK Companion

Mobiele React + TypeScript MVP voor het WK voetbal met mockdata, favorieten, uitslagen, wedstrijddetails, groepsstanden en voorspellingen in `localStorage`.

## Lokaal draaien

```bash
cd work/wk-companion
python3 -m http.server 4173
```

Open daarna `http://localhost:4173`.

De app gebruikt lokale vendor-bestanden voor React, ReactDOM en Babel Standalone, zodat er geen package install nodig is in deze workspace. De TypeScript/JSX-code staat in `src/App.tsx`.

## Gratis live scores via football-data.org

De app kan WK-scores ophalen via een Supabase Edge Function proxy:

- Frontend endpoint: `https://kxszledwzxhaasdjqntt.supabase.co/functions/v1/football-data?resource=matches`
- Provider: `football-data.org`
- Competition endpoint: `/v4/competitions/WC/matches?season=2026`
- Secret naam in Supabase: `FOOTBALL_DATA_TOKEN`

De API-token staat bewust niet in de frontend en niet in git. Als de Edge Function nog niet gedeployed is, of de provider niets teruggeeft, valt de app automatisch terug op de lokale WK-data.

Deploy met Supabase CLI:

```bash
supabase secrets set FOOTBALL_DATA_TOKEN=<token> --project-ref kxszledwzxhaasdjqntt
supabase functions deploy football-data --project-ref kxszledwzxhaasdjqntt
```

De app pollt de proxy elke 90 seconden en bij terugkeer naar de app. Met `?demo=scores` blijft de testmodus beschikbaar zonder de echte API-data te gebruiken.

## Publiceren met GitHub Pages

Deze map is direct als statische site te hosten.

```bash
git init
git add .
git commit -m "Initial WK Companion app"
git branch -M main
git remote add origin https://github.com/<gebruikersnaam>/<repo>.git
git push -u origin main
```

Zet daarna in GitHub bij `Settings` -> `Pages`:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/root`

Na enkele minuten is de app beschikbaar via GitHub Pages.
