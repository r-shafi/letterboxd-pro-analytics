# Privacy Policy & Security Architecture

`Letterboxd Pro Analytics` is designed from the ground up as a **zero-knowledge, local-first client-side web application**.

---

## 1. Zero Server Storage

- **No User Account:** You do not need to register, provide an email address, or authenticate with any backend server.
- **In-Browser Processing:** Your Letterboxd `.zip` archive or extracted CSV files are read and parsed directly inside your browser via dedicated Web Workers. Your personal export files are **never** transmitted to any server.
- **Local Persistence Only:** All parsed film entries, watched logs, ratings, reviews, lists, and statistical snapshots are stored solely on your device using `localStorage` and `IndexedDB` (with LZ-String compression).
- **Data Purging:** You can permanently delete all locally stored data at any time via the **Settings &rarr; Clear Data** button.

---

## 2. Privacy Sanitization & PII Stripping

When you import a Letterboxd export, the parser immediately discards sensitive personally identifiable information (PII) before state initialization:
- `Email Address` — **Discarded immediately**
- `Family Name` — **Discarded immediately**
- `Pronouns` — **Discarded immediately**
- `Location` — **Discarded immediately**
- `Website` — **Discarded immediately**

Only your public display `Username`, account creation date, bio, and favorite film URIs are retained for local display.

---

## 3. TMDb API Interaction

To enrich your library with poster artwork, genres, cast, crew, runtime, and release details, the application queries The Movie Database (TMDb) API:
- Only **film titles** and **release years** are sent in TMDb search queries.
- No user-identifying metadata, diary dates, ratings, or personal reviews are ever transmitted.
- **Bring Your Own Key (BYOK):** You may optionally supply your own TMDb API key or read access token in Settings. Your key is stored solely in your browser's `localStorage` and is never sent to any intermediary server.

---

## 4. Usage Analytics & Telemetry

Usage telemetry is implemented with strict privacy constraints:
- **No-Op by Default:** If `VITE_ANALYTICS_PROVIDER` is unset, telemetry is completely disabled and executes zero network requests.
- **No Content Tracking:** Telemetry **never** collects, transmits, or logs film titles, user names, ratings, tags, or review text. Any payload containing user data is actively blocked and rejected by the telemetry guard.
- **Bucketed Metrics:** To prevent library fingerprinting, film counts are coarsely bucketed (`<100`, `100-500`, `500-1000`, `1000-5000`, `5000+`).
- **Respects Do Not Track (DNT):** If your browser broadcasts `navigator.doNotTrack === '1'`, all analytics events are automatically suppressed.
- **User Opt-Out:** You can toggle anonymous telemetry on or off at any time in the **Privacy & Legal** modal.

---

## 5. Third-Party Disclaimers & Trademarks

- **TMDb:** This product uses the TMDB API but is not endorsed or certified by TMDB. All movie metadata and poster artwork are provided courtesy of TMDb.
- **Letterboxd:** Not affiliated with, maintained, authorized, endorsed, or sponsored by Letterboxd Limited or any of its subsidiaries or affiliates. All Letterboxd trademarks and logos belong to Letterboxd Limited.
