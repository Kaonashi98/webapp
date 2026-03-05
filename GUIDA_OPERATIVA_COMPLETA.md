# Guida Operativa Completa – Desk Booking Exprivia

Questa guida spiega **come avviare, usare, testare e manutenere** il progetto end-to-end.

## 1) Obiettivo del progetto
Webapp per prenotare postazioni da planimetria interattiva:
- Admin carica planimetria (SVG/PDF/immagine), OCR estrae stanze/postazioni.
- Dipendente seleziona stanza/postazione e conferma prenotazione.
- Regole business: max 1 prenotazione/giorno, max 5/settimana, gestione cancellazioni.

## 2) Stack usato
- Frontend: Angular 20
- Backend: Spring Boot 3.4 + Java 21
- DB: PostgreSQL 16
- AI OCR: Python 3.12 + FastAPI + Tesseract
- Orchestrazione: Docker Compose

## 3) Struttura progetto
- `backend/`
- `frontend/`
- `ai-service/`
- `docker/initdb/schema.sql`
- `docker-compose.yml`

## 4) Avvio rapido (Docker completo)
Apri PowerShell e vai in root progetto:
```powershell
cd C:\Users\ammin\Desktop\webapp
```
Avvia tutto con rebuild:
```powershell
docker compose --profile fullstack up --build
```
URL:
- Frontend: http://localhost:4200
- Backend health: http://localhost:8080/api/health
- AI health: http://localhost:8000/health

### Fermare stack
```powershell
docker compose down
```

### Pulizia completa volumi (attenzione: cancella dati DB)
```powershell
docker compose down -v
```

## 5) Avvio locale (senza fullstack Docker)
### DB
```powershell
cd C:\Users\ammin\Desktop\webapp
docker compose up -d postgres
```

### Backend
```powershell
cd C:\Users\ammin\Desktop\webapp\backend
mvn spring-boot:run
```

### Frontend
```powershell
cd C:\Users\ammin\Desktop\webapp\frontend
npm install
npm start
```

### AI service
```powershell
cd C:\Users\ammin\Desktop\webapp\ai-service
python -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

## 6) Account admin seed
- Email: `admin@exprivia.local`
- Password: `password`

## 7) Flusso corretto Admin
1. Login admin
2. Sezione Import Planimetria
3. Seleziona file
4. `Analizza file`
5. `Salva layout su DB`
6. Gestione planimetrie caricate:
   - Se attiva: etichetta `Planimetria attiva`
   - Altre: `Rendi attiva`, `Elimina`

## 8) Flusso corretto Dipendente
1. Seleziona stanza (click singolo)
2. Seleziona postazione
3. Scroll automatico al bottone `Conferma prenotazione`
4. Conferma prenotazione
5. In `Le mie prenotazioni future` la nuova prenotazione lampeggia in verde

## 9) Cancellazioni prenotazioni
### Future
- Click `Cancella`
- Messaggio `Prenotazione cancellata`
- Card lampeggia rosso 5 volte
- Dopo 2 secondi sparisce dalla lista future

### Passate
- Pulsante `Elimina` disponibile
- Rimozione definitiva dalla lista

## 10) Query DB utili (PostgreSQL)
Entra in psql:
```powershell
docker exec -it deskbooking-postgres psql -U deskbooking -d deskbooking
```

Utenti:
```sql
select id, employee_code, full_name, email, role from users order by id;
```

Prenotazioni:
```sql
select b.id, u.full_name, r.code as room, d.desk_number, b.booking_date, b.status
from bookings b
join users u on u.id = b.user_id
join desks d on d.id = b.desk_id
join rooms r on r.id = d.room_id
order by b.booking_date desc, b.id desc;
```

Postazioni attive:
```sql
select r.code, d.desk_number, d.is_active
from desks d
join rooms r on r.id = d.room_id
order by r.code, d.desk_number;
```

## 11) Endpoint principali
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/rooms`
- `GET /api/rooms/availability?bookingDate=YYYY-MM-DD`
- `GET /api/rooms/desks?roomCode=A5&bookingDate=YYYY-MM-DD`
- `POST /api/bookings`
- `GET /api/bookings/me`
- `PATCH /api/bookings/{id}/cancel`
- `DELETE /api/bookings/{id}` (passate/cancellate)
- `POST /api/admin/layout/import`
- `POST /api/admin/layout/asset`
- `GET /api/admin/layouts`
- `POST /api/admin/layouts/{layoutId}/activate`
- `DELETE /api/admin/layouts/{layoutId}`

## 12) Problemi comuni e soluzioni
### Errore Docker pipe `dockerDesktopLinuxEngine`
- Avvia Docker Desktop e attendi engine running.
- Verifica con `docker version`.

### 404 su refresh frontend
- Ricostruisci frontend Docker (Nginx SPA fallback):
```powershell
cd C:\Users\ammin\Desktop\webapp
docker compose --profile fullstack up --build frontend
```

### AI service non raggiungibile
- Verifica: `http://localhost:8000/health`

### DB non coerente dopo test
- Reset completo:
```powershell
cd C:\Users\ammin\Desktop\webapp
docker compose down -v
docker compose up -d postgres
```

## 13) Check rapido prima demo
1. Login admin OK
2. Import planimetria OK
3. Mappa interattiva visibile
4. Login dipendente OK
5. Prenotazione creata e visibile in future
6. Cancellazione future con blink rosso + rimozione 2s
7. Eliminazione prenotazioni passate OK

## 14) Comandi quotidiani consigliati
Accensione completa:
```powershell
cd C:\Users\ammin\Desktop\webapp
docker compose --profile fullstack up --build
```

Spegnimento:
```powershell
docker compose down
```

Aggiornamento solo frontend docker:
```powershell
docker compose --profile fullstack up --build frontend
```

## 15) Riavvio rapido dopo modifiche codice
Per assicurarti che tutte le modifiche siano caricate correttamente:

```powershell
cd C:\Users\ammin\Desktop\webapp
docker compose down
docker compose --profile fullstack up --build
```

Se hai cambiato solo il frontend:

```powershell
cd C:\Users\ammin\Desktop\webapp
docker compose --profile fullstack up --build frontend
```

Se hai cambiato solo backend:

```powershell
cd C:\Users\ammin\Desktop\webapp
docker compose --profile fullstack up --build backend
```


docker exec -i deskbooking-postgres psql -U deskbooking -d deskbooking -c "select count(*) from bookings;"
per eliminare tutte le prenotazioni