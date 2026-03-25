# Complia — MVP Plan & Go-to-Production Roadmap

## Current State: MVP Complete, Not Production-Ready

The MVP proves the concept works. The search → explain → feedback loop is functional. But deploying this to real users in its current state would be irresponsible (SQLite, no auth, no tests, hardcoded secrets).

---

## Phase 0: Foundation Hardening (Weeks 1–2)
**Goal**: Make the codebase deployable and secure. Zero new features.

### Deliverables

| Task | File(s) to Change | Priority |
|------|--------------------|----------|
| Switch to PostgreSQL (Supabase/Render managed) | `settings.py`, `requirements.txt`, new `DATABASE_URL` env | P0 |
| Pin ALL dependency versions | `requirements.txt` → use `pip freeze` | P0 |
| Generate proper `SECRET_KEY`, remove insecure one | `.env`, `settings.py` | P0 |
| Lock down CORS to specific origins | `settings.py:133`, `render.yaml:18` | P0 |
| Set `ALLOWED_HOSTS` properly | `settings.py:32`, `render.yaml:16` | P0 |
| Add `.env` and `db.sqlite3` to `.gitignore` | `.gitignore` | P0 |
| Add API pagination (PageNumberPagination) | `settings.py` (REST_FRAMEWORK config), `views.py` | P0 |
| Add API throttling | `settings.py` (REST_FRAMEWORK DEFAULT_THROTTLE) | P0 |
| Add API versioning (`/api/v1/`) | `urls.py` | P1 |
| Write basic tests (model creation, API endpoints) | `notices/tests.py` | P1 |
| Set up GitHub Actions CI (lint + test + build) | `.github/workflows/ci.yml` | P1 |
| Remove admin credentials from docs | `MVP_PLAN.md` | P0 |
| Add `collectstatic` to build command | `render.yaml` | P1 |
| Add Sentry for error monitoring | `settings.py`, `requirements.txt` | P1 |

### Exit Criteria
- [ ] All tests pass
- [ ] App connects to PostgreSQL
- [ ] `SECRET_KEY` is randomly generated and not in repo
- [ ] CORS is locked to frontend domain
- [ ] CI pipeline runs on every PR

---

## Phase 1: Auth + Content Scale (Weeks 3–5)
**Goal**: Users can create accounts. Notice library grows to 100+.

### Deliverables

| Task | Notes |
|------|-------|
| User auth with `django-allauth` + `simplejwt` | Email/password + Google OAuth |
| User model extension (profile, saved notices) | Custom user model or profile FK |
| JWT middleware for API | Protected endpoints for user-specific features |
| "My Saved Notices" endpoint | CRUD for user bookmarks |
| Expand notice content to 100+ notices | GST: 40+, IT: 40+, Labor: 10+, Company: 10+ |
| Content management workflow via Admin | Bulk import, content review status |
| Sitemap + structured data (JSON-LD) for SEO | Every notice page should be indexable |
| Analytics integration (PostHog/Mixpanel) | Track search terms, notice views, feedback |

### Exit Criteria
- [ ] Users can sign up, log in, save notices
- [ ] 100+ notices with complete content
- [ ] Organic search traffic begins

---

## Phase 2: AI Notice Parsing — The Differentiator (Weeks 6–10)
**Goal**: Upload a photo/PDF of your notice → AI tells you what it is.

### Deliverables

| Task | Tech |
|------|------|
| File upload endpoint (PDF, JPG, PNG) | Django + S3 storage |
| OCR pipeline | AWS Textract or Google Vision API |
| LLM classification | Gemini 2.5 / GPT-4o — "This looks like a DRC-01" |
| Data extraction | Demand amount, due date, financial year, assessing officer |
| Personalized risk assessment | Based on extracted data + notice type |
| Celery + Redis for async processing | OCR + AI calls take 5-30 seconds |
| Usage metering | Free: 3 parses/month, Pro: unlimited |
| Result history | Users can view past parses |

### Exit Criteria
- [ ] 80%+ accuracy on notice classification (tested on 50+ real notices)
- [ ] Response time < 30 seconds for upload → result
- [ ] Free/Pro usage limits enforced

---

## Phase 3: Monetization + Marketplace (Weeks 11–16)
**Goal**: Revenue generation begins.

### Deliverables

| Task | Revenue Model |
|------|---------------|
| CA directory (verified profiles) | CAs pay ₹999-2999/month for premium listing |
| Lead routing ("Find a CA" → real CAs) | Per-lead fee: ₹50-200/lead |
| Stripe/Razorpay payment integration | Subscription billing |
| Pro subscription (₹299/month) | Unlimited AI parses + reply templates + priority CA access |
| Reply template generator | Pre-filled legal templates → PDF download |
| Deadline reminders (email + WhatsApp) | Value-add for Pro users |
| Admin dashboard for CAs | View leads, manage profile, track conversions |

### Exit Criteria
- [ ] 10+ CAs onboarded with paid profiles
- [ ] 100+ Pro subscribers
- [ ] MRR > ₹50,000

---

## Team Requirements

| Phase | Roles Needed | Estimated Monthly Cost (India) |
|-------|-------------|-------------------------------|
| Phase 0-1 | 1 Full-stack dev (you) | ₹0 (founder) |
| Phase 2 | + 1 ML/AI engineer (part-time) | ₹40-60K/month |
| Phase 3 | + 1 Business dev / CA partnerships | ₹30-50K/month |
| Scale | + 1 Content writer (legal background) | ₹25-40K/month |

---

## Quick Start (Development)

**Backend:**
```bash
cd c:\Projects\Complia
.\complia_backend\venv\Scripts\Activate.ps1
python manage.py runserver 8001
```

**Frontend:**
```bash
cd c:\Projects\Complia\complia_frontend
npm run dev
```

**URLs:**
- Frontend: http://localhost:5173
- API: http://127.0.0.1:8001/api/notices/
- Admin: http://127.0.0.1:8001/admin/
