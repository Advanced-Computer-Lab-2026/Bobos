#!/usr/bin/env python3
"""Apply the optional React integration to an exact supplied baseline. Never touches authentication or API implementation."""
import argparse,hashlib,json,shutil,subprocess,sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('project',type=Path,help='Path containing apps/web');p.add_argument('--check',action='store_true',help='Verify hashes and patch applicability without changing files');args=p.parse_args()
root=args.project.resolve();here=Path(__file__).resolve().parent;bundle=here.parent
hashes=json.loads((here/'baseline-hashes.json').read_text())
for name,wanted in hashes.items():
 file=root/name
 if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest()!=wanted:
  sys.exit(f'Baseline mismatch: {name}. Nothing changed. Review react-integration.patch manually instead.')
patch=here/'react-integration.patch'
check=subprocess.run(['git','apply','--check',str(patch)],cwd=root,capture_output=True,text=True)
if check.returncode:sys.exit(check.stderr)
if args.check:print('Both source hashes match; scoped patch applies cleanly.');sys.exit(0)
destination=root/'apps/web/src/components/academic-setup'
if destination.exists():sys.exit(f'{destination} already exists. Nothing changed; review the existing integration first.')
backups={name:(root/name).read_bytes() for name in hashes}
try:
 subprocess.run(['git','apply',str(patch)],cwd=root,check=True)
 shutil.copytree(bundle/'react',destination)
except Exception:
 for name,data in backups.items():(root/name).write_bytes(data)
 if destination.exists():shutil.rmtree(destination)
 raise
print('AcademicWorkspace.jsx and GroupAssignmentsPage integrated; real API callbacks and authentication preserved.')
