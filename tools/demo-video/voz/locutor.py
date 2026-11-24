"""Locución de la demo: una frase por escena con la voz del guion (edge-tts) y una cadena de locución suave.

Uso: python -I locutor.py <guion.json> <dir de trabajo>
Escribe <trabajo>/voz/<escena>.wav (48 kHz, estéreo) y <trabajo>/voces.json con la duración y los tiempos de cada palabra
(los usan la grabación, para actuar sobre una palabra, y el video, para los subtítulos).
En el texto, `{DEVCEN|Dev Cen}` se muestra como DEVCEN y se lee "Dev Cen"; igual `{SGI|Ese ge i}`.
edge-tts usa el servicio de lectura de Microsoft Edge, que no es una API oficial: para un uso sostenido conviene Azure Speech
con la misma voz (es-UY-ValentinaNeural).
"""

import asyncio
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
import wave
from pathlib import Path

import edge_tts
import imageio_ffmpeg

MARCA = re.compile(r"\{([^|}]*)\|([^}]*)\}")
# Voz masculina (Mateo): graves contenidos, un poco de presencia y compresión leve.
CADENA = (
    "highpass=f=75,"
    "equalizer=f=160:t=q:w=1:g=2,"
    "equalizer=f=3200:t=q:w=1.2:g=2.5,"
    "acompressor=threshold=-18dB:ratio=3:attack=5:release=120:makeup=2.5"
)


def hablado(texto: str) -> str:
    return MARCA.sub(r"\2", texto)


def visible(texto: str) -> str:
    return MARCA.sub(r"\1", texto)


def clave(palabra: str) -> str:
    """Minúsculas, sin tildes ni signos: «Fláier,» → flaier."""
    return "".join(c for c in unicodedata.normalize("NFD", palabra.lower()) if c.isalnum())


def como_se_escribe(texto: str) -> dict:
    """Las marcas de una sola palabra (`{show|shou}`): la voz dice "shou", pero los tiempos tienen que decir "show"
    para que la grabación (`enPalabra("show")`) y los subtítulos la encuentren."""
    return {clave(h): v for v, h in MARCA.findall(texto) if len(h.split()) == 1}


def sintetizar(texto: str, voz: dict, cache: Path) -> tuple[Path, list]:
    """MP3 de la frase y los tiempos de cada palabra; se reutilizan si no cambió nada."""
    clave = hashlib.sha1(f"{voz['nombre']}|{voz['rate']}|{voz['pitch']}|{texto}".encode()).hexdigest()[:16]
    mp3 = cache / f"voz-{clave}.mp3"
    tiempos = cache / f"voz-{clave}.json"
    if not (mp3.exists() and tiempos.exists()):
        cache.mkdir(parents=True, exist_ok=True)
        palabras = []

        async def bajar() -> None:
            lectura = edge_tts.Communicate(texto, voz["nombre"], rate=voz["rate"], pitch=voz["pitch"], boundary="WordBoundary")
            with mp3.open("wb") as f:
                async for trozo in lectura.stream():
                    if trozo["type"] == "audio":
                        f.write(trozo["data"])
                    elif trozo["type"] == "WordBoundary":  # offset y duración en unidades de 100 ns
                        palabras.append([trozo["offset"] / 1e7, trozo["duration"] / 1e7, trozo["text"]])

        asyncio.run(bajar())
        tiempos.write_text(json.dumps(palabras, ensure_ascii=False), encoding="utf-8")
    return mp3, json.loads(tiempos.read_text(encoding="utf-8"))


def duracion(wav: Path) -> float:
    with wave.open(str(wav), "rb") as archivo:
        return archivo.getnframes() / archivo.getframerate()


def main() -> None:
    guion = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    trabajo = Path(sys.argv[2])
    salida = trabajo / "voz"
    salida.mkdir(parents=True, exist_ok=True)
    voces = {}
    for escena in guion["escenas"]:
        texto = escena.get("voz")
        if not texto:
            continue
        mp3, palabras = sintetizar(hablado(texto), guion["voz"], salida / "cache")
        escritas = como_se_escribe(texto)
        palabras = [[a, d, escritas.get(clave(p), p)] for a, d, p in palabras]
        destino = salida / f"{escena['id']}.wav"
        subprocess.run(
            [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", str(mp3), "-af", CADENA,
             "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(destino)],
            check=True,
        )
        voces[escena["id"]] = {
            "archivo": f"voz/{escena['id']}.wav",
            "segundos": round(duracion(destino), 3),
            "texto": visible(texto),
            "palabras": [[round(a, 3), round(d, 3), p] for a, d, p in palabras],
        }
        print(f"{escena['id']}: {voces[escena['id']]['segundos']} s")
    (trabajo / "voces.json").write_text(json.dumps(voces, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
