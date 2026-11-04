# SmartStudy AI: Intelligent Study Planner

A college project that combines **Generative AI (Google Gemini)** with a **deterministic scheduling algorithm**
to build personalised daily and weekly study timetables from your subjects, exams, marks, difficulty and
available time. It tracks progress and reschedules missed sessions.

> **Important honesty note.** The scheduling algorithm is plain JavaScript rules. It is **not** a trained
> machine-learning model. Gemini only gives *suggestions*; the algorithm checks and enforces every hard rule.
> If Gemini fails, the app shows the real error. It never makes up an AI answer.

---

## 1. How the AI part works

| Stage | What happens | Where |
|---|---|---|
| **A. Academic analysis** | Gemini receives your subjects, marks, topics, exams, deadlines and availability and returns *structured JSON*: focus topics, a learning/revision/practice mix, a priority nudge (max ±10 points) and a short note per subject. | `server/services/geminiService.js` |
| **B. Scheduling algorithm** | The JSON is validated and repaired, then a rule-based algorithm builds the timetable: priority scores, availability, breaks, daily limits, no overlaps, deadlines, conflicts reported. | `server/services/schedulingService.js` |
| **C. Adaptation** | Completing, skipping or partly completing a session updates progress. Unfinished work is rescheduled into free slots, after you confirm a preview. Gemini can optionally add advice. | `server/controllers/sessionController.js` |

### The priority formula (documented in `schedulingService.js`)

```
Priority = 100 x (0.40 x ExamUrgency + 0.30 x PerformanceGap + 0.20 x Difficulty + 0.10 x Workload)
```

Each component is first scaled to 0..1:

* **ExamUrgency**: 1 when the exam is today, falling to 0 at 30+ days away, scaled by exam importance. No exam means 0.
* **PerformanceGap**: (target% minus current%) / 50, limited to 0..1.
* **Difficulty**: (difficulty - 1) / 4.
* **Workload**: this subject's remaining minutes / the largest remaining minutes among your subjects.

Change the weights or limits in `SCHEDULING_CONFIG` at the top of `schedulingService.js`.

### Hard rules the algorithm always enforces

Sessions are never scheduled outside your study days/hours, on rest days, over weekly commitments, on an exam
date (a subject's sessions are always *before* its exam), in the past, across midnight, or overlapping. Breaks and
the daily limit are respected, and the same subject is not studied for too long in a row. If the work does not
fit, you get a **conflict report** with the exact shortfall instead of a silently impossible plan.

---

## 2. Technology

* **Frontend:** React 18, Vite, React Router, Lucide icons, Recharts, plain CSS (design tokens, light/dark).
* **Backend:** Node.js, Express, REST API, dotenv, zod validation, helmet, express-rate-limit.
* **AI:** Google Gemini via the official **`@google/genai`** SDK, called **only from the backend**.
* **Storage:** one JSON file with safe atomic writes, a `.bak` backup and corruption recovery (no database to install).
* **Auth:** bcrypt-hashed passwords; login is a signed token in an **httpOnly cookie** (JavaScript cannot read it).

---

## 3. Before you start

Install:

1. **Node.js 20 LTS** (Node 18.18 or newer also works): <https://nodejs.org>
2. **Visual Studio Code**: <https://code.visualstudio.com>

Check Node in a terminal (PowerShell):

```powershell
node --version
npm --version
```

---

## 4. Project structure

```
smartstudy-ai/
├── .gitignore
├── README.md
├── client/                      React frontend (Vite)
│   ├── index.html  package.json  vite.config.js  .env.example
│   └── src/
│       ├── main.jsx  App.jsx
│       ├── components/          Button, Card, Modal, Field, Alert, SessionRow, ...
│       ├── context/             Auth, Theme, Toast
│       ├── hooks/               useFetch, useLocalStorage, useDocumentTitle
│       ├── layouts/             AppLayout (sidebar), PublicLayout
│       ├── pages/               Landing, Login, Register, Dashboard, Subjects, Exams,
│       │                        Availability, Planner, Timetable, Progress, Assistant, Settings
│       ├── services/            api.js (fetch wrapper), endpoints.js (every API call)
│       ├── styles/              tokens.css, base.css, components.css, layout.css, ...
│       └── utils/
└── server/                      Express backend
    ├── package.json  .env.example  config.js  app.js  server.js
    ├── controllers/  routes/  middleware/  validation/  utils/
    ├── services/                geminiService.js, schedulingService.js, planService.js, statsService.js
    ├── database/                jsonStore.js, seed.js, defaults.js, index.js
    └── tests/                   scheduling.test.js
```

---

## 5. Setup, step by step (Windows + VS Code + PowerShell)

### 5.1 Open the project

In VS Code choose **File > Open Folder** and pick the `smartstudy-ai` folder. Open a terminal with **Terminal > New Terminal**.

### 5.2 Get a Gemini API key

1. Go to **Google AI Studio**: <https://aistudio.google.com/apikey> and sign in with a Google account.
2. Click **Create API key** (choose or create a project) and copy the key.
3. Keep it secret. Never paste it into code, screenshots, GitHub, or the `client` folder.
4. Pick a model name. Open <https://ai.google.dev/gemini-api/docs/models> and choose a current **Flash**
   model that supports structured JSON output (Flash models are fast and cheap). Model names change over time and
   old ones are retired, so use one that is listed there today. You will enter it as `GEMINI_MODEL`.

### 5.3 Configure and start the backend

```powershell
cd server
npm install
Copy-Item .env.example .env
notepad .env
```

Edit `server/.env`:

| Variable | What to put |
|---|---|
| `GEMINI_API_KEY` | the key you copied |
| `GEMINI_MODEL` | the model name from the models page (for example the Flash model you chose) |
| `SESSION_SECRET` | a long random string. Generate one with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT` | `5000` (leave as is) |
| `CLIENT_URL` | `http://localhost:5173` (leave as is) |
| `DATABASE_PATH` | `./database/smartstudy.json` (leave as is) |
| `GEMINI_TIMEOUT_MS` | optional, default `45000` |

Save the file, then start the server:

```powershell
npm run dev
```

You should see `SmartStudy AI server running on http://localhost:5000`. Open
<http://localhost:5000/api/health>. You should see `{"status":"ok", ...}`.
Leave this terminal running.

### 5.4 Start the frontend (second terminal)

Open a **new** terminal (the **+** button in the terminal panel):

```powershell
cd client
npm install
npm run dev
```

Open **<http://localhost:5173>** in your browser. **Always use port 5173** (the Vite server forwards `/api`
to the backend, which makes the login cookie work).

