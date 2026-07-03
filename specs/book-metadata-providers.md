# Spec: Multi-Provider Book Metadata Pipeline

**Status:** Draft  
**Version:** 1.0  
**Date:** 2026-05-31  
**Scope:** Backend book lookup + preparation (`/api/books/prepare`, optional search enrichment)  
**Out of scope:** Persisted library rows, cover upload, barcode scanning UI

---

## 1. Problem

Open Library (OL) ist derzeit die einzige strukturierte Metadatenquelle für Bücher. Das funktioniert oft gut, aber nicht immer:

- ISBN existiert in OL nicht oder liefert nur eine leere/spärliche Edition
- Titel, Autoren, Verlag oder Erscheinungsjahr fehlen oder sind widersprüchlich
- Serienhinweise sind unvollständig oder nur indirekt über Subjects erkennbar
- Deutsche Ausgaben sind schlechter abgedeckt als englische

Heute führt ein „schwaches“ OL-Ergebnis direkt zum teuren **LLM-Web-Search-Fallback** (`bookPreparationService.js`). Das ist langsam, kostet Tokens und liefert weniger nachvollziehbare Quellen.

**Ziel:** Vor dem LLM-Aufruf mehrere kostenlose/strukturierte APIs in einer definierten Reihenfolge abfragen, Ergebnisse zusammenführen und dem LLM ein reicheres, aber kompaktes Evidenzpaket geben. Web Search bleibt letzter Ausweg.

---

## 2. Ziele

| Ziel | Messbar |
|------|---------|
| Höhere Trefferquote bei ISBN-Lookup | Weniger Fälle mit `< 4` befüllten Feldern vor LLM |
| Weniger Web-Search-Fallbacks | Anteil `method: web-search` sinkt |
| Nachvollziehbare Quellen | `analysis` zeigt genutzte Provider + Merge-Entscheidungen |
| Keine Frontend-API-Brüche | `POST /api/books/prepare` Response-Shape bleibt kompatibel |
| Geringe Latenz im Normalfall | OL-only weiterhin typischer schneller Pfad |

## 3. Nicht-Ziele

- Vollständiger Ersatz von Open Library als Such-UI-Backend (Work/Edition-Picker bleibt OL-zentriert in v1)
- Automatisches Speichern ohne menschliche Review
- Bezahlte Buch-APIs (ISBNdb, Nielsen o.ä.) in v1
- Cover-Download und lokale Speicherung in der Provider-Pipeline (weiterhin manuell/upload)
- Provider für Game/Movie/Series (nur Books)

---

## 4. Ist-Zustand (Kurz)

```
ISBN
  └─ getBookDraftSourceByIsbn()          [openLibraryService.js]
       └─ OL edition + books API + work
            └─ prepareBookDraft()         [bookPreparationService.js]
                 ├─ stark genug → LLM normalization (MODEL)
                 ├─ schwach     → LLM web search (BOOK_PREP_WEB_SEARCH_MODEL)
                 └─ kein AI_KEY  → OL fallbackDraft direkt
```

**Schwäche-Kriterium heute** (`isWeakOpenLibrarySource`):

- kein Titel oder keine Autoren, **oder**
- weniger als 4 befüllte Felder im `fallbackDraft`

**Relevante Felder:** title, authors, description, coverUrl, pageCount, publishedDate, seriesName, seriesPosition, publisher, language, sourceName, sourceUrl

---

## 5. Zielarchitektur

```
ISBN (+ optional languageHint)
  │
  ▼
┌─────────────────────────────────────┐
│  BookMetadataOrchestrator           │
│  (neu: bookMetadataService.js)      │
└─────────────────────────────────────┘
  │
  ├─ Provider Queue (konfigurierbar, Default: 3)
  │    1. Open Library      [immer, bestehend]
  │    2. Google Books      [wenn Lücke oder schwach]
  │    3. BookBrainz        [wenn weiterhin schwach]
  │
  ├─ Merge → unified Evidence + mergedFallbackDraft
  │
  └─ prepareBookDraft (angepasst)
       ├─ merged stark genug → LLM normalization
       ├─ merged schwach     → LLM web search (unverändert als letzter Schritt)
       └─ kein AI_KEY       → mergedFallbackDraft direkt
```

