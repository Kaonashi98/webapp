import io
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Any

import pytesseract
from PIL import Image
from pdf2image import convert_from_bytes
import fitz

ROOM_REGEX = re.compile(r"\b[A-Z]+\d{1,3}\b", re.IGNORECASE)
DESK_REGEX = re.compile(r"\b\d{1,3}\b")


@dataclass
class OcrToken:
    text: str
    left: int
    top: int
    width: int
    height: int
    confidence: float


def _image_from_bytes(content: bytes, suffix: str) -> List[Image.Image]:
    suffix = suffix.lower()

    if suffix == ".pdf":
        try:
            return convert_from_bytes(content, dpi=300)
        except Exception:
            return _pdf_to_images_with_fitz(content)

    if suffix == ".svg":
        try:
            import cairosvg
        except Exception as exc:
            raise RuntimeError(
                "Supporto SVG non disponibile: manca Cairo/libcairo. "
                "Su Windows installa GTK/Cairo runtime o usa il servizio AI via Docker."
            ) from exc

        png_bytes = cairosvg.svg2png(bytestring=content)
        return [Image.open(io.BytesIO(png_bytes)).convert("RGB")]

    return [Image.open(io.BytesIO(content)).convert("RGB")]


def _pdf_to_images_with_fitz(content: bytes) -> List[Image.Image]:
    images: List[Image.Image] = []
    document = fitz.open(stream=content, filetype="pdf")
    try:
        for page in document:
            pix = page.get_pixmap(dpi=300, alpha=False)
            image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            images.append(image)
    finally:
        document.close()
    return images


def _extract_tokens(image: Image.Image) -> List[OcrToken]:
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    tokens: List[OcrToken] = []

    for i, raw_text in enumerate(data["text"]):
        text = raw_text.strip()
        if not text:
            continue
        conf = float(data["conf"][i]) if data["conf"][i] != "-1" else 0.0
        tokens.append(
            OcrToken(
                text=text,
                left=int(data["left"][i]),
                top=int(data["top"][i]),
                width=int(data["width"][i]),
                height=int(data["height"][i]),
                confidence=conf,
            )
        )

    return tokens


def _parse_numeric_attr(value: str | None) -> int:
    if not value:
        return 0

    first = value.replace(',', ' ').split()[0]
    try:
        return int(float(first))
    except Exception:
        return 0


def _extract_transform_matrix(transform: str | None) -> tuple[float, float, float, float, float, float]:
    if not transform:
        return 1.0, 0.0, 0.0, 1.0, 0.0, 0.0

    matrix_match = re.search(r"matrix\(([^)]+)\)", transform)
    if matrix_match:
        parts = [p.strip() for p in matrix_match.group(1).split(",")]
        if len(parts) == 6:
            try:
                a = float(parts[0])
                b = float(parts[1])
                c = float(parts[2])
                d = float(parts[3])
                e = float(parts[4])
                f = float(parts[5])
                return a, b, c, d, e, f
            except Exception:
                pass

    translate_match = re.search(r"translate\(([^)]+)\)", transform)
    if translate_match:
        parts = [p.strip() for p in translate_match.group(1).replace(",", " ").split()]
        if len(parts) >= 2:
            try:
                return 1.0, 0.0, 0.0, 1.0, float(parts[0]), float(parts[1])
            except Exception:
                pass

    return 1.0, 0.0, 0.0, 1.0, 0.0, 0.0


def _extract_svg_dimensions(root: ET.Element) -> tuple[int, int]:
    view_box = root.attrib.get("viewBox")
    if view_box:
        parts = [p for p in view_box.replace(',', ' ').split() if p]
        if len(parts) == 4:
            try:
                return int(float(parts[2])), int(float(parts[3]))
            except Exception:
                pass

    width = _parse_numeric_attr(root.attrib.get("width"))
    height = _parse_numeric_attr(root.attrib.get("height"))
    return max(1, width), max(1, height)


