# WSDOT Toll Rates Dashboard

This project is a publish-ready Next.js 14 application that displays the current Washington State DOT express toll lane prices on an interactive React Leaflet map. The server-side route proxies the official `GetTollRatesAsJson` endpoint so your WSDOT Traveler API key can stay private inside GitHub Actions or deployment platform secrets.

## Project layout

- `src/app/api/toll-rates/route.ts` – serverless route that reads `WSDOT_API_KEY`, calls WSDOT, and returns normalized data.
- `src/lib/wsdot.ts` – shared fetch + normalization helpers and TypeScript models of the API payload.
- `src/components/TollRatesMap.tsx` – client-side map experience with a live list/refresh button powered by React Leaflet.
- `src/app/page.tsx` – marketing copy plus the map.

## Prerequisites

1. Request an access code from [WSDOT Traveler Information API](https://www.wsdot.wa.gov/Traffic/api/).
2. Store it securely:
   - **Local dev**: create `.env.local` with `WSDOT_API_KEY=your-access-code`.
   - **GitHub Actions / Deployment**: add a repository secret named `WSDOT_API_KEY` and expose it to the workflow/environment where `next dev`/`next build` runs. Because the UI calls `/api/toll-rates`, the key never ships to the browser.

## Running locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000 and refresh the panel to pull the latest rates directly from WSDOT. The API route is marked `dynamic` so it always fetches real-time data when deployed as well.

## Production build

```bash
npm run build
npm run start
```

These commands mirror what most hosts (Vercel, Azure Static Web Apps, etc.) will execute. Just ensure `WSDOT_API_KEY` is defined as an environment variable/secret in that environment.

## Notes

- The frontend map uses OpenStreetMap tiles through React Leaflet. Feel free to swap in Mapbox/ArcGIS tiles by updating `TollRatesMap.tsx`.
- The API helper normalizes coordinates, converting string numbers to floats, so it is ready for any future spatial analysis.
- Errors from the WSDOT API are surfaced in the UI so published builds can show useful feedback if the upstream service hiccups.
