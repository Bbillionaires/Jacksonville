# Jacksonville Programs Finder

A directory + search tool for Jacksonville, FL government and utility assistance
programs (facade grants, JEA energy rebates, LIHEAP, emergency financial
assistance, etc.). Users describe their situation in plain language and the
backend matches them against a program list, either with an LLM or a keyword
fallback.

Originally built on [Emergent](https://emergent.sh) (see `.emergent/emergent.yml`
and the `emergentintegrations` backend dependency) — the sections below audit
what that leaves behind for anyone running or hosting this outside Emergent.

## Stack

- **Frontend**: Create React App + Craco, Tailwind, shadcn/radix components, React Router, axios. Source in `frontend/`.
- **Backend**: FastAPI + Motor (async MongoDB driver), JWT auth (PyJWT + bcrypt), OpenAI for AI-powered search. Source in `backend/server.py` (single file, ~620 lines).
- **Database**: MongoDB (collections: `users`, `programs`, `search_history`).

## Features (what it does)

- Email/password auth: register, login, forgot/reset password, `GET /api/auth/me`.
- Guest search (`/guest`, limited to 3 programs, no login) and authenticated search (`/dashboard`, full catalog).
- Free tier: 2 searches per account, then a `402` asking the user to subscribe.
- `POST /api/payment/subscribe` flips `has_subscription = true` on the user — **this is a stub, no payment is actually collected or verified** (no Stripe Checkout/webhook wiring exists despite `stripe` being in `requirements.txt`).
- AI search (`/api/search`, `/api/search-guest`): sends the query + full program list to an LLM, asks it to return matching program IDs as JSON. Falls back to a plain keyword match (`simple_text_search`) if the LLM call throws for any reason.
- Program CRUD (`GET/POST/DELETE /api/programs`) and a seeding endpoint (`POST /api/admin/init-programs`) that loads ~9 hardcoded Jacksonville-area programs.
- Search history per user (`GET /api/user/search-history`).

## Setup / running locally

Requires Node 18+/Yarn, Python 3.11+, and a MongoDB instance (Atlas or local).

```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt   # see "Does it build" below — this currently fails
cp .env.example .env              # fill in real values
uvicorn server:app --reload --port 8001

# Frontend
cd frontend
yarn install
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env
yarn start
```

Required environment variables are listed in `backend/.env.example`.

## Status

### Does it build? — No, not as-is

- `backend/requirements.txt` pins `emergentintegrations==0.1.0`, which is
  **Emergent's own private package** — it is not published to PyPI
  (`pip install emergentintegrations` fails with "No matching distribution
  found" from the public index). `backend/server.py` imports it directly
  (`from emergentintegrations.llm.chat import LlmChat, UserMessage`) to call
  an LLM via `EMERGENT_LLM_KEY`, which is Emergent's own billing/proxy key,
  not a real OpenAI key. **The backend cannot be installed or run outside
  Emergent's platform until this is swapped for a direct provider SDK call.**
- The frontend builds and compiles cleanly on its own: `yarn build` in
  `frontend/` succeeds with no errors (verified in this pass).
- There is no CI configuration in the repo (only `.emergent/emergent.yml`,
  which is Emergent's own job metadata, not a build pipeline).

### What's missing / broken

- **No real test suite.** `tests/` only contains an empty `__init__.py`.
  `backend_test.py` is a standalone script (not pytest) that hardcodes the
  *live* Emergent preview URL (`community-assist-jax.preview.emergentagent.com`)
  as its target — it's written to hit a running deployment, not to run
  locally or in CI against this code.
- **No payment integration.** `stripe` is listed in `backend/requirements.txt`
  but never imported or used anywhere in `server.py`. "Subscribing" just sets
  a boolean on the user record with no payment collected.
- **No admin role / authorization gap.** There's no `is_admin` (or any role)
  field on the `User` model. `POST /api/programs` and `DELETE
  /api/programs/{id}` only require *being logged in* — any registered user
  can delete or add programs in the shared directory. `POST
  /api/admin/init-programs` requires no auth at all.
- **Weak default JWT secret.** `JWT_SECRET_KEY` falls back to the hardcoded
  string `"jacksonville-programs-finder-secret-key"` if the env var isn't
  set — anyone deploying this without explicitly setting that variable
  issues forgeable tokens.
- **AI search depends on Emergent's LLM proxy** (see above) — needs a real
  `OPENAI_API_KEY` (or equivalent provider swap) to work anywhere else.
  Keyword-only fallback works regardless.
- **Hosting**: as deployed on Emergent, the preview environment sleeps when
  inactive and has to be manually resumed from the Emergent dashboard before
  the site responds (it was down for this reason during this audit — see
  `claude/site-downtime-investigation-prz0mg` branch/PR for the live
  diagnosis and an in-progress Vercel migration).

### How to run it

See "Setup / running locally" above. In short: needs a MongoDB connection
string, a JWT secret, and (optionally, for AI search) a real OpenAI key —
none of which exist in this repo or are available to this session.

### Where it's deployed

Currently on Emergent's preview infrastructure at
`https://community-assist-jax.preview.emergentagent.com` (sleeps when
idle; requires the Emergent dashboard to resume). No production/custom
domain exists. A separate branch (`claude/site-downtime-investigation-prz0mg`)
has groundwork for moving this to Vercel so it stops sleeping, blocked on
the items below.

## Needs De'Aris

These require an account, credential, or business decision this session
doesn't have access to:

1. **MongoDB hosting for a non-Emergent deployment** — needs a real
   connection string (e.g. a MongoDB Atlas cluster) to run anywhere outside
   Emergent.
2. **A real `OPENAI_API_KEY`** (or a decision to ship without AI search) to
   replace Emergent's proxied LLM key.
3. **Stripe test-mode keys**, plus a decision on whether `/payment/subscribe`
   should actually be wired to Stripe Checkout or stays a manual/stub flow.
4. **Whether to add an admin role** and lock down `/api/programs` write
   access and `/api/admin/init-programs` to admins only (currently any
   logged-in user, or in the init case anyone at all, can modify the
   program directory).
5. **Confirmation of the Vercel migration path** (new Atlas cluster vs.
   migrating existing Emergent Mongo data) started on
   `claude/site-downtime-investigation-prz0mg`.
