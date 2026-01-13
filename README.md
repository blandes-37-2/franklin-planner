# Franklin Planner

A personal productivity application inspired by Benjamin Franklin's timeboxing methodology. Plan your day in categorical blocks, track execution against intentions, and gain insights to optimize your routine over time.

## Features

- **Timebox Templates**: Define recurring time blocks by category (Learning, Exercise, Deep Work, etc.)
- **Daily Planning**: Plan specific activities within each timebox
- **Execution Tracking**: Log what you actually do, with deviation reasons when you stray from the plan
- **Insights & Analytics**: Track adherence rates, identify patterns, and optimize your schedule
- **JWT Authentication**: Secure user accounts with access/refresh token flow

## Tech Stack

- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT with refresh tokens

## Project Structure

```
franklin-planner/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Seed data for development
├── src/
│   ├── middleware/      # Auth, validation, error handling
│   ├── routes/          # API route handlers
│   ├── types/           # TypeScript types
│   ├── utils/           # Helpers (Prisma client, JWT)
│   └── index.ts         # Express app entry point
├── .env.example         # Environment variables template
├── package.json
├── tsconfig.json
└── railway.toml         # Railway deployment config
```

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+
- PostgreSQL (local or hosted)

### 1. Clone and Install

```bash
git clone <repo-url>
cd franklin-planner
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database URL and JWT secret
```

### 3. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (development)
npm run db:push

# Seed with sample data
npm run db:seed
```

### 4. Run Development Server

```bash
npm run dev
```

Server runs at `http://localhost:3000`

## Deploying to Railway

### 1. Create Railway Project

1. Go to [railway.app](https://railway.app) and create a new project
2. Add a PostgreSQL database service
3. Add a new service from GitHub (connect your repo)

### 2. Configure Environment Variables

In Railway dashboard, add these variables to your service:

```
DATABASE_URL        # Auto-populated if you link Railway Postgres
JWT_SECRET          # Generate a secure random string
JWT_EXPIRES_IN      # e.g., "15m"
JWT_REFRESH_EXPIRES_IN  # e.g., "7d"
NODE_ENV            # "production"
FRONTEND_URL        # Your frontend URL for CORS
```

### 3. Deploy

Railway will automatically:
1. Detect the Node.js project
2. Run `npm install` and `npm run build`
3. Start with `npm run start`
4. Run the health check at `/health`

### 4. Run Migrations (First Deploy)

After deployment, open Railway's shell and run:

```bash
npx prisma db push
npx prisma db seed  # Optional: seed data
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login, get tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke refresh token |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/me` | Update user settings |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List all categories |
| GET | `/api/categories/:id` | Get category with activities |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category |

### Activities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/activities` | List activities |
| GET | `/api/activities/favorites` | List favorites |
| POST | `/api/activities` | Create activity |
| PUT | `/api/activities/:id` | Update activity |
| DELETE | `/api/activities/:id` | Archive (or permanent delete) |

### Timeboxes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/timeboxes` | List all timeboxes |
| GET | `/api/timeboxes/schedule/:day` | Get schedule for day (0-6) |
| POST | `/api/timeboxes` | Create timebox |
| PUT | `/api/timeboxes/:id` | Update timebox |
| DELETE | `/api/timeboxes/:id` | Delete timebox |

### Daily Plans

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/plans/:date` | Get/create plan for date |
| PUT | `/api/plans/:date` | Update plan (rating, notes) |
| PUT | `/api/plans/:date/blocks/:id` | Update planned activity |
| POST | `/api/plans/:date/blocks/:id/checkin` | Log actual activity |
| POST | `/api/plans/:date/complete-as-planned` | Mark day complete |
| GET | `/api/plans?startDate=&endDate=` | List plans in range |

### Insights

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/insights` | Summary stats (date range) |
| GET | `/api/insights/time-analysis` | Best times per activity |
| GET | `/api/insights/day-patterns` | Patterns by day of week |
| GET | `/api/insights/weekly-summary` | Current week summary |

## Example Usage

### Register and Login

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "ben@example.com", "password": "securepass123", "name": "Ben"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "ben@example.com", "password": "securepass123"}'
```

### Get Today's Plan

```bash
curl http://localhost:3000/api/plans/2025-01-13 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Check In on a Block

```bash
curl -X POST http://localhost:3000/api/plans/2025-01-13/blocks/BLOCK_ID/checkin \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actualActivityId": "ACTIVITY_ID",
    "isCompleted": true
  }'
```

### Log a Deviation

```bash
curl -X POST http://localhost:3000/api/plans/2025-01-13/blocks/BLOCK_ID/checkin \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actualActivityId": "DIFFERENT_ACTIVITY_ID",
    "deviationReason": "ENERGY",
    "deviationNotes": "Felt too tired for Spanish, went for a run instead",
    "isCompleted": true
  }'
```

## Development Commands

```bash
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript
npm run start        # Run production build
npm run lint         # Type check without emitting
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes (dev)
npm run db:migrate   # Create and run migrations
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio GUI
npm run db:reset     # Reset database (WARNING: deletes all data)
```

## Next Steps (Frontend)

This backend is ready to connect to a React frontend. Next session we'll build:

1. PWA-enabled React app with Vite
2. Daily planning interface with timeline view
3. Check-in flow for execution tracking
4. Insights dashboard with charts
5. Mobile-optimized responsive design

---

Built with ☕ and Franklin's wisdom: *"By failing to prepare, you are preparing to fail."*
