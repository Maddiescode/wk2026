# WK Companion

Mobiele React + TypeScript MVP voor het WK voetbal met mockdata, favorieten, uitslagen, wedstrijddetails, groepsstanden en voorspellingen in `localStorage`.

## Lokaal draaien

```bash
cd work/wk-companion
python3 -m http.server 4173
```

Open daarna `http://localhost:4173`.

De app gebruikt lokale vendor-bestanden voor React, ReactDOM en Babel Standalone, zodat er geen package install nodig is in deze workspace. De TypeScript/JSX-code staat in `src/App.tsx`.

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
