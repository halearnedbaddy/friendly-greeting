# PayLoom - Secure Escrow Payment Platform

## Overview
PayLoom is a secure escrow payment platform for African markets, powered by M-Pesa. It enables sellers to create payment links and buyers to pay safely with escrow protection.

## Project Structure
- `/src` - Frontend React application (Vite + TypeScript + Tailwind CSS)
- `/backend` - Express.js backend server (separate npm package)
- `/supabase` - Legacy Supabase Edge Functions (reference only)

## Tech Stack
### Frontend
- React 18 with TypeScript
- Vite (port 5000 in dev)
- Tailwind CSS for styling
- Radix UI components
- React Router for navigation
- Supabase JS client for auth/API calls
- Socket.io-client for real-time features

### Backend (`/backend`)
- Express.js with TypeScript
- Prisma ORM (connected to Neon PostgreSQL via DATABASE_URL)
- Socket.io for real-time
- JWT authentication
- IntaSend + Paystack payment integrations

## Database
- **Provider**: Neon PostgreSQL
- **ORM**: Prisma (schema at `backend/prisma/schema.prisma`)
- **Connection**: `DATABASE_URL` environment variable (already configured)
- Schema is synced — run `cd backend && npx prisma db push` to re-sync after schema changes

## Development Workflows
- **Frontend**: `npm run dev` → port 5000 (webview)
- **Backend**: `cd backend && npm run dev -- --port 8000` → port 8000 (console)

## Environment Variables Required
- `DATABASE_URL` - Neon PostgreSQL connection string (configured)
- `JWT_SECRET` - For token signing
- `INTASEND_SECRET_KEY` / `INTASEND_PUBLISHABLE_KEY` - M-Pesa payments
- `PAYSTACK_SECRET_KEY` - Paystack payments
- `REDIS_URL` - Redis for caching (optional)

## Deployment
- Frontend: Static deployment via Vite build to `dist/`
- Backend: Deploy separately or as part of full-stack deployment
