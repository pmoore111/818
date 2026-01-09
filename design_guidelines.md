# Design Guidelines: Personal Finance & Credit Tracker

## Design Approach
**System-Based Approach** inspired by modern fintech dashboards (Stripe, Plaid, Linear) with Material Design principles for data-heavy applications focused on clarity, efficiency, and trust.

## Core Design Elements

### Typography
- **Primary Font**: Inter or DM Sans via Google Fonts
- **Headers**: font-semibold (600), sizes: text-2xl to text-4xl
- **Body**: font-normal (400), text-sm to text-base
- **Data/Numbers**: font-mono for financial figures (tabular-nums)
- **Hierarchy**: Large numbers (text-3xl+) for key metrics, smaller supporting text

### Layout System
**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, and 12
- Component padding: p-4 to p-6
- Section gaps: gap-4 to gap-8
- Card spacing: space-y-4
- Dashboard margins: m-6 to m-8

**Grid Structure**: 
- Sidebar navigation: 16rem fixed width (w-64)
- Main content: flex-1 with max-w-7xl container
- Card grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3

### Component Library

**Dashboard Layout**:
- Fixed sidebar (left): Logo, navigation, profile footer
- Top bar: Breadcrumb, search, notifications, user menu
- Main content area: Cards and data tables with generous spacing

**Navigation**:
- Vertical sidebar with icon + label format
- Active state: Subtle background fill with accent border-l-2
- Grouped sections: "Personal", "Business", "Calendar", "AI Assistant"

**Data Cards**:
- Rounded borders (rounded-lg)
- Subtle shadow (shadow-sm)
- Header with title + action button
- Key metric display (large number + trend indicator)
- Supporting chart or details below

**Financial Tables**:
- Striped rows for readability (even:bg-gray-50)
- Fixed header on scroll
- Right-aligned currency values
- Status badges (rounded-full px-3 py-1)

**Calendar Component**:
- Month view grid with due dates highlighted
- Color-coded dots: Personal vs Business obligations
- Click to view detail modal
- Mini calendar in sidebar for quick navigation

**AI Assistant Panel**:
- Chat interface (bottom-anchored input)
- Message bubbles (user right-aligned, AI left-aligned)
- Suggestion chips for common queries
- Collapsible insights cards with charts

**Forms**:
- Floating labels or top-aligned labels
- Full-width inputs with border focus states
- Grouped related fields in cards
- Inline validation messages

**Charts & Visualizations**:
- Use Chart.js or Recharts library
- Line charts for trends over time
- Donut charts for category breakdowns
- Bar charts for monthly comparisons
- Consistent sizing (h-64 to h-80)

**Icons**:
- Heroicons via CDN (outline style for navigation, solid for emphasis)
- Financial icons: CreditCardIcon, BanknotesIcon, CalendarIcon, ChartBarIcon

### Animations
Minimal and purposeful:
- Smooth transitions on nav active states (transition-all duration-200)
- Chart animations on load only
- Modal/drawer slide-in (no elaborate effects)

## Images
**No hero images** - This is a utility dashboard, not a marketing site. Focus on data visualization and functional UI.

If avatar/profile images needed: Circular (rounded-full), 40x40px standard size.

## Key Screens Structure

**Dashboard Home**:
- Overview metrics: 4-column grid showing credit scores, balances, upcoming payments
- Recent transactions table
- Spending trends chart
- Quick actions bar

**Personal/Business Views**:
- Similar layout with filtered data
- Category breakdown charts
- Transaction history tables
- Credit score tracking over time

**Calendar View**:
- Full-page calendar with side panel for event details
- Filter toggles: Personal/Business/Both
- Upcoming obligations list view option

**AI Assistant**:
- Full-height chat panel (can be sidebar or full page)
- Persistent chat history
- Context-aware suggestions based on current view

## Design Principles
1. **Data First**: Information hierarchy prioritizes numbers and insights
2. **Trust Through Clarity**: Clean, organized layouts convey reliability
3. **Efficiency**: Quick access to all features, minimal clicks
4. **Privacy Conscious**: No external tracking, secure-feeling UI
5. **Scannable**: Use of whitespace, typography, and grouping for quick comprehension