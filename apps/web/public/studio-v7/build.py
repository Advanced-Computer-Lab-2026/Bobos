from pathlib import Path

ROOT = Path(__file__).resolve().parent
css = (ROOT / 'styles.css').read_text() + '\n' + (ROOT / 'theme-reveal.css').read_text()
js = (ROOT / 'theme-reveal.js').read_text() + '\n' + (ROOT / 'app.js').read_text()
names = ['Folio', 'Atelier', 'Index', 'Commons', 'Studio']
for number, name in enumerate(names, 1):
    html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>Portal — {name}</title><style>{css}</style></head>
<body class="v{number}" data-version="{number}"><a class="skip" href="#content">Skip to content</a><div id="app"></div><dialog id="dialog"></dialog><div id="toast" role="status" aria-live="polite"></div><script>{js}</script></body></html>'''
    (ROOT / f'{number:02}-{name.lower()}.html').write_text(html)
    if number == 1:
        (ROOT / 'index.html').write_text(html)
print('Built V7 — five standalone previews.')
descriptions = [
    'Paper, ice blue, and a shared review table. A spacious academic workspace.',
    'Warm clay, a compact navigation tree, and a broad review surface.',
    'A working review desk. Choose a student and inspect the draft alongside the list.',
    'An open daily agenda with student drafts, a quiet sidebar, and heather tones.',
    'A floating paper workspace with eucalyptus accents and a separate activity column.',
]
cards=''.join(f'''<article><a class="image-link" href="{i:02}-{name.lower()}.html?theme=light"><img src="screenshots/{i:02}-{name.lower()}-light.png" alt="{name} overview in light mode"></a><div class="card-copy"><h2>{name}</h2><p>{description}</p><div class="compare-actions"><a class="btn" href="{i:02}-{name.lower()}.html?theme=light">Explore light</a><a class="btn" href="{i:02}-{name.lower()}.html?theme=dark">Explore dark</a></div></div></article>''' for i,(name,description) in enumerate(zip(names,descriptions),1))
(ROOT/'compare.html').write_text(f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Portal — V7 directions</title><style>{css}
body{{background:#f8f5ef;color:#302f2c}}.comparison{{max-width:1440px;padding:40px;margin:auto}}.compare-head{{display:flex;align-items:center;justify-content:space-between;margin-bottom:36px}}.compare-head .wordmark{{font-size:36px}}.compare-head p{{font-size:12px;margin-top:7px}}.compare-grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px}}.compare-grid article{{background:#fffefa;border:1px solid #e2ddd4;border-radius:13px;overflow:hidden}}.image-link{{display:block;overflow:hidden;aspect-ratio:1.5;background:#efeae2}}.image-link img{{width:100%;height:100%;object-fit:cover;object-position:top;display:block}}.card-copy{{padding:22px}}.card-copy h2{{font-size:23px}}.card-copy p{{font-size:13px;line-height:1.7;margin:9px 0 18px;max-width:500px}}.compare-actions{{display:flex;gap:10px}}.compare-grid article:first-child{{grid-column:1/-1;display:grid;grid-template-columns:1.5fr 1fr}}.compare-grid article:first-child .card-copy{{padding:40px;align-self:center}}.compare-grid article:first-child h2{{font-size:30px}}.compare-grid article:first-child .image-link{{aspect-ratio:1.6}}@media(max-width:800px){{.comparison{{padding:20px}}.compare-grid{{grid-template-columns:1fr;gap:24px}}.compare-grid article:first-child{{display:block}}.compare-grid article:first-child .card-copy{{padding:22px}}.compare-head h1{{font-size:23px}}}}
</style></head><body><main class="comparison"><header class="compare-head"><div><h1>Five directions for Portal</h1><p>V7 · Interactive prototypes · Sample academic data</p></div><a class="wordmark" href="01-folio.html">Portal</a></header><div class="compare-grid">{cards}</div></main></body></html>''')