### 5.1 Strategie: „Waterfall mit frühem Abbruch + parallelem Nachzug“

Nicht blind alle Provider immer abfragen. Stattdessen:

1. **Stufe A – Open Library** (sequentiell, sofort)
2. **Completeness Score** berechnen
3. Wenn Score ≥ `STRONG_THRESHOLD` → **keine weiteren Provider**, direkt Merge (trivial) + LLM
4. Wenn Score < `STRONG_THRESHOLD` → **Stufe B parallel** starten:
   - Google Books (ISBN lookup)
   - BookBrainz (ISBN lookup)
   - Timeout pro Provider: `BOOK_PROVIDER_TIMEOUT_MS` (Default: 2500 ms)
5. Ergebnisse sammeln, sobald mindestens ein Provider antwortet oder Timeout
6. **Merge** aller erfolgreichen Provider
7. Neuer Score; wenn immer noch < `WEAK_THRESHOLD` → Web-Search-LLM

**Vorteil:** Schneller Happy Path bei guten OL-Daten; zusätzliche APIs nur bei Bedarf.

### 5.2 Alternative (nicht empfohlen für v1)

Striktes sequentielles Waterfall (OL → wenn leer GB → wenn leer BB) ist einfacher, aber langsamer und nutzt parallele Kapazität nicht.

---

## 6. Provider-Kandidaten (v1)

| Priorität | Provider | Auth | Stärken | Schwächen |
|-----------|----------|------|---------|-----------|
| 1 | **Open Library** | nein | ISBN, Work/Edition, Covers, Serien-Subjects | Lücken, inkonsistente Editionen |
| 2 | **Google Books** | API Key (`GOOGLE_BOOKS_API_KEY`) | Gute ISBN-Abdeckung, Publisher/Datum/Seiten | Cover-URLs oft unscharf; Serien selten |
| 3 | **BookBrainz** | nein (Rate limit beachten) | Work/Edition-Modell, Autoren, ISBN | Community-Pflege, nicht immer vollständig |

**Warum diese drei?**

- Alle kostenlos bzw. mit großzügigem Free Tier (Google)
- ISBN-first passt zum bestehenden Scan/Prepare-Flow
- Kein Scraping, keine instabilen Shop-Seiten
- Strukturierte JSON-Antworten → gut für deterministisches Merging vor LLM

**Spätere Erweiterung (v2+):** Hardcover GraphQL, DNB SRU, OpenAlex – nur wenn messbarer Mehrwert.

---

## 7. Normalisiertes Provider-Interface

Neues internes Schema `BookProviderResult`:

```ts
type BookProviderId = 'open-library' | 'google-books' | 'bookbrainz'

interface BookProviderField<T> {
  value: T
  source: BookProviderId
  sourceUrl?: string | null
  confidence: 'high' | 'medium' | 'low'   // provider-intern, nicht LLM-confidence
}

interface BookProviderResult {
  provider: BookProviderId
  fetchedAt: string                     // ISO timestamp
  durationMs: number
  ok: boolean
  error?: string | null
  isbn: string
  fields: {
    title?: BookProviderField<string>
    authors?: BookProviderField<string[]>
    description?: BookProviderField<string | null>
    coverUrl?: BookProviderField<string | null>
    pageCount?: BookProviderField<number | null>
    publishedDate?: BookProviderField<string | null>   // roh, vor normalizeBookPublishedDate
    publisher?: BookProviderField<string | null>
    language?: BookProviderField<'de' | 'en' | null>
    seriesName?: BookProviderField<string | null>
    seriesPosition?: BookProviderField<string | null>
  }
  raw?: unknown                         // kompakt, nur für Debug/raw in prepare response
  sourceUrls?: Record<string, string | null>
  seriesHints?: Array<{ seriesName: string; source: string }>
}
```

Jeder Provider implementiert:

```js
// backend/src/services/bookProviders/<id>.js
export const providerId = 'google-books'
export async function fetchByIsbn(isbn, { languageHint, signal }) → BookProviderResult
```

Optional für v2 Search:

```js
export async function searchByQuery(query, options) → SearchCandidate[]
```

**Adapter für Open Library:** Bestehende `getBookDraftSourceByIsbn()` in `openLibraryProvider.js` wrappen, nicht duplizieren.

---

## 8. Merge-Regeln

