# Expense Tracker App

Mobile-first expense tracker built with Expo Router, React Native, Tailwind (NativeWind), and WatermelonDB.

## Features

- Create expenses with amount, category, date, payment method, and notes
- Quick add flow from tab action and native quick actions
- Recurring expense rules (daily/weekly/monthly style intervals)
- Pending recurring prompts with confirm/skip workflow
- Dashboard with weekly trend chart and top spending categories
- Search and filter expense history
- Movement detail screen with recurrence controls
- CSV export for confirmed expenses
- User preferences (name, email, currency, week start day)
- Optional app lock with biometrics/device credentials

## Tech Stack

- Expo SDK 54 + Expo Router
- React 19 + React Native 0.81
- TypeScript
- WatermelonDB (SQLite adapter)
- NativeWind v5 preview + Tailwind CSS v4 + react-native-css
- React Native Reanimated + Gesture Handler

## Project Structure

```txt
app/                    Expo Router routes and screens
components/             Reusable UI and feature components
contexts/               Shared state providers
database/               WatermelonDB schema, models, migrations
hooks/                  Data and preferences hooks
services/               Business logic (expenses, recurring sync)
utils/                  Helpers (recurrence, CSV export)
scripts/                Local development scripts
```

## Prerequisites

- Node.js 20+ (recommended)
- Bun
- Android Studio (for Android emulator/device builds)
- Xcode (for iOS Simulator/device builds on macOS)

> Note: This project prefers **Bun** for dependency management and script execution.

## Getting Started

1. Install dependencies:

```bash
bun install
```

2. Start Metro:

```bash
bun run start
```

3. Run a platform build:

```bash
bun run android
# or
bun run ios
```

## Available Scripts

- `bun run start` - start Expo dev server
- `bun run android` - run Android build
- `bun run android:fast` - boot emulator with performance flags, then run Android
- `bun run ios` - run iOS build
- `bun run web` - run web target
- `bun run lint` - run Expo lint rules
- `bun run reset-project` - reset starter scaffold

## Notes

- This app uses native modules (for example WatermelonDB, Local Authentication, Quick Actions), so use native/dev builds (`expo run:*`) instead of relying only on Expo Go.
- On first launch, default categories are seeded automatically.
- Recurring rules generate pending expenses up to the current day; users can confirm or skip them.

## Data Model (high level)

- `categories`: name, icon
- `expenses`: amount, category, date, payment method, status, origin, recurrence relation
- `recurring_expense_rules`: interval config, next due date, active flag

## License

No license specified yet. Add one before public distribution.
