from pypdf import PdfReader
from pathlib import Path
import pytesseract
from pdf2image import convert_from_path
from PIL import Image


def parse_pdf(file_path: str) -> str:
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return text


def is_scanned_pdf(file_path: str) -> bool:
    reader = PdfReader(file_path)
    for page in reader.pages:
        text = page.extract_text()
        if text and len(text.strip()) > 50:
            return False
    return True


def parse_pdf_with_ocr(file_path: str, dpi: int = 300) -> str:
    pages = convert_from_path(file_path, dpi=dpi)
    text = ""
    for page in pages:
        page_text = pytesseract.image_to_string(page)
        text += page_text + "\n\n"
    return text


def parse_pdf_ocr_fallback(file_path: str) -> str:
    text = parse_pdf(file_path)
    if text and len(text.strip()) > 50:
        return text
    return parse_pdf_with_ocr(file_path)


def get_pdf_metadata(file_path: str) -> dict:
    reader = PdfReader(file_path)
    return {
        "num_pages": len(reader.pages),
        "metadata": reader.metadata if reader.metadata else {}
    }