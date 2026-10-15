# DRIVELUXE-smh-demo

DriveLuxe — premium car rental full-stack app (Next.js 16 + Tailwind + Prisma).

## Run locally

```bash
npm install
cp .env.example .env
npx prisma db push
npm run dev
```

Open http://localhost:3000

## Build

```bash
npm run build
npm start
```

## Deploy

- Vercel (recommended for Next.js): import `skjanu786143-coder/DRIVELUXE-smh-demo`, set `DATABASE_URL` and `JWT_SECRET`, deploy.
- Any Node host: `npm run build` then run with `output: standalone` (see `next.config.ts`).

## Env vars

See `.env.example`:

- `DATABASE_URL` (SQLite `file:./dev.db` by default for demo)
- `JWT_SECRET`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` (optional, test mode)