def _extract_tokens_from_svg(content: bytes) -> tuple[List[OcrToken], int, int]:
    try:
        root = ET.fromstring(content.decode("utf-8", errors="ignore"))
    except Exception:
        return [], 816, 1056

    parent_map = {c: p for p in root.iter() for c in p}

    source_width, source_height = _extract_svg_dimensions(root)
    tokens: List[OcrToken] = []

    for element in root.iter():
        tag_name = element.tag.lower()
        if not tag_name.endswith("text"):
            continue

        text = "".join(element.itertext()).strip()
        if not text:
            continue

        a, b, c, d, e, f = 1.0, 0.0, 0.0, 1.0, 0.0, 0.0
        current = element
        while current is not None:
            transform = current.attrib.get("transform")
            if transform:
                m = _extract_transform_matrix(transform)
                na = m[0]*a + m[1]*c
                nb = m[0]*b + m[1]*d
                nc = m[2]*a + m[3]*c
                nd = m[2]*b + m[3]*d
                ne = m[0]*e + m[1]*f + m[4]
                nf = m[2]*e + m[3]*f + m[5]
                a, b, c, d, e, f = na, nb, nc, nd, ne, nf
            current = parent_map.get(current)

        tspan = None
        for child in element:
            if str(child.tag).lower().endswith("tspan"):
                tspan = child
                break

        span_x = _parse_numeric_attr(tspan.attrib.get("x")) if tspan else 0
        span_y = _parse_numeric_attr(tspan.attrib.get("y")) if tspan else 0

        left = int(a * span_x + c * span_y + e)
        top = int(b * span_x + d * span_y + f)

        tokens.append(
            OcrToken(
                text=text,
                left=left,
                top=top,
                width=0,
                height=0,
                confidence=99.0,
            )
        )

    return tokens, source_width, source_height


def process_layout(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    suffix = Path(filename).suffix or ".png"

    if suffix.lower() == ".svg":
        svg_tokens, source_width, source_height = _extract_tokens_from_svg(file_bytes)
        if svg_tokens:
            all_tokens: List[Dict[str, Any]] = []
            rooms: List[Dict[str, Any]] = []
            desks: List[Dict[str, Any]] = []
            for token in svg_tokens:
                payload = {
                    "text": token.text,
                    "left": token.left,
                    "top": token.top,
                    "width": token.width,
                    "height": token.height,
                    "confidence": token.confidence,
                    "page": 1,
                }
                all_tokens.append(payload)
                if ROOM_REGEX.fullmatch(token.text.upper()):
                    rooms.append(payload)
                elif DESK_REGEX.fullmatch(token.text):
                    desks.append(payload)

            return {
                "filename": filename,
                "pages": 1,
                "sourceWidth": source_width,
                "sourceHeight": source_height,
                "rooms": rooms,
                "desks": desks,
                "tokens": all_tokens,
            }

    pages = _image_from_bytes(file_bytes, suffix)

    all_tokens: List[Dict[str, Any]] = []
    rooms: List[Dict[str, Any]] = []
    desks: List[Dict[str, Any]] = []

    for page_index, image in enumerate(pages, start=1):
        tokens = _extract_tokens(image)
        for token in tokens:
            payload = {
                "text": token.text,
                "left": token.left,
                "top": token.top,
                "width": token.width,
                "height": token.height,
                "confidence": token.confidence,
                "page": page_index,
            }
            all_tokens.append(payload)

            if ROOM_REGEX.fullmatch(token.text.upper()):
                rooms.append(payload)
            elif DESK_REGEX.fullmatch(token.text):
                desks.append(payload)

    return {
        "filename": filename,
        "pages": len(pages),
        "sourceWidth": pages[0].width if pages else 816,
        "sourceHeight": pages[0].height if pages else 1056,
        "rooms": rooms,
        "desks": desks,
        "tokens": all_tokens,
    }
