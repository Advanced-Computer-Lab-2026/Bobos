#!/usr/bin/env python3
"""Compare a fresh copy-only integration against the supplied baseline ZIP."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--baseline-zip',required=True)
parser.add_argument('--installed-root',required=True,help='Directory containing project/ and START-HERE.md')
parser.add_argument('--output',default='baseline-integrity.json')
args=parser.parse_args()
root=Path(args.installed_root); rows=[]
owned='project/apps/web/public/portal-studio/variants/02-student-life/'
with zipfile.ZipFile(args.baseline_zip) as archive:
    for info in archive.infolist():
        if info.is_dir() or info.filename.startswith(owned):continue
        path=root/info.filename
        digest=hashlib.sha256(archive.read(info)).hexdigest()
        same=path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest()==digest
        rows.append({'path':info.filename,'sha256':digest,'unchanged':same})
report={'scope':'Every uploaded file outside the owned contributor folder, including START-HERE.md','checked':len(rows),'unchanged':sum(r['unchanged'] for r in rows),'changed':[r['path'] for r in rows if not r['unchanged']],'files':rows}
Path(args.output).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='files'},indent=2))
raise SystemExit(bool(report['changed']))
