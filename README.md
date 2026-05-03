# Group28 EV Charging Station Network Management Prototype

Technology stack:

- React + Vite + TypeScript frontend
- Node.js + Express REST API
- SQLite + Prisma database
- Zod validation
- Vitest, React Testing Library, and Supertest

## Run

```bash
npm install
npm run dev
```

The app runs at `http://127.0.0.1:5173` and the API runs at `http://127.0.0.1:4000`.

## Useful Commands

```bash
npm run db:push
npm run db:seed
npm test
npm run build
```

## Demo Flow

1. Register `Tesla Model 3`, `75 kWh`, `CCS`, `35 EV 2024`.
2. Open the map near Alsancak and select `Karsiyaka Hub`.
3. Reserve `DC 50kW #03` with the registered CCS vehicle.
4. Start charging at `20%` and complete at `80%`.
5. Verify `45 kWh x 4 TL/kWh = 180 TL`, wallet deduction, receipt, charging history, notification and audit log.

## Traceability

See `REQUIREMENTS_TRACEABILITY.md` and the app's `Audit & Traceability` tab for all 63 Group28 requirements.