Neue Funktion `mergeBookProviderResults(results: BookProviderResult[]): MergedBookSource`

### 8.1 Feld-Priorität (Default)

| Feld | Priorität (höchste zuerst) | Begründung |
|------|---------------------------|------------|
| isbn | Input | immer fix |
| title | OL → GB → BB | OL edition/work oft am ISBN-spezifischsten |
| authors | OL → GB → BB | OL books API; GB oft gut bei ISBN |
| publisher | OL → GB → BB | edition-spezifisch |
| publishedDate | OL → GB → BB | edition-spezifisch |
| pageCount | OL → GB → BB | edition-spezifisch |
| language | OL → GB → BB | edition language keys |
| description | OL (work) → GB → BB | work-level bei OL oft reicher |
| coverUrl | OL → GB → BB | OL Covers vertrauenswürdig; GB nur wenn https + plausible dimensions |
| seriesName | OL hints → BB → GB | OL subjects + BB work relations |
| seriesPosition | OL hints → BB → null | selten in APIs |

### 8.2 Konfliktauflösung

Wenn zwei Provider **hohe** confidence für dasselbe Feld liefern, aber Werte stark abweichen:

1. Edition-spezifische Felder (publisher, pageCount, publishedDate): **Open Library gewinnt**, wenn OL-Ergebnis nicht `low` ist
2. Title: normalisierter Vergleich (`comparableTitle` aus OL-Service wiederverwenden); bei Match unterschiedlicher Schreibweise → längere/kapitalisierte Variante
3. Konflikt bleibt → in `mergeConflicts[]` protokollieren, LLM bekommt **beide** Werte als Evidenz

```js
mergeConflicts: [
  { field: 'publisher', values: [
      { provider: 'open-library', value: 'Heyne' },
      { provider: 'google-books', value: 'Random House' },
  ]}
]
```

### 8.3 mergedFallbackDraft

Deterministischer Draft aus Merge (ohne LLM), analog zu heutigem `mapFallbackDraft`:

- `sourceName`: kommagetrennte Provider-Labels, z.B. `"Open Library, Google Books"`
- `sourceUrl`: primäre Quelle (OL edition URL > GB infoLink > BB URL)

Dieser Draft ist Fallback bei fehlendem `AI_API_KEY` und Vergleichsbasis für `analysis.fieldComparison`.

### 8.4 Completeness Score

```js
const SCORED_FIELDS = ['title','authors','description','pageCount','publishedDate','publisher','language','coverUrl']
// authors zählt als 1 wenn length > 0
// score = countPresent / SCORED_FIELDS.length

STRONG_THRESHOLD = 0.625   // 5/8 → keine weiteren Provider
WEAK_THRESHOLD   = 0.375   // 3/8 → nach Merge ggf. Web Search
```

Schwellenwerte per Env überschreibbar.

---

## 9. LLM-Integration (Anpassung)

### 9.1 Payload-Erweiterung

Statt nur `openLibrary` im User-Prompt:

```json
{
  "isbn": "978…",
  "languageHint": "de",
  "providers": {
    "open-library": { "...": "compact" },
    "google-books": { "...": "compact" },
    "bookbrainz": { "...": "compact" }
  },
  "mergedFallbackDraft": { "...": "deterministic merge" },
  "mergeConflicts": [],
  "seriesHints": []
}
```

`compactOpenLibraryPayload()` bleibt, wird unter `providers['open-library']` eingeordnet. Rückwärtskompatibel im `raw`-Block:

```json
"raw": {
  "openLibrary": { /* legacy shape */ },
  "providers": [ /* BookProviderResult[] */ ],
  "merge": { /* conflicts, score, usedProviders */ }
}
```

### 9.2 System-Prompt-Anpassung

`BOOK_PREP_SYSTEM` erweitern:

- Mehrere Provider als Evidenz nutzen
- Edition-spezifische Felder bevorzugen
- Bei `mergeConflicts` konservativ sein, Warnung ausgeben
- `sourceName` / `sourceUrl` aus `mergedFallbackDraft` übernehmen (nicht erfinden)
- Cover: weiterhin nur vertrauenswürdige URLs (OL Covers; GB thumbnail nur wenn Policy erfüllt)

### 9.3 Web-Search-Fallback

