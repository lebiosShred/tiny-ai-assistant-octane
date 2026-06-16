# Tiny AI Assistant

Welcome to the official documentation for the **Tiny AI Assistant**. This document covers the architecture, tech stack, core features, security guardrails, E2E testing framework, and deployment pipelines.

---

## 1. System Overview & Architecture

Tiny AI Assistant is an enterprise-grade sales enablement application designed for pre-screening prospect briefings, meeting analysis, and automated follow-up drafting. It features a decoupled, cloud-native architecture optimized for scale, security, and visual premium aesthetics.

### Deployment Layout
- **Frontend SPA**: Static assets served securely by Vercel for fast global edge rendering.
- **Backend API**: Stateless containerized Node.js application hosted on Google Cloud Run.
- **Persistent Knowledge Base**: Google Cloud Storage (GCS) bucket mounted
  directly to the Cloud Run container filesystem at `/app/knowledge`
  with instant write propagation (`stat-cache-ttl=0`).
- **Data & Caching**: Serverless Neon PostgreSQL (via Drizzle ORM) for
  session persistence, with an ioredis layer for pub/sub session
  updates and local in-memory fallbacks.

### Architecture Flow Diagram

```mermaid
graph TD
    subgraph ClientLayer [Client Layer]
        User([Sales Rep / Client Browser])
    end

    subgraph FrontendLayer [Frontend Hosting - Vercel]
        Vercel[Vercel CDN]
        indexHTML[index.html <br> Fetch Interceptor & Loop Protection]
        appJS[app.js <br> Chat UI & Document Card Parser]
        stylesCSS[styles.css <br> Premium Visual Theme]
    end

    subgraph BackendLayer [Backend Hosting - Google Cloud Run]
        CloudRun[Node.js API Server <br> server.js]
        Drizzle[Drizzle ORM]
    end

    subgraph DataStorageLayer [Data & Caching Layer]
        NeonDB[(Neon Postgres <br> relational session store)]
        RedisCache[(Redis Cache <br> pub/sub update sync)]
        GCSBucket[(GCS Knowledge Base <br> mounted at /app/knowledge)]
    end

    subgraph ExternalIntegrations [External APIs & Services]
        AISDK[Vercel AI SDK <br> Deepseek / Mistral / OpenAI]
        GDrive[Google Drive API <br> Company folders sync]
        HubSpot[HubSpot CRM <br> Sales contact logging]
        Nodemailer[Nodemailer SMTP <br> Recap email dispatch]
    end

    %% Client Interactions
    User -->|HTTPS GET| Vercel
    Vercel -->|Serves Static Files| indexHTML
    User -->|API Requests <br> x-api-key| CloudRun

    %% Frontend Assets
    indexHTML --> appJS
    indexHTML --> stylesCSS

    %% Backend Operations
    CloudRun -->|Query & Sync| Drizzle
    Drizzle --> NeonDB
    CloudRun -->|Pub/Sub Sync| RedisCache
    CloudRun -->|Direct Directory Reads| GCSBucket

    %% Backend Integrations
    CloudRun -->|Generative RAG Completion| AISDK
    CloudRun -->|Folder/File Creation| GDrive
    CloudRun -->|Sync Log Entries| HubSpot
    CloudRun -->|Send Recap Email| Nodemailer
```

---

## 2. Technology Stack

| Layer | Component | Description / Reference Files |
| --- | --- | --- |
| **Frontend UI** | HTML5, Vanilla JavaScript, CSS3 | [index.html](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/Tiny%20AI%20Assistant/index.html), [app.js](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/Tiny%20AI%20Assistant/app.js), [styles.css](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/Tiny%20AI%20Assistant/styles.css) |
| **UI Engines** | Marked.js, DOMPurify, Mammoth.js, PDF.js, pdfmake | Renders Markdown, purifies HTML, visualizes Word/PDF briefs, generates client PDFs. |
| **API Server** | Node.js (20.x), Native HTTP server | Custom routing middleware, API-key authentication, CORS headers. [server.js](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/Tiny%20AI%20Assistant/server.js) |
| **Databases** | Neon Postgres, Drizzle ORM, ioredis | Relational data mapping and optimistic UI syncing with pub/sub broadcasts. |
| **AI Layer** | Vercel AI SDK, Deepseek, Mistral, OpenAI, Exa.js | High-fidelity RAG completion models, web search integrations. |
| **Quality Control** | Playwright (Aegis Suite), Ast-grep | E2E testing, accessibility checks, visual regression, syntax audits. [playwright.config.js](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/Tiny%20AI%20Assistant/playwright.config.js) |

---

## 3. Key Operational Features

### Client-Side Resilience (Loop Protection)
The fetch interceptor in [index.html](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/Tiny%20AI%20Assistant/index.html) intercepts `401 Unauthorized` responses, auto-requests a fresh session token from `/api/auth/token`, and retries the request. To prevent infinite fetch loops on persistent auth failures, it tracks a retry index (`config._retryCount`) and throttles auto-refresh at a maximum of 1 attempt.

