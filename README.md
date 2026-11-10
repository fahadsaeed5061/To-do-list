# Daymark

A responsive to-do planner with an Express REST API, MongoDB persistence, calendar views, task filtering, dashboard statistics, and downloadable/restorable JSON backups.

## Requirements

- Node.js 18 or newer
- MongoDB Community Server running locally, or a MongoDB Atlas connection string

## Install and configure

1. Install the project dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB connection string. For a local MongoDB server, the example URI works as-is:

   ```env
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/daymark
   BACKUP_CRON=0 2 * * *
   CORS_ORIGIN=http://localhost:3000
   ```

   `BACKUP_CRON` uses standard cron syntax and defaults to 2:00 AM in the server's local time zone. Keep `.env` private; it is excluded from Git.

3. Start MongoDB, then start the application:

   ```sh
   npm start
   ```

   For development with automatic server restarts, use `npm run dev`.

4. Open [http://localhost:3000](http://localhost:3000). Express serves both the frontend and API, so no separate frontend server is required. Check [http://localhost:3000/api/health](http://localhost:3000/api/health) to confirm the API is responding.

## Features

- Add, edit, complete, and delete tasks, with title, description, date, optional time, priority, and category.
- Dashboard totals, overdue and today's task counts, and monthly completion statistics update as tasks change.
- Search and sort tasks; filter by today, yesterday, week, month, date, month, year, or a custom date range.
- Calendar month, week, and day views; dates with tasks are marked, and a selected date can be used to create a task.
- Light/dark appearance preference saved in the browser.
- MongoDB-backed task and backup APIs.
- Scheduled automatic daily backups, manual snapshots, backup history, JSON downloads, and JSON restore. Restore validates the input, asks for confirmation, and saves the existing task list as a recovery backup first.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/tasks` | List tasks |
| `POST` | `/api/tasks` | Create a task |
| `PUT` | `/api/tasks/:id` | Update a task |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `GET` | `/api/backups` | List recent backup metadata |
| `POST` | `/api/backups/manual` | Create a manual snapshot |
| `GET` | `/api/backups/:id/download` | Download a snapshot as JSON |
| `POST` | `/api/backups/restore` | Validate and restore a `tasks` array |

JSON backup files use the `daymark-backup` format and contain a `tasks` array. The restore endpoint also accepts a plain JSON object containing that array.

## Validation

Run the built-in JavaScript syntax checks with `npm run check`.
