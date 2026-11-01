"""Extrae el texto de la documentación de un cliente para que los agentes la lean sin abrir Office.

Uso:  python -I scripts/clientes/extraer-texto.py clientes/<slug> [--forzar] [--sin-convertir]

Lee clientes/<slug>/origen/ (nunca lo modifica) y escribe en clientes/<slug>/trabajo/:
  texto/<ruta>.md        texto de cada archivo (encabezados y pies incluidos: ahí suelen estar código y revisión)
  convertidos/<ruta>     copia .docx/.xlsx de los .doc/.xls (Word/Excel por COM, macros deshabilitadas)
  inventario-bruto.md    una fila por archivo con los códigos y revisiones detectados

Solo biblioteca estándar. Los PDF no se extraen: se leen con la herramienta Read.
Es incremental: salta los archivos cuyo texto ya es más nuevo que el original (--forzar para rehacer todo).
"""

import os
import re
import subprocess
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
S = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PKG_REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"

MAX_MEMBER_BYTES = 50 * 1024 * 1024
MAX_CHARS = 200_000
MAX_ROWS = 300
MAX_COLS = 40

LEGACY = {".doc": (".docx", "word"), ".xls": (".xlsx", "excel"), ".rtf": (".docx", "word")}
WORD_EXT = {".docx", ".docm", ".dotx"}
EXCEL_EXT = {".xlsx", ".xlsm", ".xltx"}

CODE_IN_NAME = re.compile(r"^((?:[A-Z]{1,4}[ ._-]?\d{1,3}[ ._-]*){1,3})")
REV_IN_NAME = re.compile(r"\bR(?:ev\.?)?\s?(\d{1,2})\b", re.IGNORECASE)
CODE_IN_TEXT = re.compile(r"C[óo]d(?:igo)?\.?\s*(?:N[°º]\s*)?[:：]?\s*([A-Z]{1,5}[ ._-]?\d{1,3}(?:[ ._-]?[A-Z]{0,4}[ ._-]?\d{1,3}){0,2})")
BARE_CODE = re.compile(r"\b[A-Z]{1,4}[ -]?\d{2,3}(?:[ -][A-Z]{1,4}[ -]?\d{2,3}){0,2}\b")
REV_IN_TEXT = re.compile(r"Rev(?:isi[óo]n)?\.?\s*(?:N[°º])?\s*[:：]?\s*(\d{1,3})\b", re.IGNORECASE)


def read_xml(zf, name):
    info = zf.getinfo(name)
    if info.file_size > MAX_MEMBER_BYTES:
        raise ValueError(f"{name} supera {MAX_MEMBER_BYTES // (1024 * 1024)} MB descomprimido")
    return ET.fromstring(zf.read(name))


def cell(text):
    return " ".join(text.split()).replace("|", "\\|")


def para_text(p):
    out = []
    for node in p.iter():
        if node.tag == W + "t" and node.text:
            out.append(node.text)
        elif node.tag == W + "tab":
            out.append("\t")
        elif node.tag in (W + "br", W + "cr"):
            out.append("\n")
    return "".join(out).strip()


def word_blocks(container):
    lines = []
    for child in container:
        if child.tag == W + "p":
            text = para_text(child)
            if not text:
                continue
            style = child.find(f"{W}pPr/{W}pStyle")
            val = (style.get(W + "val") or "") if style is not None else ""
            if re.search(r"heading|t[íi]tulo|titulo", val, re.IGNORECASE):
                text = "## " + text
            lines.append(text)
        elif child.tag == W + "tbl":
            rows = []
            for tr in child.iter(W + "tr"):
                cells = [cell(" / ".join(t for t in (para_text(p) for p in tc.iter(W + "p")) if t)) for tc in tr.findall(W + "tc")]
                if any(cells):
                    rows.append("| " + " | ".join(cells) + " |")
            if rows:
                lines.append("\n".join(rows))
        elif child.tag == W + "sdt":
            content = child.find(W + "sdtContent")
            if content is not None:
                lines.extend(word_blocks(content))
    return lines


