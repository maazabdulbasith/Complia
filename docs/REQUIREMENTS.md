# Complia — Requirements & Current Status

## Overview
Complia simplifies complex legal and compliance notices for Indian taxpayers. Users search for a GST or Income Tax notice code, and get plain-English explanations, risk assessment, and actionable next steps — eliminating the need to parse dense legal language or immediately hire a CA.

**Target Users** (in priority order):
1. **Individual taxpayers** — received a scary notice, need to understand it NOW
2. **Small business owners** — GST compliance is a constant pain point
3. **Chartered Accountants / Tax professionals** — quick reference tool, potential lead-gen channel
4. **CA firms** — premium directory listing, client acquisition

---

## Current Status: ✅ MVP Complete | ❌ Not Production-Ready

### What Works
| Feature | Status | Quality |
|---------|--------|---------|
| Notice search (by code or keyword) | ✅ Working | Basic — no fuzzy matching, no typo tolerance |
| Notice detail view (full explanation) | ✅ Working | Good content quality across 20 notices |
| Severity badges (Low / Medium / High) | ✅ Working | Visual + labeled |
| Feedback widget (thumbs up/down + comment) | ✅ Working | Anonymous, no spam protection |
| Trigger keyword search | ✅ Working | Maps colloquial terms to official codes |
| Animated glassmorphism UI | ✅ Working | Premium-feeling, responsive |
| Django Admin for content management | ✅ Working | Full CRUD with inline keywords |
| Data seeding (20 notices) | ✅ Working | Idempotent `update_or_create` pattern |

### What's Missing for Production
| Gap | Impact | Priority |
|-----|--------|----------|
| No user authentication | Can't track users, no personalization, no premium tier | P0 |
| No pagination on API | Will break at scale (500+ notices) | P0 |
| SQLite database | Single writer, no concurrency, will corrupt under load | P0 |
| No rate limiting | API vulnerable to scraping/abuse | P0 |
| No tests | Zero confidence in deployability | P0 |
| No CI/CD | Manual deployment = human error | P1 |
| No monitoring / logging | Can't diagnose production issues | P1 |
| "Find CA" button is dead | Core monetization CTA doesn't work | P1 |
| Only 20 notices | Need 200+ for credibility in market | P1 |
| No API versioning | Breaking changes will brick mobile apps | P2 |

---

## Content Coverage

| Category | Count | Example Codes | Completeness |
|----------|-------|---------------|-------------|
| GST | 10 | ASMT-10, DRC-01, REG-17, GSTR-3A, MOV-02, CMP-05, PCT-03, RFD-08, DRC-01A | ~15% of all GST notice types |
| Income Tax | 10 | 142(1), 143(1), 143(2), 148, 156, 245 | ~10% of all IT notice types |
| Labor Law (PF/ESI) | 0 | — | Not started |
| Company Law (MCA) | 0 | — | Not started |
| **Total** | **20** | | **Target: 200+ for launch** |

### Content Quality per Notice
Each notice has **all 8 content fields** populated:

| Field | Purpose | Average Length |
|-------|---------|---------------|
| `summary` | Quick 2-3 sentence overview | ~50 words |
| `detailed_explanation` | Full deep-dive explanation | ~150 words |
| `why_received` | Emotional context ("Why me?") | ~80 words |
| `common_mistakes` | What people typically do wrong | ~60 words |
| `consequences_of_ignoring` | Risks of inaction | ~60 words |
| `next_steps` | Bulleted actionable steps | ~100 words |
| `source_section` | Legal reference (e.g., "CGST Act Section 61") | 5-10 words |
| `verified_by` | Expert name | N/A |

---

## API Endpoints

| Endpoint | Method | Auth | Description | Response |
|----------|--------|------|-------------|----------|
| `/api/notices/?search=<query>` | GET | None | Search notices by code, title, keyword, summary | Array of NoticeType |
| `/api/notices/{code}/` | GET | None | Get full details by notice code | Single NoticeType |
| `/api/feedback/` | POST | None | Submit helpfulness feedback | Created feedback |
| `/admin/` | GET | Django superuser | Content management interface | HTML |

---

## Tech Stack (Exact Versions)

### Backend
- Python 3.11
- Django 5.2.10
- Django REST Framework (unpinned ⚠️)
- django-cors-headers (unpinned ⚠️)
- python-dotenv (unpinned ⚠️)

### Frontend
- React 19.2.4
- React Router 7.12.0
- TypeScript 5.9.2
- Vite 7.1.7
- Tailwind CSS 4.1.13
- Inter + Merriweather fonts (Google Fonts)

### Infrastructure
- SQLite (local file ⚠️)
- Render (configured but not deployed)
- No CI/CD
- No monitoring
