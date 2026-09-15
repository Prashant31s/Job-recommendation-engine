# Job Match API

A rule-based job recommendation REST API that ranks jobs for candidates using a transparent, explainable scoring formula across four dimensions: **skills**, **experience**, **location**, and **salary**.

---

## Quick Start

Prerequisites: Node.js 20+, PostgreSQL running locally

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and configure your local DB
cp .env.example .env
# Edit DATABASE_URL in .env to point to your local Postgres

# 3. Run migrations and generate Prisma client
npm run db:migrate
npm run db:generate

# 4. (Optional) Seed sample data
npm run db:seed

# 5. Start the dev server with hot reload
npm run dev
```

---

## API Endpoints

### Health

| Method | Path      | Description    |
|--------|-----------|----------------|
| GET    | `/health` | Health check   |

### Candidates

| Method | Path                               | Description                       |
|--------|------------------------------------|-----------------------------------|
| POST   | `/candidates`                      | Create a candidate profile        |
| GET    | `/candidates`                      | List all candidates               |
| GET    | `/candidates/:id`                  | Get a candidate by ID             |
| GET    | `/candidates/:id/recommendations`  | Get ranked job recommendations    |

### Jobs

| Method | Path                       | Description                          |
|--------|----------------------------|--------------------------------------|
| POST   | `/jobs`                    | Create a job posting                 |
| GET    | `/jobs`                    | List all jobs                        |
| GET    | `/jobs/:id`                | Get a job by ID                      |
| GET    | `/jobs/:id/recommendations`| Get best-fit candidates for a job    |

---

## Request / Response Examples

### Create a Candidate

```http
POST /candidates
Content-Type: application/json

{
  "name": "Alice Chen",
  "skills": ["TypeScript", "Node.js", "PostgreSQL", "Redis"],
  "yearsOfExperience": 6,
  "location": "New York",
  "expectedSalary": 130000
}
```

### Create a Job

```http
POST /jobs
Content-Type: application/json

{
  "title": "Senior Backend Engineer",
  "requiredSkills": [
    { "skill": "TypeScript", "type": "must-have" },
    { "skill": "Node.js",    "type": "must-have" },
    { "skill": "Redis",      "type": "nice-to-have" },
    { "skill": "GraphQL",    "type": "nice-to-have" }
  ],
  "minYearsExperience": 5,
  "location": "New York",
  "salaryMin": 120000,
  "salaryMax": 150000,
  "remoteAllowed": false
}
```

### Get Recommendations

```http
GET /candidates/{id}/recommendations?limit=5
```

**Response:**

```json
{
  "candidateId": "...",
  "candidateName": "Alice Chen",
  "weights": { "skills": 50, "experience": 20, "location": 15, "salary": 15 },
  "totalMatches": 3,
  "recommendations": [
    {
      "jobId": "...",
      "title": "Senior Backend Engineer",
      "location": "New York",
      "remoteAllowed": false,
      "salaryRange": { "min": 120000, "max": 150000 },
      "totalScore": 95,
      "breakdown": {
        "skills":     { "score": 50, "max": 50 },
        "experience": { "score": 20, "max": 20 },
        "location":   { "score": 15, "max": 15 },
        "salary":     { "score": 10, "max": 15 }
      }
    }
  ]
}
```

### Configurable Weights

Override the default weights per-request. All four must be provided and must sum to 100:

```http
GET /candidates/{id}/recommendations?weights[skills]=60&weights[experience]=15&weights[location]=15&weights[salary]=10
```

---

## Scoring Formula

### Weights

| Dimension  | Default | Max | Rationale |
|------------|---------|-----|-----------|
| Skills     | 50      | 50  | The primary signal in technical hiring — the heaviest weight |
| Experience | 20      | 20  | Meaningful, but not deterministic — a fast learner beats a slow veteran |
| Location   | 15      | 15  | Important, but remote work is the norm — lower than skills/experience |
| Salary     | 15      | 15  | Negotiable — a job whose ceiling is close to expectation still deserves visibility |

### Skills (0 – 50 pts)

```
must-have skills missing?  →  job is EXCLUDED (hard filter, score = null)
all must-haves present     →  30 pts base (60% of weight)
each nice-to-have matched  →  +20 / total_nice_to_haves pts (up to 20 pts)
no nice-to-haves defined   →  20 pts awarded automatically
```

**Why 60/40 split?** Must-have skills are binary gates — meeting them deserves a solid base reward. Nice-to-have skills are differentiators, so they get the remaining 40% as an incremental boost.

### Experience (0 – 20 pts)

```
candidate.years >= job.minYears  →  20 pts (full score)
candidate.years <  job.minYears  →  20 × (candidate.years / job.minYears)
minYears = 0                     →  20 pts (no minimum)
```

**Why penalise instead of exclude?** Strict exclusion creates invisible dead zones — a candidate 1 year short of a 5-year requirement is likely qualified, and the job should appear in their results so they can self-select. The linear formula lets the overall score naturally deprioritise heavily underqualified candidates (a 0-year candidate for an 8-year role scores 0 on this dimension) without arbitrary cutoffs that the candidate never sees.

### Location (0 – 15 pts)

```
exact location match            →  15 pts (100%)
remoteAllowed = true, no match  →  10 pts (67%)
no match, not remote            →   0 pts
```

**Why 67% for remote?** Remote is a good option but imposes coordination costs (timezone, travel). An exact match is still preferable and should score higher.

### Salary (0 – 15 pts)

```
expectedSalary ≤ salaryMax      →  15 pts  (job can meet or exceed expectation)
expectedSalary >  salaryMax     →  15 × (salaryMax / expectedSalary)
```

**Why not hard-filter on salary?** Salary is the most negotiable dimension. A job whose max is $5K below expectation shouldn't be invisible — the candidate may still apply. But a job whose ceiling is half the expectation should rank very low, which the formula achieves naturally.

---

## Running Tests

```bash
# All tests
npm test

