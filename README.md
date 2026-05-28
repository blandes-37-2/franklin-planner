# Franklin Planner

A personal productivity application built around Benjamin Franklin's timeboxing methodology. Plan your day in categorical time blocks, track execution against intentions, and surface analytics to improve your routine over time.

**Built by [Ben Landes](https://BenLandes.net)**

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue) ![Prisma](https://img.shields.io/badge/Prisma-ORM-white) ![Railway](https://img.shields.io/badge/Deployed-Railway-purple)

## Overview

Most productivity apps track tasks. Franklin Planner tracks *time* — specifically the gap between what you planned to do and what you actually did, and why. The core insight from Franklin's method is that scheduling by category first (Learning, Exercise, Deep Work) creates structure that outlasts any single to-do list.

## Features

- **Timebox Templates** — define recurring time blocks by category, scheduled by day of week
- **Daily Planning** — assign specific activities to each timebox for the day
- **Execution Check-ins** — log what you actually did, with deviation reason tracking when you strayed from the plan
- **Insights & Analytics** — adherence rates, best times per activity type, patterns by day of week, weekly summaries
- **JWT Authentication** — secure user accounts with access/refresh token flow and token revocation

## Tech Stack

| Layer | Stack |
|---|---|
| Runtime | Node.js 18+, TypeScript |
| Framework | Express.js |
| Database | PostgreSQL, Prisma ORM |
| Auth | JWT with access + refresh token flow |
| Deployment | Railway (auto-deploy from GitHub) |

## API Surface

40+ endpoints across 6 resource groups:

| Resource | Endpoints | Highlights |
|---|---|---|
| Auth | 6 | Register, login, refresh, logout, profile |
| Categories | 5 | CRUD + activity associations |
| Activities | 5 | CRUD + favorites, soft archive |
| Timeboxes | 5 | CRUD + day-of-week schedule lookup |
| Daily Plans | 6 | Get/create by date, block check-ins, deviation logging, bulk complete |
| Insights | 4 | Summary stats, time analysis, day patterns, weekly summary |

## Project Structure

```
franklin-planner/
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Development seed data
├── src/
│   ├── middleware/         # Auth, validation, error handling
│   ├── routes/             # API route handlers
│   ├── types/              # Shared TypeScript types
│   ├── utils/              # Prisma client, JWT helpers
│   └── index.ts            # Express app entry point
└── railway.toml            # Railway deployment config
```

## Status

Backend is complete and deployed. A React frontend with timeline views, check-in flow, and insights dashboards is planned for a future build.

## License

MIT © Ben Landes