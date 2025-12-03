# Periodic Data Table (Next.js + three.js CSS3D)

A modern, interactive data visualization inspired by the three.js CSS3D Periodic Table demo. It authenticates with Google, reads a dataset from Google Sheets, and renders animated CSS3D tiles in multiple arrangements.

## Features
- Google Sign‑In using Google Identity Services
- Fetches data from Google Sheets API v4
- Four arrangements: Table 20×10, Sphere, Double Helix, Grid 5×4×10
- Net worth color scale: red (< $100K), orange (≥ $100K), green (≥ $200K)
- HUD indicators for arrangement, legend with Low/High scale
- Click a tile to open an animated detail preview overlay
- Modern login overlay with polished styling and motion

## Tech Stack
- Next.js 14, React 18
- three.js `CSS3DRenderer` (examples) and `@tweenjs/tween.js`
- TypeScript, ESLint (strict rules)

## Getting Started

### Prerequisites
1. Google Cloud Project
   - Create an OAuth 2.0 Client (type: Web Application)
   - Add Authorized JavaScript origins:
     - `http://localhost:3000` for local dev
     - Your production domain (e.g., `https://your-app.vercel.app`)
   - Enable the Google Sheets API for the same project

2. Google Sheet
   - Import the provided CSV to a new sheet
   - Share the sheet with the reviewer account (as required)
   - Note the Spreadsheet ID and tab name

### Environment Variables
Create `.env.local` in the project root:
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_oauth_client_id.apps.googleusercontent.com
NEXT_PUBLIC_SPREADSHEET_ID=your_spreadsheet_id
NEXT_PUBLIC_SHEET_RANGE=YourTabName!A1:Z1000
```
- `NEXT_PUBLIC_SHEET_RANGE` is optional; the app falls back to reasonable ranges if omitted.

### Run Locally
```
npm install
npm run dev
```
Open `http://localhost:3000`, sign in with Google, and the tiles will load from your sheet.

## Data Mapping
- Columns are mapped by header names and common variants:
  - `id | rank | number`
  - `name | full name | person`
  - `title | role | position`
  - `company | organization | org`
  - `networth | net worth | worth | wealth`
- The parser normalizes amounts and derives `networthVal` used for coloring.

## Controls
- Bottom menu switches between:
  - Table (20×10)
  - Sphere
  - Double Helix
  - Grid (5×4×10)
- Top HUD shows the current arrangement
- Right legend shows Net Worth scale with Low/High
- Click any tile to open detail preview; click outside or Close to dismiss

## Deployment
- Recommended: Vercel
  - Import the GitHub repository
  - Add the environment variables in the Vercel dashboard
  - Add the production origin to your OAuth client
  - Verify sign‑in and Sheets access on the live URL

## Troubleshooting
- `origin_mismatch` during sign‑in:
  - Ensure your current origin is listed in the OAuth client’s Authorized JavaScript origins
- `Unable to parse range` from Sheets:
  - Set `NEXT_PUBLIC_SHEET_RANGE` to the correct tab range, e.g., `People!A1:Z1000`
- Empty tiles:
  - Confirm header names and sharing permissions; ensure the sheet has data rows

## Attribution
- Visualization concept inspired by three.js CSS3D Periodic Table example.
