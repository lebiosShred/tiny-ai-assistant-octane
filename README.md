# Handover Guide for Deepanshu)
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

## 4. Database Operations (Neon Postgres)

The application uses **Neon Postgres** to persist session history. The schemas are managed via **Drizzle ORM**.

- If you modify database schemas, apply the changes to the database by running:
  ```powershell
  npx drizzle-kit push
  ```

---

## 5. Running Tests

We use **Playwright** for E2E testing:

- Run E2E verification tests:
  ```powershell
  npx playwright test
  ```
  *(Note: All legacy Aegis tests and video pipelines have been deleted to keep the project clean).*

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
