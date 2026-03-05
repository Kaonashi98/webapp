# Desk Booking - Exprivia Roma Bufalotta

Monorepo con:
- `backend` Spring Boot 3.4 (Java 21)
- `frontend` Angular 20 (standalone)
- `ai-service` Python OCR (pytesseract)
- `docker` PostgreSQL + init schema

## Struttura

- `backend/` API REST e regole business prenotazione
- `frontend/` UI Login + Dashboard + Mappa interattiva stanze/postazioni
- `ai-service/` estrazione OCR da SVG/PDF/immagini
- `docker/` bootstrap DB (`docker/initdb/schema.sql`)
- `docker-compose.yml` orchestrazione servizi

## Business Rules implementate (backend)

- 1 sola prenotazione per utente al giorno
- max 5 prenotazioni a settimana (Lun-Ven)
- fascia oraria fissa 09:00-18:00
- cancellazione consentita fino a 2 ore prima dell'inizio

## Autenticazione

- JWT stateless su backend con endpoint `register/login/me`
- Frontend Angular usa token in `Authorization: Bearer <jwt>`
- Rotta dashboard protetta da guard

### Utente admin seed (DB)
- Email: `admin@exprivia.local`
- Password: `password`
- Ruolo: `ADMIN`
- Nota: cambia password appena possibile in ambienti non-demo

## Import planimetria (Admin)

- Da dashboard, se sei `ADMIN`, trovi il pannello **Import Planimetria (Admin)**.
- Carica `PDF/SVG/immagine`, clicca **Analizza file** (OCR), verifica preview stanze/postazioni e poi **Salva layout su DB**.
- Endpoint backend usato: `POST /api/admin/layout/import` (solo ADMIN).
- Endpoint AI usato: `POST http://localhost:8000/ocr/process`.

## Prerequisiti

### Runtime locali
- Docker Desktop
- Java 21 + Maven 3.9+
- Node.js 20/22 + npm
- Python 3.12
- Tesseract OCR installato localmente (se avvio AI senza Docker)

### Per OCR locale (Windows)
- Installare Tesseract e aggiungere il path bin alle variabili ambiente.
- In alternativa usare Docker (consigliato) perché nel container è già installato.

## Avvio rapido solo database

Da root progetto:

```bash
docker compose up -d postgres
```

## Avvio stack completo con Docker

```bash
docker compose --profile fullstack up --build
```

Servizi:
- Frontend: http://localhost:4200
- Backend: http://localhost:8080/api/health
- AI service: http://localhost:8000/health
- PostgreSQL: localhost:5432

## Avvio locale servizi (senza Docker fullstack)

### 1) Database
```bash
docker compose down -v
docker compose up -d postgres
```

### 2) Backend
```bash
cd backend
mvn spring-boot:run
```

### 3) Frontend
```bash
cd frontend
npm install
npm start
```

### 4) AI Service
```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

> Dopo aggiornamenti al file `requirements.txt`, rieseguire `pip install -r requirements.txt`.

## Endpoint base

### Backend
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/rooms`
- `GET /api/rooms/desks?roomCode=A26&bookingDate=2026-03-02`
- `GET /api/bookings/me`
- `POST /api/bookings`
  - body:
    ```json
    {
      "deskId": 10,
      "bookingDate": "2026-03-02"
    }
    ```
- `PATCH /api/bookings/{bookingId}/cancel`

### AI Service
- `GET /health`
- `POST /ocr/process` (multipart file)

## Note importanti

- Lo schema DB viene inizializzato da `docker/initdb/schema.sql` al primo bootstrap del volume.
- Per test OCR su planimetrie PDF può servire migliorare preprocessing immagini in base alla qualità del file.
- La mappa Angular è una base interattiva pronta per essere collegata ai dati reali backend/AI.
