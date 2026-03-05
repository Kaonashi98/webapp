# Desk Booking Exprivia – Handover Completo

## 1) Obiettivo del progetto
Realizzare una webapp aziendale **Desk Booking** in cui:
- i dipendenti prenotano la propria postazione;
- la scelta avviene dalla **planimetria interattiva**;
- l’admin carica la planimetria (SVG/PDF/immagini), la elabora via OCR e la importa nel sistema;
- le prenotazioni rispettano regole business (1 al giorno, max 5 settimana, cancellazione con anticipo).

Obiettivo finale richiesto: esperienza utente fluida e affidabile, con mappa interattiva reale caricata dall’admin, senza fallback a griglie statiche.

---

## 2) Stack e struttura
Monorepo in `webapp/` con cartelle:
- `backend/` → Spring Boot 3.4, Java 21, JWT, PostgreSQL
- `frontend/` → Angular standalone
- `ai-service/` → FastAPI + OCR (Tesseract + parser SVG/PDF)
- `docker/` + `docker-compose.yml` → orchestrazione servizi

DB: PostgreSQL (`deskbooking`) con schema e seed iniziale.

---

## 3) Cosa è stato implementato

### Backend
- Auth JWT: login/register/me
- Ruoli: `USER`, `ADMIN`
- API booking con regole business:
  - max 1 prenotazione al giorno
  - max 5 prenotazioni settimana (lun-ven)
  - cancellazione consentita entro -2h
- API admin:
  - import layout stanze/postazioni nel DB
  - creazione dipendente
- API layout interattivo condiviso:
  - salvataggio asset planimetria (`/api/admin/layout/asset`)
  - lettura metadata (`/api/rooms/layout`)
  - lettura immagine (`/api/rooms/layout/image`)
- CORS e security config per frontend locale.

### Frontend
- Login/register con JWT interceptor + guard
- Dashboard dipendente/admin
- Prenotazione reale e storico prenotazioni
- Mappa interattiva con:
  - marker stanza
  - zoom stanza
  - marker postazioni con stati (verde disponibile, rosso prenotata, blu selezionata)
- Scroll automatico al riepilogo selezione postazione
- UI/UX migliorata in stile Exprivia
- Rimosso fallback legacy a rettangoli celesti lato dipendente

### AI Service
- OCR planimetria con supporto SVG/PDF/immagini
- Parser SVG avanzato (token e coordinate con transform matrix)
- Output strutturato: stanze, postazioni, coordinate, dimensioni sorgente

---

## 4) Problema recente e causa reale
Problema segnalato:
- “Analizza file” OK
- “Salva layout su DB” dava: `Layout importato ma salvataggio planimetria non riuscito`

Diagnosi:
- Il file `planimetria.svg` pesa **2.301.212 bytes (~2.3MB)**.
- Il backend Spring aveva limite multipart predefinito (tipicamente 1MB), quindi l’upload asset planimetria falliva.

Fix applicato:
- aumento limiti upload in `backend/src/main/resources/application.yml`:
  - `spring.servlet.multipart.max-file-size: 20MB`
  - `spring.servlet.multipart.max-request-size: 25MB`
- gestione errori API più chiara con `ApiExceptionHandler`.
- upload metadata multipart reso più robusto (metadata come stringa JSON parse lato backend).
- frontend aggiornato per mostrare messaggi errori più espliciti con codice HTTP.

---

## 5) Flusso corretto (admin)
1. Login admin
2. Sezione **Import Planimetria**
3. Seleziona file (es. `planimetria.svg`)
4. Clicca **Analizza file** (OCR)
5. Clicca **Salva layout su DB**
6. Il sistema:
   - importa stanze/postazioni nel DB
   - salva asset interattivo condiviso (immagine + coordinate)
7. I dipendenti vedono direttamente la mappa interattiva caricata

---

## 6) Avvio progetto (locale)