Unverändert als **letzte** Stufe, wenn nach Merge `score < WEAK_THRESHOLD` oder Titel+Autoren fehlen.

Erwartung: deutlich seltener als heute.

### 9.4 analysis-Erweiterung

```json
"analysis": {
  "method": "llm-normalization",
  "model": "gpt-4o-mini",
  "providersUsed": ["open-library", "google-books"],
  "providersSkipped": ["bookbrainz"],
  "mergeScore": 0.75,
  "mergeConflicts": 1,
  "openLibraryWeak": false,
  "openLibraryFieldCount": 5,
  "webSearchUsed": false,
  "fieldComparison": { ... }
}
```

Frontend (`BookList.vue` `prepareMethodLabel`) optional um Provider-Chips erweitern – **kein Breaking Change**, nur additive UI.

---

## 10. Caching

Analog zu `tmdbcache` / `hltbcache`:

### Neue Tabelle `bookprovidercache`

```sql
bookprovidercache(
  isbn TEXT NOT NULL,
  provider TEXT NOT NULL,          -- 'open-library' | 'google-books' | 'bookbrainz'
  payload TEXT NOT NULL,             -- JSON BookProviderResult (ohne raw-Bloat)
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (isbn, provider)
)
```

| Provider | TTL (Default) | Begründung |
|----------|---------------|------------|
| open-library | 7 Tage | wie TMDB metadata |
| google-books | 7 Tage | stabile ISBN-Metadaten |
| bookbrainz | 14 Tage | ändert sich selten |

- Cache-Lookup **vor** HTTP, pro Provider separat
- Admin: optional „Book provider cache leeren“ (v2; nicht zwingend v1)
- Import/Export: **nicht** in User-Backup (rebuildable cache)

---

## 11. API-Änderungen

### 11.1 `POST /api/books/prepare` (bestehend)

**Request:** unverändert `{ isbn, languageHint? }`

**Response:** unverändert `{ draft, confidence, warnings, raw, analysis }` – Felder in `raw`/`analysis` erweitert.

### 11.2 `GET /api/books/search` (optional v1.1)

Weiterhin OL-first für Work/Edition-Picker. Optional später:

- Query parallel an GB senden
- Ergebnisse nach ISBN deduplizieren
- `sources: ['open-library','google-books']` pro Kandidat

**Nicht Teil von v1**, um Scope klein zu halten.

### 11.3 Neuer Debug-Endpoint (nur Dev, optional)

`GET /api/books/providers/debug?isbn=…` → rohe Provider-Responses + Merge ohne LLM. Hinter `NODE_ENV !== 'production'` oder Admin-Flag.

---

## 12. Konfiguration

Neue Env-Variablen (`.env.example` ergänzen):

```env
# Google Books – optional; ohne Key wird Provider übersprungen
GOOGLE_BOOKS_API_KEY=

# Provider-Steuerung
BOOK_METADATA_PROVIDERS=open-library,google-books,bookbrainz
BOOK_PROVIDER_TIMEOUT_MS=2500
BOOK_MERGE_STRONG_THRESHOLD=0.625
BOOK_MERGE_WEAK_THRESHOLD=0.375
```

HA add-on (`media-library/config.yaml` + `run.sh` + `docker/entrypoint.js`): `GOOGLE_BOOKS_API_KEY` als optionales Secret.

**Default ohne Google Key:** Pipeline läuft mit OL + BookBrainz; GB wird still übersprungen (`providersSkipped`).

---

## 13. Fehlerbehandlung

| Situation | Verhalten |
|-----------|-----------|
| Ein Provider timeout/error | Andere Provider + Merge fortsetzen |
| Alle Provider fehlschlagen | 404 oder leerer merged Draft + Warning; Web Search wenn AI_KEY |
| GB Key fehlt | Skip, Warning nur im Server-Log (nicht User-facing) |
| Rate limit (BB) | Einmal retry nach 500 ms, dann skip |
| LLM fail nach gutem Merge | `mergedFallbackDraft` zurückgeben (wie heute OL-only fallback) |

Keine harten 500er nur wegen eines Neben-Providers.

---

## 14. Dateistruktur (Implementierung)