### 5.5 Which variables go where

* **Server (`server/.env`, secret):** `GEMINI_API_KEY`, `GEMINI_MODEL`, `SESSION_SECRET`, `PORT`, `CLIENT_URL`, `DATABASE_PATH`, `GEMINI_TIMEOUT_MS`.
* **Client (`client/.env`, optional and PUBLIC):** only `VITE_API_BASE_URL` and `VITE_DEV_API_TARGET`. **Never put a secret in the client folder.** Anything starting with `VITE_` is visible in the browser.

---

## 6. First-time walkthrough

1. **Register** an account (or use the demo account, see section 7).
2. **Subjects**: add subjects with difficulty, current and target marks, workload hours and topics.
3. **Exams & assignments**: add exam dates and importance, and any assignment deadlines.
4. **Availability**: set study days, hours, session length, breaks, rest days and commitments. Press **Save**.
5. **AI Planner**: click **Generate AI Study Plan**. Read the priorities, advice and the plan.
6. **Timetable**: open the Day, Week or Calendar view.
7. **Mark a session done** (tick the box or open it). Sessions can be completed on the day they take place.
8. **Progress**: see your hours, streaks and charts update.
9. **Missed something?** Open the session, choose **Missed or skipped**, review the preview and press **Apply**.

---

## 7. Optional demo data

```powershell
cd server
npm run seed
```

Creates one clearly labelled **demo account** with sample subjects, exams and assignments:

* email `demo@smartstudy.local`  password `Demo@12345`

It never touches other accounts and creates **no fake progress or sessions**. Generate a plan and complete
sessions yourself. To recreate it: `npm run seed -- --reset`.

---

## 8. Tests

```powershell
cd server
npm test
```

Runs the 35 scheduling unit tests (priority maths, overlaps, availability rules, plan generation, conflicts,
AI-response validation, rescheduling). They need no `.env` file and no Gemini key.

---

## 9. API reference