### Prerequisiti
- Java 21
- Maven
- Node.js + npm
- Python 3.11+ (consigliato) per ai-service
- PostgreSQL (oppure Docker)

### Opzione A – Locale (servizi separati)

#### 1) DB PostgreSQL
Creare DB `deskbooking` e utente `deskbooking/deskbooking` (oppure usare configurazione esistente).

#### 2) Backend
```powershell
cd backend
mvn spring-boot:run
```
Backend su `http://localhost:8080`.

#### 3) AI Service
```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```
Health: `http://127.0.0.1:8000/health`

#### 4) Frontend
```powershell
cd frontend
npm install
npm start
```
Frontend su `http://localhost:4200`.

### Opzione B – Docker Compose
Usare `docker compose` dalla root progetto secondo i profili già predisposti.

---

## 7) Account e ruoli
- Admin seed (se presente da init): account admin già predisposto.
- Admin può:
  - importare planimetrie
  - creare dipendenti
- User (dipendente) può:
  - vedere mappa interattiva condivisa
  - selezionare postazione e prenotare
  - cancellare prenotazioni nel limite consentito

---

## 8) API principali
- Auth
  - `POST /api/auth/login`
  - `POST /api/auth/register`
  - `GET /api/auth/me`
- Rooms/Map
  - `GET /api/rooms`
  - `GET /api/rooms/desks?roomCode=...&bookingDate=...`
  - `GET /api/rooms/layout`
  - `GET /api/rooms/layout/image`
- Booking
  - `POST /api/bookings`
  - `GET /api/bookings/me`
  - `PATCH /api/bookings/{id}/cancel`
- Admin
  - `POST /api/admin/layout/import`
  - `POST /api/admin/layout/asset`
  - `POST /api/admin/users`

---

## 9) File chiave modificati di recente
Backend:
- `backend/src/main/resources/application.yml`
- `backend/src/main/java/com/exprivia/deskbooking/controller/AdminController.java`
- `backend/src/main/java/com/exprivia/deskbooking/controller/RoomController.java`
- `backend/src/main/java/com/exprivia/deskbooking/controller/ApiExceptionHandler.java`
- `backend/src/main/java/com/exprivia/deskbooking/service/LayoutAssetService.java`
- `backend/src/main/java/com/exprivia/deskbooking/dto/LayoutAssetDtos.java`

Frontend:
- `frontend/src/app/services/booking.service.ts`
- `frontend/src/app/components/dashboard/dashboard.component.ts`
- `frontend/src/app/components/dashboard/dashboard.component.html`
- `frontend/src/app/components/dashboard/dashboard.component.css`
- `frontend/src/app/components/map/map.component.html`
- `frontend/src/app/components/map/map.component.css`
- `frontend/src/styles.css`

---

## 10) Cosa fare adesso (checklist)
1. **Riavvia backend** (fondamentale dopo modifica limiti multipart)
2. Mantieni frontend e ai-service attivi
3. Rifai il flusso admin: Analizza file → Salva layout su DB
4. Fai login dipendente e verifica mappa interattiva caricata
5. Testa prenotazione/cancellazione

---

## 11) Roadmap consigliata (prossimi step)
- Versioning planimetrie (storico e rollback)
- Audit log admin (chi ha importato cosa e quando)
- Filtri UX (postazioni libere, area preferita)
- Notifiche mail per conferma/cancellazione
- Test E2E (Cypress/Playwright) sul flusso completo

---

## 12) Prompt consigliato per un’altra IA
"Sto sviluppando una webapp Desk Booking Exprivia con backend Spring Boot, frontend Angular e ai-service OCR FastAPI. L’obiettivo è permettere ai dipendenti di prenotare la propria postazione da planimetria SVG caricata dall’admin. Il progetto è già operativo con auth JWT, booking rules e mappa interattiva. Ho bisogno di supporto su hardening, UX enterprise e test E2E. Usa il file PROJECT_HANDOVER.md come contesto principale e proponi miglioramenti incrementali senza rompere i flussi attuali."