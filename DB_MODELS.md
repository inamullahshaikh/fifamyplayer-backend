# Database models (MongoDB / Mongoose)

**Source of truth:** all schemas are registered in `server.js` (there is no separate `models/` folder).

| Model name     | Mongoose collection | Purpose |
|----------------|---------------------|---------|
| `User`         | `users`             | Auth account, profile, active career link |
| `Player`       | `players`           | Career profile (one user can have multiple) |
| `SeasonData`   | `seasondatas`       | Per-season club/league stats row |
| `YearlyData`   | `yearlydatas`       | Per-calendar-year aggregates |
| `SeasonTrophy` | `seasontrophies`    | Club season trophies |
| `IntData`      | `intdatas`          | International season stats |
| `IntTrophy`    | `inttrophies`       | International trophies |
| `SeasonAwards` | `seasonawards`      | Season awards (quantity per award) |
| `Transfer`     | `transfers`         | Transfer history rows |

---

## User (`users`)

| Field | Type | Notes |
|-------|------|--------|
| `username` | String | Required, unique, trimmed |
| `name` | String | Trimmed, default `""` |
| `email` | String | Lowercase, sparse unique, default `null` |
| `passwordHash` | String | Required |
| `securityQuestion` | String | Preset question text |
| `securityAnswerHash` | String | |
| `passwordResetCodeHash` | String | Bcrypt hash of 6-digit reset code |
| `passwordResetCodeExpiresAt` | Date | |
| `activeCareerPlayerId` | ObjectId → `Player` | Selected career for data entry |
| `createdAt` / `updatedAt` | Date | `timestamps: true` |

---

## Player (`players`)

`playerId` here means **owning user** (legacy name).

| Field | Type | Notes |
|-------|------|--------|
| `name` | String | |
| `rating` | String | |
| `nationality` | String | |
| `position` | String | |
| `value` | Number | |
| `retired` | Boolean | Default `false` |
| `avatarUrl` | String | R2 URL or local `/uploads/avatars/...` |
| `playerId` | ObjectId → `User` | Indexed |
| `createdAt` / `updatedAt` | Date | `timestamps: true` |

---

## SeasonData (`seasondatas`)

`playerId` = **career** `Player._id`, not user id.

| Field | Type | Notes |
|-------|------|--------|
| `season` | String | |
| `competition` | String | |
| `apps` | Number | |
| `goals` | Number | |
| `assists` | Number | |
| `avgrating` | Number | |
| `finish` | String | League place / cup outcome label |
| `team` | String | |
| `playerId` | ObjectId → `Player` | Indexed |

---

## YearlyData (`yearlydatas`)

| Field | Type | Notes |
|-------|------|--------|
| `year` | String | |
| `goals` | Number | |
| `assists` | Number | |
| `playerId` | ObjectId → `Player` | Indexed |

---

## SeasonTrophy (`seasontrophies`)

| Field | Type | Notes |
|-------|------|--------|
| `season` | String | |
| `competition` | String | |
| `playerId` | ObjectId → `Player` | Indexed |

---

## IntData (`intdatas`)

| Field | Type | Notes |
|-------|------|--------|
| `season` | String | |
| `competition` | String | |
| `apps` | Number | |
| `goals` | Number | |
| `assists` | Number | |
| `avgrating` | Number | |
| `finish` | String | Stage / place / qualifier label |
| `playerId` | ObjectId → `Player` | Indexed |

---

## IntTrophy (`inttrophies`)

| Field | Type | Notes |
|-------|------|--------|
| `season` | String | |
| `competition` | String | |
| `playerId` | ObjectId → `Player` | Indexed |

---

## SeasonAwards (`seasonawards`)

| Field | Type | Notes |
|-------|------|--------|
| `season` | String | |
| `award` | String | |
| `quantity` | Number | |
| `playerId` | ObjectId → `Player` | Indexed |

---

## Transfer (`transfers`)

| Field | Type | Notes |
|-------|------|--------|
| `season` | String | |
| `from` | String | |
| `to` | String | |
| `value` | String | |
| `playerId` | ObjectId → `Player` | Indexed |

---

## Career-owned models

`SeasonData`, `YearlyData`, `SeasonTrophy`, `IntData`, `IntTrophy`, `SeasonAwards`, and `Transfer` are grouped in code as `CAREER_OWNED_MODELS`: each row is scoped by `playerId` → `Player`.
