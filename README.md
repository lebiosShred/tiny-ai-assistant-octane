# Welcome to Tiny AI Assistant (Handover Guide for Deepanshu)

Hey Deepanshu, welcome to the codebase! I've simplified this repository by removing legacy tests, empty placeholders, and inactive screencast workflows to make it as clean and straightforward as possible for you. 

Here is exactly how the app works and the steps you need to take to run and deploy it.

---

## 1. Quick Setup (First Steps)

To get started, follow these steps:

1. **Install Dependencies**: Run the install command inside the `Tiny AI Assistant` folder:
   ```powershell
   npm install
   ```
2. **Set Up Environment Variables**: 
   Create a `.env` file in the `Tiny AI Assistant` directory. You will need to obtain the active API keys and URLs for:
   - `DATABASE_URL` (Neon PostgreSQL database connection string)
   - `GOOGLE_API_KEYS` (Google Gemini API keys for the RAG engine)
   - `API_KEY` (The secure token used to authenticate requests between the frontend and backend)
   - `GDRIVE_REFRESH_TOKEN` / `GDRIVE_ROOT_FOLDER_ID` (Google Drive folders integration keys)

---

## 2. Running the App Locally

To start the local development server:

1. **Launch the Node Backend**: Run the start script:
   ```powershell
   npm run dev
   ```
   The backend server will spin up on `http://localhost:8080`.
2. **Access the Frontend SPA**:
   Open `index.html` in your browser. The frontend contains a fetch interceptor that routes `/api/*` requests to the local backend.

---

## 3. Modifying the Frontend

If you are looking to tweak the frontend, just look for these files in the `Tiny AI Assistant` folder:
- **HTML Structure**: [index.html](./Tiny%20AI%20Assistant/index.html)
  Defines sidebar panels, input areas, modals, and container wrappers.
- **UI Logic & Events**: [app.js](./Tiny%20AI%20Assistant/app.js)
  Handles chat logic, message rendering, file upload listeners, and PDF previews.
- **CSS Styling & Layouts**: [styles.css](./Tiny%20AI%20Assistant/styles.css)
  Manages dark-themed colors, custom fonts, element spacing, and responsive grids.

---

## 4. Modifying the Backend

If you are looking to tweak the backend logic or API routing, look for these files in the `Tiny AI Assistant` folder:
- **Server Routing & API Entry**: [server.js](./Tiny%20AI%20Assistant/server.js)
  Boots the server, manages API keys, sets up middleware, and defines session routes.
- **Gemini RAG & AI Engine**: [ai-assistant.js](./Tiny%20AI%20Assistant/ai-assistant.js)
  Implements the RAG architecture, model configurations, safety rules, and prompts.
- **Database Schema & Migrations**: [schema.js](./Tiny%20AI%20Assistant/src/db/schema.js)
  Defines table schemas. To push schema changes to Neon Postgres, run: `npx drizzle-kit push`
- **Google Drive Integration**: [gdrive-service.js](./Tiny%20AI%20Assistant/gdrive-service.js)
  Handles folder structure management and file uploads.
- **Email Generation**: [email-service.js](./Tiny%20AI%20Assistant/email-service.js)
  Handles SMTP setups and outbound Resend/Nodemailer integrations.

---

## 5. Required External Services & API Configuration

All API keys are configured via environment variables in the `.env` file.
To modify integration logic, look for the corresponding service files listed below.

- **AI Models (Gemini, DeepSeek, Mistral)**:
  Adjust prompt logic and fallbacks in [ai-assistant.js](./Tiny%20AI%20Assistant/ai-assistant.js).
- **Web Search (Tavily, Exa)**:
  Configure search query filters in [ai-assistant.js](./Tiny%20AI%20Assistant/ai-assistant.js).
- **Neon Postgres**:
  DB connection and schema logic are in [schema.js](./Tiny%20AI%20Assistant/src/db/schema.js).
- **Upstash Redis**:
  Socket and memory sync logic are managed in [server.js](./Tiny%20AI%20Assistant/server.js).
- **Google Workspace (Drive)**:
  Google Drive OAuth logic is in [gdrive-service.js](./Tiny%20AI%20Assistant/gdrive-service.js).
- **Resend (SMTP)**:
  SMTP setup and templates are in [email-service.js](./Tiny%20AI%20Assistant/email-service.js).
- **HubSpot CRM**:
  CRM api routes and syncing are configured in [server.js](./Tiny%20AI%20Assistant/server.js).

---

## 6. Deployment Pipelines

- **Frontend static assets**: Deployed on **Vercel** (`https://octane-tiny-assistant.vercel.app/`).
  Deploy production updates using:
  ```powershell
  npx vercel --prod --yes
  ```
- **Backend APIs**: Containerized and deployed on **Google Cloud Run**.
  Deploy updates using the build script:
  ```powershell
  gcloud builds submit --tag gcr.io/[PROJECT_ID]/tiny-ai-assistant .
  ```
