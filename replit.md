# Personal Finance & Credit Tracker

A private, self-hosted financial management application for tracking personal and business credit/finances with an AI assistant.

## Overview

This application helps users:
- Track personal credit and finances (accounts, transactions)
- Track business credit and finances (separate from personal)
- View both in a shared calendar showing due dates and obligations
- Chat with an AI assistant for spending analysis and credit improvement tips

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS + shadcn/ui components
- **AI**: OpenAI via Replit AI Integrations

## Project Structure

```
client/
├── src/
│   ├── components/     # Reusable UI components
│   │   ├── ui/         # shadcn/ui components
│   │   ├── app-sidebar.tsx
│   │   ├── theme-provider.tsx
│   │   └── theme-toggle.tsx
│   ├── pages/          # Page components
│   │   ├── dashboard.tsx      # Main overview
│   │   ├── personal-finances.tsx
│   │   ├── business-finances.tsx
│   │   ├── calendar.tsx       # Obligations calendar
│   │   ├── assistant.tsx      # AI chat
│   │   └── not-found.tsx
│   ├── hooks/
│   ├── lib/
│   └── App.tsx
server/
├── db.ts              # Database connection
├── routes.ts          # API endpoints
├── storage.ts         # Database operations
└── replit_integrations/  # OpenAI integration
shared/
└── schema.ts          # Database schema and types
```

## Database Schema

- **users**: Basic user table (for future auth)
- **accounts**: Financial accounts (checking, savings, credit cards, loans)
  - `type`: 'personal' or 'business'
  - `category`: 'checking', 'savings', 'credit_card', 'loan', 'investment'
  - Includes credit score, credit limit, interest rate tracking
- **transactions**: Financial transactions linked to accounts
- **obligations**: Recurring payments and due dates
- **conversations**: AI chat conversations
- **messages**: Chat messages in conversations

## API Endpoints

### Accounts
- `GET /api/accounts` - List all accounts
- `GET /api/accounts/:id` - Get single account
- `POST /api/accounts` - Create account
- `PATCH /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account

### Transactions
- `GET /api/transactions` - List all transactions
- `POST /api/transactions` - Create transaction (auto-updates account balance)
- `DELETE /api/transactions/:id` - Delete transaction

### Obligations
- `GET /api/obligations` - List all obligations
- `POST /api/obligations` - Create obligation
- `PATCH /api/obligations/:id` - Update obligation (mark paid, etc.)
- `DELETE /api/obligations/:id` - Delete obligation

### AI Chat
- `GET /api/conversations` - List conversations
- `GET /api/conversations/:id` - Get conversation with messages
- `POST /api/conversations` - Create new conversation
- `DELETE /api/conversations/:id` - Delete conversation
- `POST /api/conversations/:id/messages` - Send message (SSE streaming response)

## Development

```bash
npm run dev        # Start development server
npm run db:push    # Push schema changes to database
```

## Design System

- Uses Inter font for UI, JetBrains Mono for financial numbers
- Green primary color (hsl 142 76% 36%) for finance theme
- Dark mode support via ThemeProvider
- Chart colors: chart-1 through chart-5 for visualizations
- Personal finances: blue accent (chart-2)
- Business finances: orange accent (chart-4)

## Recent Changes

- Initial MVP build with full CRUD for accounts, transactions, obligations
- AI assistant with financial context integration
- Calendar view with personal/business filtering
- Dashboard with spending charts and metrics
