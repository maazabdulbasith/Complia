# Complia — System Architecture

## 1. Current Architecture (MVP — Pre-Production)

```
┌─────────────────────┐       ┌─────────────────────┐       ┌──────────────┐
│  React Router 7     │       │  Django REST         │       │  SQLite      │
│  (Vite + TailwindV4)│◄─────►│  Framework           │◄─────►│  db.sqlite3  │
│  Port 5173          │  API  │  Port 8001           │       │  (LOCAL FILE)│
│  TypeScript + React │       │  Python 3.11         │       │              │
│  19                 │       │  Django 5.2          │       │              │
└─────────────────────┘       └─────────────────────┘       └──────────────┘
         │                              │
         │                              │
    No Auth ⚠️                   No Auth ⚠️
    No SSR (client fetch)        CORS_ALLOW_ALL = True ⚠️
    No env-based API URL         SECRET_KEY in .env (insecure prefix) ⚠️
    in production                No rate limiting
                                 No logging/monitoring
```

### MVP Limitations (must fix before production)

| Issue | Severity | File |
|-------|----------|------|
| SQLite — single writer, no concurrency | 🔴 Critical | `settings.py:84-89` |
| `CORS_ALLOW_ALL_ORIGINS = True` | 🔴 Critical | `settings.py:133` |
| `ALLOWED_HOSTS = []` (empty) | 🟡 High | `settings.py:32` |
| SECRET_KEY has `django-insecure-` prefix | 🔴 Critical | `.env:1` |
| No authentication at all | 🔴 Critical | — |
| No tests (empty `tests.py`) | 🟡 High | `notices/tests.py` |
| `requirements.txt` has no pinned versions | 🟡 High | `requirements.txt` |
| Admin credentials `admin / password123` in docs | 🔴 Critical | `MVP_PLAN.md:81` |
| No pagination on notice search API | 🟡 High | `views.py:10` |
| No CI/CD pipeline | 🟡 High | — |
| `db.sqlite3` committed to repo | 🟡 High | `.gitignore` |
| `render.yaml` has `ALLOWED_HOSTS: '*'` | 🟡 High | `render.yaml:16` |

---

## 2. Target Production Architecture

```
                              ┌─────────────────────────────────┐
                              │         CDN (CloudFront/Vercel)  │
                              │  Static assets + React SSR      │
                              └───────────────┬─────────────────┘
                                              │
                         ┌────────────────────┼────────────────────┐
                         │                    │                    │
                ┌────────▼───────┐   ┌────────▼────────┐   ┌──────▼──────┐
                │  React Router 7│   │ React Router 7  │   │   Future:  │
                │  (Vercel Edge) │   │ (Vercel Edge)   │   │   Mobile   │
                │   Instance 1   │   │   Instance N    │   │   App      │
                └────────┬───────┘   └────────┬────────┘   └──────┬─────┘
                         │                    │                    │
                         └────────────────────┼────────────────────┘
                                              │ HTTPS + JWT
                              ┌───────────────▼───────────────┐
                              │        API Gateway / LB        │
                              │   (Rate Limit + Throttle)      │
                              └───────────────┬───────────────┘
                                              │
                         ┌────────────────────┼──────────────────┐
                         │                    │                  │
                ┌────────▼───────┐   ┌────────▼───────┐  ┌──────▼─────────┐
                │  Django API    │   │  Django API    │  │  Celery Worker │
                │  (Gunicorn)    │   │  (Gunicorn)    │  │  (OCR + AI)    │
                │  Instance 1   │   │  Instance N    │  │                │
                └────────┬───────┘   └────────┬───────┘  └──────┬─────────┘
                         │                    │                  │
                         └────────────────────┼──────────────────┘
                                              │
                    ┌─────────────┬───────────┼───────────┬──────────────┐
                    │             │           │           │              │
             ┌──────▼─────┐ ┌────▼────┐ ┌────▼────┐ ┌───▼───┐  ┌──────▼──────┐
             │ PostgreSQL │ │  Redis  │ │   S3    │ │ Sentry│  │ PGVector /  │
             │ (Supabase/ │ │ (Cache  │ │ (User   │ │  (Log │  │ Elasticsearch│
             │  Render)   │ │ + Queue)│ │  PDFs)  │ │  Mon.)│  │ (Semantic   │
             └────────────┘ └─────────┘ └─────────┘ └───────┘  │  Search)    │
                                                                └─────────────┘
```

### Technology Selection Rationale

| Component | Choice | Why |
|-----------|--------|-----|
| **Database** | PostgreSQL (Supabase or Render managed) | JSONB for varied notice schemas, full-text search built-in, PGVector extension for semantic search, row-level security |
| **Auth** | `django-allauth` + `djangorestframework-simplejwt` | Social login (Google), email/password, JWT for API, no vendor lock-in vs Firebase |
| **File Storage** | AWS S3 / Supabase Storage | User-uploaded notice PDFs/photos — encrypted at rest |
| **Task Queue** | Celery + Redis | Long-running OCR/AI jobs (Textract, Gemini API calls) |
| **Cache** | Redis | Session cache, API response cache, rate-limit counters |
| **Search** | PostgreSQL full-text → PGVector (Phase 2) | Start with `SearchVector` + `SearchRank`, upgrade to embeddings for "What does this notice mean?" semantic queries |
| **Monitoring** | Sentry (errors) + PostHog (analytics) | Free tiers sufficient for first 10K users |
| **CDN** | Vercel (frontend) or CloudFront | Edge SSR for React Router 7 + static asset caching |
| **CI/CD** | GitHub Actions | Lint → Test → Build → Deploy pipeline |