```
backend/src/services/
  bookMetadataService.js       # Orchestrator, score, merge
  bookProviders/
    index.js                   # Registry + enabled list
    openLibrary.js             # Adapter um getBookDraftSourceByIsbn
    googleBooks.js             # neu
    bookBrainz.js              # neu
  bookPreparationService.js    # Payload + prompts anpassen
  openLibraryService.js          # unverändert bis auf ggf. exportierte Helfer

backend/src/db/library.js        # bookprovidercache migration
backend/tests/bookProviders.test.js
backend/tests/bookMerge.test.js
```

---

## 15. Tests

### Unit

- `mergeBookProviderResults`: Priorität, Konflikte, leere Inputs
- `computeCompletenessScore`: Grenzfälle an Schwellenwerten
- Provider-Mapper: fixture JSON → `BookProviderResult` (OL, GB, BB)

### Integration (node:test)

- `prepareBookDraft` mit gemockten Providern:
  - OL stark → nur OL, kein GB/BB fetch
  - OL schwach + GB gut → normalization, kein web search
  - alle schwach → web search
- Timeout: langsamer Provider wird ignoriert

### Keine Live-API-Tests in CI

Fixtures aus echten Antworten (anonymisiert) im Repo.

---

## 16. Rollout-Phasen

### Phase 1 – Fundament (MVP)

- Provider-Interface + Orchestrator
- OL-Adapter (Refactor, kein Verhaltenschange)
- Google Books Adapter
- Merge + angepasstes `prepareBookDraft`
- Cache-Tabelle
- Tests

### Phase 2 – Abdeckung

- BookBrainz Adapter
- `analysis`/`raw` Frontend-Anzeige (Provider-Chips)
- Metriken im Server-Log: `providersUsed`, `method`, Dauer

### Phase 3 – Optional

- Search-Multi-Provider
- Admin Cache-Clear
- Weitere Provider nach Bedarf

---

## 17. Risiken & Mitigationen

| Risiko | Mitigation |
|--------|------------|
| Mehr Latenz bei schwachen OL-Daten | Parallel fetch + Timeout; Cache |
| Google API Quota | Key optional; Cache 7d; nur bei Bedarf |
| Widersprüchliche Metadaten | mergeConflicts + konservatives LLM |
| Cover-URLs von GB unsicher | Strikte Cover-Policy wie bei Web Search |
| BookBrainz Rate Limits | Timeout, Cache, niedrige Parallelität |

---

## 18. Offene Fragen

1. **Google Books API Key:** Soll der Nutzer einen eigenen Key pflegen (wie TMDB), oder reicht OL+BB ohne GB als Default?
2. **Cover-Policy für GB:** Thumbnails erlauben oder weiterhin nur OL Covers im Draft?
3. **Search-Scope:** Reicht Prepare-Pipeline v1, oder ist Multi-Provider-Suche Priorität?
4. **BookBrainz:** In v1 aufnehmen oder erst Phase 2, wenn GB allein reicht?
5. **Telemetrie:** Sollen wir anonymisiert zählen, welcher Provider das Merge gerettet hat (lokal im Log)?

---

## 19. Akzeptanzkriterien (v1 MVP)

- [ ] ISBN mit gutem OL-Eintrag: Verhalten identisch zu heute (≤ 1 Provider-Call, gleiche Draft-Qualität)
- [ ] ISBN ohne OL, mit GB: sinnvoller Draft ohne Web Search
- [ ] `POST /api/books/prepare` Response bleibt für Frontend kompatibel
- [ ] `analysis.providersUsed` listet genutzte Quellen
- [ ] Ohne `GOOGLE_BOOKS_API_KEY` kein Fehler, Pipeline funktioniert mit OL (+ optional BB)
- [ ] Unit-Tests für Merge und Orchestrator-Entscheidungslogik
- [ ] AGENTS.md / README kurz aktualisiert (nach Implementierung)

---

## 20. Referenzen (Code heute)

| Datei | Rolle |
|-------|-------|
| `backend/src/services/openLibraryService.js` | OL ISBN lookup, search, editions |
| `backend/src/services/bookPreparationService.js` | LLM normalization / web search |
| `backend/src/routes/books.js` | `/prepare`, `/search`, `/editions` |
| `src/services/bookStorage.js` | Frontend `prepareBookDraft()` |
| `src/components/BookList.vue` | Editor, Prepare-UI, Analysis-Anzeige |
