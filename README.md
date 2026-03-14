# CV Pipeline

Edit `CV.md`, run one command, get `CV.pdf`.

## Setup (first time only)

```bash
pip install -r src/requirements.txt
playwright install chromium
```

## Build

```bash
python src/build.py
```

Reads `CV.md` → writes `CV.pdf`.

## Editing the CV

- All content lives in `CV.md` — edit this file directly or pass it to an AI.
- Section structure uses standard Markdown headings and bullets (see existing file for conventions).
- Never edit `CV.pdf` directly; it is always regenerated from `CV.md`.
