from pathlib import Path
import zipfile,hashlib,json,subprocess,tempfile,shutil,sys
HERE=Path(__file__).resolve().parent;S=HERE.parent
if len(sys.argv)!=3:sys.exit('Usage: python check_install.py original-round-2.zip path/to/fresh/project')
P=Path(sys.argv[2]).resolve();checks=[]
def h(data):return hashlib.sha256(data).hexdigest()
def record(name,passed,**data):checks.append({'name':name,'passed':bool(passed),**data});assert passed,(name,data)
with zipfile.ZipFile(sys.argv[1]) as z:original={name[8:]:h(z.read(name)) for name in z.namelist() if name.startswith('project/') and not name.endswith('/') and not name.startswith('project/apps/web/public/portal-studio/variants/05-operations/')}
record('Fresh baseline before React patch matches uploaded project',all(h((P/key).read_bytes())==value for key,value in original.items()),files=len(original))
command=['python',str(S/'install.py'),'--project',str(P)]
a=subprocess.run(command+['--check'],capture_output=True,text=True);record('Installer dry run succeeds',a.returncode==0);record('Dry run changes no original files',all(h((P/key).read_bytes())==value for key,value in original.items()))
a=subprocess.run(command,capture_output=True,text=True);record('Scoped install succeeds',a.returncode==0)
changed=[key for key,value in original.items() if h((P/key).read_bytes())!=value];expected=['apps/web/src/App.jsx','apps/web/src/components/AdvisingPage.jsx','apps/web/src/components/StudentDirectoryPage.jsx']
record('Exactly the three documented integration files change',sorted(changed)==sorted(expected),changed=changed)
for key,value in original.items():
 if key not in expected:record('Original file unchanged: '+key,h((P/key).read_bytes())==value)
before={key:h((P/key).read_bytes()) for key in original};a=subprocess.run(command,capture_output=True,text=True);record('Installer is idempotent',a.returncode==0 and all(h((P/key).read_bytes())==v for key,v in before.items()))
a=subprocess.run(command+['--undo'],capture_output=True,text=True);record('Undo exactly restores original source',a.returncode==0 and all(h((P/key).read_bytes())==v for key,v in original.items()))
app=P/'apps/web/src/App.jsx';old=app.read_text();app.write_text(old.replace('import FinancialRecordsPage from "./components/FinancialRecordsPage.jsx";','// incompatible original import removed for installer test'))
before={key:h((P/key).read_bytes()) for key in original};a=subprocess.run(command,capture_output=True,text=True);record('Unknown baseline fails without partial writes',a.returncode!=0 and all(h((P/key).read_bytes())==v for key,v in before.items()));app.write_text(old)
a=subprocess.run(command,capture_output=True,text=True);record('Final fresh install succeeds',a.returncode==0)
for f in (S/'react').iterdir():record('Adapter copied exactly: '+f.name,h(f.read_bytes())==h((P/'apps/web/src/operations'/f.name).read_bytes()))
for folder in ['01-front-desk','02-student-life','03-academic-setup','04-advising']:record('Sibling folder preserved: '+folder,(P/'apps/web/public/portal-studio/variants'/folder/'pages.js').is_file())
report={'checks':checks,'originalProjectFiles':len(original),'originalFilesChanged':changed,'result':'passed'};(HERE/'reports/integrity-report.json').write_text(json.dumps(report,indent=2));print('PASS',len(checks),'original files',len(original),'changed',changed)