All routes are under `/api`. Everything except health, register and login needs the login cookie. Each student can
only access their own data (other students' records answer 404).

| Area | Endpoints |
|---|---|
| Health | `GET /health` |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `PUT /auth/profile` |
| Subjects | `GET`, `POST /subjects`; `PUT`, `DELETE /subjects/:id` |
| Exams | `GET`, `POST /exams`; `PUT`, `DELETE /exams/:id` |
| Assignments | `GET`, `POST /assignments`; `PUT`, `DELETE /assignments/:id` |
| Availability | `GET /availability`, `PUT /availability` |
| Study plans | `GET /study-plans`; `POST /study-plans/generate` (scheduler only, no AI); `GET`, `PUT /study-plans/:id` |
| Sessions | `GET`, `POST /sessions`; `PUT`, `DELETE /sessions/:id`; `POST /sessions/:id/complete`; `POST /sessions/:id/skip`; `POST /sessions/:id/reschedule`; `GET /sessions/:id/slots`; `POST /sessions/reschedule-missed` |
| AI | `GET /ai/status`; `POST /ai/test`; `POST /ai/generate-study-plan`; `POST /ai/assistant` |
| Statistics | `GET /dashboard`, `GET /progress` |

Errors always look like `{ "error": { "message", "code?", "details?" } }`. AI errors have codes starting with `AI_`.

---

## 10. Your data

* Stored in `server/database/smartstudy.json` (created on first run). It contains student data and password
  hashes, and is excluded from git.
* Every change is written to a temporary file and renamed, and the previous version is kept as `smartstudy.json.bak`.
* If the main file is damaged, the server restores from `.bak` and keeps the damaged file as `smartstudy.json.corrupt-<time>`.
* **To reset everything**, stop the server and delete the `server/database/smartstudy.json*` files.
* **To back up**, copy `smartstudy.json` somewhere safe while the server is stopped.

---

## 11. Security notes

* The Gemini key lives only in `server/.env` and is used only by the backend. The Settings page shows it masked (last 4 characters).
* Passwords are hashed with bcrypt. The login cookie is `httpOnly`, `sameSite=lax`, and `secure` in production.
* All inputs are validated with zod. Records are checked for ownership on every request.
* AI endpoints are rate-limited per user. AI output is treated as untrusted data: it is validated, clamped, and shown as plain text.
* This is a local college project. Before any public deployment you would still need HTTPS, a real database,
  and a security review.

---

## 12. Troubleshooting

| Problem | What to do |
|---|---|
| PowerShell says `npm.ps1 cannot be loaded because running scripts is disabled` | Run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then reopen the terminal. |
| Server stops with `SESSION_SECRET is missing or too weak` | Edit `server/.env` and set a long random `SESSION_SECRET` (command in section 5.3). |
| `Port 5000 is already in use` | Close the other program or change `PORT` in `server/.env` (and `VITE_DEV_API_TARGET` in `client/.env`). |
| Browser shows **Cannot reach the SmartStudy server** | The backend is not running. Start it with `npm run dev` in `server`. |
| Login works but you are sent back to the login page | Open the app at `http://localhost:5173`, not `:5000`, and make sure `CLIENT_URL` is exactly that. |
| `vite` fails with `Port 5173 is already in use` | Close the other Vite window. The port is fixed on purpose so the cookie and CORS settings match. |
| `The requested module ... does not provide an export named X` (from lucide-react) | An icon name is not available in your installed version. Replace that icon name with another icon, or run `npm install lucide-react@latest` in `client`. |
| **AI_NOT_CONFIGURED** | `GEMINI_API_KEY` or `GEMINI_MODEL` is missing in `server/.env`. Fill both in and restart the server. |
| **AI_AUTH** | The API key is wrong or not allowed. Create a new key in Google AI Studio and update `.env`. |
| **AI_MODEL** (model not found) | `GEMINI_MODEL` is not valid any more. Choose a current model from the models page and restart. |
| **AI_RATE_LIMIT** | Gemini quota or rate limit reached. Wait a minute, or check your quota in Google AI Studio. |
| **AI_TIMEOUT / AI_NETWORK / AI_UNAVAILABLE** | Check your internet connection and try again. You can use **Generate without AI** meanwhile. |
| **AI_INVALID_RESPONSE / AI_TRUNCATED / AI_EMPTY** | Gemini returned unusable output. Try again. If it keeps happening, try a different model. |
| **AI_BAD_REQUEST** | Often the chosen model does not support structured JSON output. Try another Flash model. |
| "Add at least one subject first" when generating a plan | Add a subject and check Availability (at least one study day). |
| "Not everything fits in your available time" | Not an error. Add study days, widen your daily window, raise the daily limit, or move deadlines. |
| Data seems lost | Look for `server/database/smartstudy.json.bak` and `smartstudy.json.corrupt-*`. |
| `npm install` fails | Check `node --version` (needs 18.18+), your internet connection, and try again. |

---

## 13. Production build (optional)

```powershell
cd client
npm run build
cd ../server
$env:NODE_ENV="production"
npm start
```

In production mode the server also serves `client/dist`, and the login cookie is marked `secure`, so it needs
**HTTPS**. Over plain `http://` the login will not stick. For demos on your own computer use the development
mode in section 5.

---

## 14. What was and was not verified when this project was generated

Run in the generation sandbox (no internet access): the 35 scheduling unit tests, a backend smoke test of the
controllers with the real JSON store (Gemini replaced by a stub), persistence and corruption-recovery checks, syntax
parsing of all frontend files, import/export and CSS-class consistency checks, and a cross-check that all 38 frontend API
calls match real backend routes.

**Not run in the sandbox, so please check on your computer:** `npm install`, the Express routing and zod validation
layer, authentication cookies, a real Gemini request, `vite build`, how the pages look and behave in a browser
(including dark mode and phones), screen-reader accessibility, and everything on Windows.

## 15. Known limitations

* The JSON file store suits one student's local use. It is not meant for many simultaneous users.
* "Today" and "now" use the server computer's clock and time zone.
* The scheduler plans up to 28 days ahead and uses simple, explainable rules rather than an optimal solver.
* Chat history with the assistant is not saved between page reloads.