def extract_docx(path):
    with zipfile.ZipFile(path) as zf:
        names = zf.namelist()
        parts = []
        for prefix, title in (("word/header", "Encabezado"), ("word/footer", "Pie")):
            for name in sorted(n for n in names if n.startswith(prefix) and n.endswith(".xml")):
                lines = word_blocks(read_xml(zf, name))
                if lines:
                    parts.append(f"### {title} ({Path(name).stem})\n" + "\n".join(lines))
        body = read_xml(zf, "word/document.xml").find(W + "body")
        parts.append("### Cuerpo\n" + "\n\n".join(word_blocks(body) if body is not None else []))
    return "\n\n".join(parts)


def col_index(ref):
    letters = re.match(r"[A-Z]+", ref or "")
    n = 0
    for ch in letters.group(0) if letters else "":
        n = n * 26 + ord(ch) - 64
    return n


def extract_xlsx(path):
    with zipfile.ZipFile(path) as zf:
        names = set(zf.namelist())
        shared = []
        if "xl/sharedStrings.xml" in names:
            for si in read_xml(zf, "xl/sharedStrings.xml").findall(S + "si"):
                shared.append("".join(t.text or "" for t in si.iter(S + "t")))
        rels = {}
        if "xl/_rels/workbook.xml.rels" in names:
            for rel in read_xml(zf, "xl/_rels/workbook.xml.rels").findall(PKG_REL + "Relationship"):
                target = rel.get("Target", "").lstrip("/")
                rels[rel.get("Id")] = target if target.startswith("xl/") else "xl/" + target
        parts = []
        sheets = read_xml(zf, "xl/workbook.xml").find(S + "sheets")
        for sheet in sheets if sheets is not None else []:
            target = rels.get(sheet.get(R + "id"))
            if not target or target not in names:
                continue
            root = read_xml(zf, target)
            out = [f"## Hoja: {sheet.get('name')}"]
            hf = root.find(S + "headerFooter")
            if hf is not None:
                for node in hf:
                    if node.text:
                        clean = re.sub(r"&[A-Za-z]|&\"[^\"]*\"|&\d+", " ", node.text)
                        out.append(f"- {node.tag.replace(S, '')}: {cell(clean)}")
            rows_seen = 0
            for row in root.iter(S + "row"):
                values = {}
                for c in row.findall(S + "c"):
                    kind = c.get("t")
                    if kind == "inlineStr":
                        value = "".join(t.text or "" for t in c.iter(S + "t"))
                    else:
                        v = c.find(S + "v")
                        value = v.text if v is not None and v.text else ""
                        if kind == "s" and value.isdigit() and int(value) < len(shared):
                            value = shared[int(value)]
                    if value.strip():
                        values[col_index(c.get("r"))] = cell(value)
                if not values:
                    continue
                rows_seen += 1
                if rows_seen > MAX_ROWS:
                    out.append(f"… (hoja truncada en {MAX_ROWS} filas con datos)")
                    break
                last = min(max(values), MAX_COLS)
                out.append(f"{row.get('r', '?')}: | " + " | ".join(values.get(i, "") for i in range(1, last + 1)) + " |")
            parts.append("\n".join(out))
    return "\n\n".join(parts)


def extract_pptx(path):
    with zipfile.ZipFile(path) as zf:
        slides = sorted((n for n in zf.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)), key=lambda n: int(re.findall(r"\d+", n)[-1]))
        return "\n\n".join(
            f"## Diapositiva {i}\n" + " ".join(t.text for t in read_xml(zf, n).iter(A + "t") if t.text)
            for i, n in enumerate(slides, 1)
        )


PS_CONVERT = {
    "word": "$a=New-Object -ComObject Word.Application;$a.Visible=$false;$a.DisplayAlerts=0;$a.AutomationSecurity=3;"
    "try{$d=$a.Documents.Open($env:SGI_SRC,$false,$true);$d.SaveAs2($env:SGI_DST,16);$d.Close($false)}finally{$a.Quit()}",
    "excel": "$a=New-Object -ComObject Excel.Application;$a.Visible=$false;$a.DisplayAlerts=$false;$a.AutomationSecurity=3;"
    "try{$w=$a.Workbooks.Open($env:SGI_SRC,0,$true);$w.SaveAs($env:SGI_DST,51);$w.Close($false)}finally{$a.Quit()}",
}


