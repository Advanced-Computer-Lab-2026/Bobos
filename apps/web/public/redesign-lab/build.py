from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]
fonts = ['StyreneB-Regular.otf', 'StyreneB-Medium.otf', 'StyreneB-Bold.otf', 'TiemposText-Regular.woff2', 'TiemposText-Semibold.woff2', 'TiemposHeadline-Bold.woff2']
(ROOT / 'fonts').mkdir(exist_ok=True)
for name in fonts:
    if (ROOT / 'fonts' / name).is_file():
        continue
    data = subprocess.check_output(['git', '-C', str(REPO), 'show', f'186b1b5:apps/web/public/fonts/{name}'])
    (ROOT / 'fonts' / name).write_bytes(data)
css = (ROOT / 'styles.css').read_text(encoding='utf-8')
js = (ROOT / 'app.js').read_text(encoding='utf-8')
names = ['Quiet', 'Editorial', 'Studio', 'Clay', 'Contrast']
for number, name in enumerate(names, 1):
    html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>bobos — {name}</title><style>{css}</style></head>
<body class="v{number}" data-version="{number}"><a class="skip" href="#content">Skip to content</a><div id="app"></div><dialog id="dialog"></dialog><div id="toast" role="status" aria-live="polite"></div><script>{js}</script></body></html>'''
    (ROOT / f'{number:02}-{name.lower()}.html').write_text(html, encoding='utf-8')
    if number == 1:
        (ROOT / 'index.html').write_text(html, encoding='utf-8')
print('Built five standalone HTML previews with local fonts.')