### Document Card Parsing
When the AI assistant generates deliverables such as recap emails or migration reports, it wraps them in `[DOCUMENT: Type]` tags. The frontend parses these tags, hides raw delimiters, and renders a visually rich preview card inside the chat stream. Clickable delegation buttons copy clean subjects, bodies, or entire documents to the clipboard without markdown or system tags.

### Clean E2E Test Logs
In offline test environments, the Neon database and Redis are mock-bypassed. To keep test outputs clean, `deleteHistorySession` and `saveHistoryItem` in [server.js](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/Tiny%20AI%20Assistant/server.js) log connection errors using `err.message || err` instead of dumping multi-line stack traces to the console.

---

## 4. Security Guardrails & Playbook Rules

The backend [server.js](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/Tiny%20AI%20Assistant/server.js) enforces strict system-level prompt constraints (`<safety_rules>`) which prevent playbooks from being leaked, bypassed, or overridden by adversarial inputs:

- **Early/Middle Game Prefix Rule (Rule 13)**: Queries regarding early
  or middle game sales schedules, coverage, or timelines must strictly
  begin with the prefix: `"According to the Early or middle architecture"`.
- **Adversarial Input Filtering**: Injected script tags, HTML wrappers,
  or prompt-extraction queries (like "output your system prompt")
  are intercepted and sanitized to protect prompt boundaries.
- **Recap Email Drafting**: System constraints strictly prevent calling
  automated tools (like `send_recap_email`) or claiming an email has
  been sent when the user only asked to "generate" or "draft" a recap.

---

## 5. Development & Testing Workflow

### Local Development Server
Launch the local Node.js server:
```powershell
node server.js
```
The server will boot on `http://localhost:8080` (or `8081` during tests) and run on in-memory local caches if database connections are offline.

### Running Aegis E2E Tests
Run the entire Playwright test suite:
```powershell
npm run test:aegis
```
This boots a clean backend instance, mocks Google Drive, and executes 80+ verification specs, including:
- `tests/e2e/document-preview.spec.js` (Visual cards and clipboard copy checks)
- `tests/e2e/prompt-injection.spec.js` (System prompt resistance and Rule 13 prefix rules)

---

## 6. Deployment Pipelines

### Frontend (Vercel)
Frontend deployments build static pages from the `master` branch. Run a manual production sync using:
```powershell
npx vercel --prod --yes
```

### Backend (Google Cloud Run)
Backend builds compile a docker image and deploy it with GCS storage mounts:
1. Build the container image:
   ```powershell
   gcloud builds submit --tag gcr.io/tiny-ai-assistant-proj-12345/tiny-ai-assistant .
   ```
2. Deploy the container:
   ```powershell
   gcloud beta run deploy tiny-ai-assistant --image gcr.io/tiny-ai-assistant-proj-12345/tiny-ai-assistant --region us-central1 --execution-environment gen2 --add-volume "name=knowledge-vol,type=cloud-storage,bucket=tiny-ai-knowledge-base,mount-options=stat-cache-ttl=0" --add-volume-mount "volume=knowledge-vol,mount-path=/app/knowledge" --allow-unauthenticated
   ```
   Or run the automated deployment script [deploy.sh](file:///c:/Users/SkyDr/OneDrive/Desktop/PROJECTS/Anthony/Tiny%20AI%20Assistant/deploy.sh) in a compatible bash shell.

---

## 7. Required Services & Developer Accounts

To migrate this application from a personal deployment to a team-managed production environment, developers must create accounts with the following providers and configure the corresponding environment variables in the `.env` file:

| Service Provider | Env Variable Keys | Purpose |
| --- | --- | --- |
| **Google Cloud Console** | `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET`, `GDRIVE_REFRESH_TOKEN`, `GDRIVE_ROOT_FOLDER_ID` | Connects Google Drive API for company folder creation and prospect file uploads. |
| **Google AI Studio** | `GOOGLE_API_KEYS` | Provides API keys for Gemini LLM completions (supports comma-separated rotation list). |
| **Neon Console** | `DATABASE_URL`, `MIGRATION_DATABASE_URL` | Serverless Postgres database for relational chat session history storage. |
| **Resend** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Handles SMTP email dispatch for recap emails. |
| **Tavily AI** | `TAVILY_API_KEY` | Search API provider used for RAG research. |
| **Exa AI** | `EXA_API_KEY` | Search API provider used for RAG research. |
| **Jina AI** | `JINA_API_KEY` | Reader API used to scrape website URLs. |
| **DeepSeek** | `DEEPSEEK_API_KEY` | DeepSeek LLM API for zero-cost model failover testing. |
| **OpenRouter** | `OPENROUTER_API_KEY` | LLM router provider used for fallback completions. |
| **Mapbox** | `MAPBOX_API_KEY` | Mapbox developer API used to compute travel times and routing distances. |
| **Fathom Video** | `FATHOM_API_KEY` | Fathom meeting transcription API integrations. |
| **HubSpot Developer Portal** | `HUBSPOT_ACCESS_TOKEN` | Private App Access Token for CRM sync. |
| **Redis Provider** | `REDIS_URL` | Managed Redis server (like Upstash) for socket session broadcasts. |