def convert_legacy(src, dst, app):
    dst.parent.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, "SGI_SRC": str(src.resolve()), "SGI_DST": str(dst.resolve())}
    subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", PS_CONVERT[app]],
        env=env, check=True, capture_output=True, timeout=180,
    )
    if not dst.exists():
        raise RuntimeError("Office no generó el archivo convertido")


def detect(name, text):
    stem = Path(name).stem
    by_name = CODE_IN_NAME.match(stem)
    rev_name = REV_IN_NAME.findall(stem)
    head = text[:4000]
    # Sin etiqueta "Código:", el código suele estar suelto en el encabezado (primeras líneas)
    codes = CODE_IN_TEXT.findall(head) or BARE_CODE.findall(text.split("### Cuerpo")[0][:1500])
    return {
        "codigo_nombre": by_name.group(1).strip(" ._-") if by_name else "",
        "codigo_texto": ", ".join(dict.fromkeys(m.strip() for m in codes))[:60],
        "rev": (rev_name[-1] if rev_name else "") or ", ".join(dict.fromkeys(REV_IN_TEXT.findall(head)))[:20],
    }


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__)
        return 2
    base = Path(args[0])
    origen, trabajo = base / "origen", base / "trabajo"
    if not origen.is_dir():
        print(f"No existe {origen}")
        return 2
    force, convert = "--forzar" in argv, "--sin-convertir" not in argv and os.name == "nt"
    rows, errors = [], 0
    for src in sorted(p for p in origen.rglob("*") if p.is_file() and not p.name.startswith("~$")):
        rel = src.relative_to(origen)
        ext = src.suffix.lower()
        out = trabajo / "texto" / (str(rel) + ".md")
        status, text, readable = "ok", "", src
        try:
            if ext in LEGACY:
                new_ext, app = LEGACY[ext]
                readable = trabajo / "convertidos" / rel.with_suffix(new_ext)
                if convert and (force or not readable.exists()):
                    convert_legacy(src, readable, app)
                if not readable.exists():
                    raise RuntimeError("formato antiguo: convertir con Office o pedir .docx/.xlsx")
                ext = new_ext
            if ext == ".pdf":
                status = "leer con Read (PDF)"
            elif ext not in WORD_EXT | EXCEL_EXT | {".pptx"}:
                status = "sin extractor"
            elif not force and out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
                text = out.read_text(encoding="utf-8")
                status = "ok (sin cambios)"
            else:
                text = extract_docx(readable) if ext in WORD_EXT else extract_xlsx(readable) if ext in EXCEL_EXT else extract_pptx(readable)
                if len(text) > MAX_CHARS:
                    text = text[:MAX_CHARS] + f"\n\n… (truncado en {MAX_CHARS} caracteres)"
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_text(f"# {rel.as_posix()}\n\n{text}\n", encoding="utf-8")
        except Exception as exc:  # un archivo roto no frena el inventario
            status, errors = f"error: {type(exc).__name__}: {cell(str(exc))[:120]}", errors + 1
        found = detect(src.name, text)
        rows.append(
            f"| {len(rows) + 1} | {cell(rel.as_posix())} | {src.suffix.lower()} | {src.stat().st_size // 1024} "
            f"| {cell(found['codigo_nombre'])} | {cell(found['codigo_texto'])} | {cell(found['rev'])} "
            f"| {'texto/' + cell(rel.as_posix()) + '.md' if text else ''} | {status} |"
        )
    trabajo.mkdir(parents=True, exist_ok=True)
    (trabajo / "inventario-bruto.md").write_text(
        "# Inventario bruto (generado por scripts/clientes/extraer-texto.py — no editar a mano)\n\n"
        "| # | Archivo | Tipo | KB | Código (nombre) | Código (texto) | Rev. | Texto | Estado |\n"
        "|---|---|---|---|---|---|---|---|---|\n" + "\n".join(rows) + "\n",
        encoding="utf-8",
    )
    print(f"{len(rows)} archivos, {errors} con error. Ver {trabajo / 'inventario-bruto.md'}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main(sys.argv[1:]))
