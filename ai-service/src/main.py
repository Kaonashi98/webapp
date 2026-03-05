from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .ocr_processor import process_layout

app = FastAPI(title="Desk Booking OCR Service", version="0.0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "UP", "service": "desk-booking-ai-service"}


@app.post("/ocr/process")
async def ocr_process(file: UploadFile = File(...)):
    filename = file.filename or "layout.bin"
    if not filename.lower().endswith((".svg", ".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff")):
        raise HTTPException(status_code=400, detail="Formato non supportato. Usa SVG/PDF/immagine.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File vuoto")

    try:
        result = process_layout(content, filename)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return result