---

## 3. Project Structure (Current)

```
Complia/
├── manage.py                        # Django entrypoint
├── setup_data.py                    # Data seeding script (30K+ lines of hardcoded content)
├── db.sqlite3                       # ⚠️ SQLite database (must not be in prod)
├── .env                             # ⚠️ Contains django-insecure- SECRET_KEY
├── render.yaml                      # Render deployment config
├── requirements.txt                 # ⚠️ Unpinned: django, djangorestframework, django-cors-headers, python-dotenv
│
├── complia_backend/
│   ├── settings.py                  # Django config — needs env-based DB, CORS, ALLOWED_HOSTS
│   ├── urls.py                      # Router: /admin/, /api/notices/, /api/feedback/
│   ├── wsgi.py / asgi.py
│   └── notices/                     # THE core app (only app)
│       ├── models.py                # NoticeType (20 records), TriggerKeyword, NoticeFeedback
│       ├── views.py                 # 2 ViewSets: NoticeType (read-only), Feedback (write-only)
│       ├── serializers.py           # 3 serializers
│       ├── admin.py                 # Full admin with fieldsets + inline keywords
│       └── tests.py                 # ⚠️ EMPTY — no tests
│
└── complia_frontend/                # React Router 7 (Vite)
    ├── package.json                 # React 19, RR7, Tailwind v4, Vite 7
    └── app/
        ├── root.tsx                 # Layout + ErrorBoundary (Inter + Merriweather fonts)
        ├── routes.ts                # 2 routes: / (home), /notice/:id (details)
        ├── app.css                  # Tailwind v4 import + theme
        ├── api/client.ts            # 3 functions: searchNotices, getNotice, submitFeedback
        ├── types/notice.ts          # NoticeType interface + SearchResponse
        └── routes/
            ├── home.tsx             # Search page — glassmorphism UI, animated blobs
            └── notice_details.tsx   # Detail page — severity badges, feedback widget, "Find CA" CTA
```

---

## 4. Data Models

### NoticeType
Primary entity — 20 records currently (10 GST + 10 Income Tax).

| Field | Type | Searchable | Notes |
|-------|------|-----------|-------|
| `code` | CharField(50) unique | ✅ | e.g., `GST-ASMT-10` |
| `title` | CharField(200) | ✅ | Official name |
| `summary` | TextField | ✅ | 2-3 sentence overview |
| `detailed_explanation` | TextField | ❌ | Full deep-dive |
| `why_received` | TextField | ❌ | Emotional context |
| `common_mistakes` | TextField | ❌ | What people do wrong |
| `consequences_of_ignoring` | TextField | ❌ | Risks of inaction |
| `next_steps` | TextField | ❌ | Actionable steps |
| `severity` | CharField(10) choices | ❌ | `low`, `medium`, `high` |
| `source_section` | CharField(100) | ❌ | Legal reference |
| `verified_by` | CharField(100) nullable | ❌ | Expert who verified |
| `verified_at` | DateTimeField nullable | ❌ | Verification date |
| `is_active` | BooleanField (default=False) | ❌ | Feature flag per notice |
| `created_at` | auto_now_add | ❌ | |
| `updated_at` | auto_now | ❌ | |

### TriggerKeyword
Many-to-one → NoticeType. Maps user-friendly search terms (e.g., "scrutiny", "mismatch") to notice codes.

### NoticeFeedback
FK → NoticeType. Binary `is_helpful` + optional `comments`. No user association (anonymous).

---

## 5. API Design

| ViewSet | Endpoint | Method | Auth | Pagination | Notes |
|---------|----------|--------|------|------------|-------|
| NoticeTypeViewSet | `/api/notices/` | GET | None | None ⚠️ | Uses `SearchFilter` on code, title, triggers__keyword, summary |
| NoticeTypeViewSet | `/api/notices/{code}/` | GET | None | — | Lookup by `code` field |
| FeedbackViewSet | `/api/feedback/` | POST | None | — | Write-only, `CreateModelMixin` |

### API Gaps
- No pagination — will break with 500+ notices
- No throttling — vulnerable to abuse
- No versioning — `/api/v1/` needed for future breaking changes
- No structured error responses
- Feedback endpoint has no spam protection

---

## 6. Frontend Architecture

- **Framework**: React Router 7 (file-based routing via `routes.ts`)
- **Styling**: Tailwind CSS v4 (new `@import "tailwindcss"` syntax + `@theme`)
- **Fonts**: Inter (sans), Merriweather (serif) via Google Fonts CDN
- **Data Fetching**: Server-side loaders (RR7 `loader` pattern) — good SSR-ready pattern
- **State**: Minimal React `useState` — no global state library needed yet
- **API Client**: Raw `fetch()` calls in `api/client.ts` — no error retry, no caching

### Frontend Gaps
- No loading states / skeletons during search
- No SEO beyond basic `meta()` — no sitemap, no structured data
- "Find a Chartered Accountant" button is dead (no onclick)
- Frequent searches list is hardcoded with non-existent categories ("Strike Off", "PF Hearing", "Trademark Objection", "Speeding") — misleading
- No mobile-specific optimizations beyond responsive Tailwind
- No PWA / offline support
- No analytics tracking