# Unit tests only (scoring logic, no DB needed)
npm run test:unit

# Integration tests (requires a running DB)
npm run test:integration
```

The unit tests cover all edge cases directly relevant to the scoring logic:

- ✅ Candidate missing a must-have skill → hard-filtered
- ✅ All skills matched → 50/50
- ✅ Partial nice-to-have match → proportional score
- ✅ Experience below minimum → penalized, not excluded
- ✅ Location: exact / remote / mismatch tiers
- ✅ Salary: within range / job pays more / job can't meet expectation
- ✅ Total score = sum of all dimensions
- ✅ Configurable weights respected
- ✅ Ranking order is descending by total score
- ✅ `limit` parameter works correctly

---

## Assumptions Made

1. **Skill matching is case-insensitive** — `"typescript"` matches `"TypeScript"`.
2. **No minimum for nice-to-have skills** — a job with zero nice-to-have skills awards the full nice-to-have pool (20 pts) to any candidate who passes the must-have filter, since there's nothing to differentiate on.
3. **Salary is candidate's expectation, not current salary** — treated as the minimum they'd accept.
4. **Multiple jobs with the same score** — sorted by insertion order (createdAt is not used as tiebreaker, but could be).
5. **Configurable weights must sum to 100** — partial overrides are accepted; if any weight key is provided, all four must be given.

## What I'd Do Differently With More Time

- **Pagination** — use cursor-based pagination instead of a simple `limit` for `/candidates` and `/jobs` lists.
- **Skill taxonomy** — normalise synonyms (e.g. `"Node"` = `"Node.js"` = `"NodeJS"`) via a small skill alias table.
- **Caching** — cache recommendation results in Redis with a short TTL; invalidate when candidate/job data changes.
- **Audit log** — record every recommendation call so you can see how scores drift as skills/jobs change.
- **Better weight validation** — expose a `GET /scoring/defaults` endpoint and document the weight schema in OpenAPI/Swagger.
- **OpenAPI spec** — auto-generate Swagger UI for interactive endpoint exploration.

---

## AI Tool Usage

This project was built with AI assistance (Antigravity / Claude). The following areas involved direct AI generation with minimal editing:

- Boilerplate scaffolding (package.json, tsconfig)
- Prisma schema and seed data
- Express app/route/controller structure

The following were reviewed and adjusted manually:

- **Scoring formula weights and rationale** — the 60/40 must-have/nice-to-have split and the "penalise not exclude" philosophy were deliberate design decisions, not defaults.
- **Edge case handling in `scoreSalary`** — the `salaryMax = 0` edge case and exact-boundary (`expectedSalary === salaryMax`) were added after reviewing the AI output.
- **Test cases** — AI-generated test scaffolding was extended with additional boundary tests (0-year experience, salary exactly at max, case-insensitive location, etc.)

---

## Project Structure

```
job-match-api/
├── src/
│   ├── app.ts                        # Express setup
│   ├── server.ts                     # Entry point
│   ├── routes/
│   │   ├── candidates.ts
│   │   └── jobs.ts
│   ├── controllers/
│   │   ├── candidateController.ts
│   │   └── jobController.ts
│   ├── services/
│   │   ├── scoringService.ts         # ← Core scoring logic
│   │   └── recommendationService.ts
│   ├── schemas/
│   │   ├── candidateSchema.ts
│   │   └── jobSchema.ts
│   └── prisma/
│       └── client.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── tests/
│   ├── scoring.test.ts               # ← Unit tests (no DB)
│   └── api.test.ts                   # ← Integration tests
└── .env.example
```
