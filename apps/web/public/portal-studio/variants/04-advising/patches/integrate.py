#!/usr/bin/env python3
"""Install only the two owned React route adapters. No backend or shell styling changes."""
from pathlib import Path
import argparse, shutil, sys

IMPORT = 'import SlotChangesPage from "./components/SlotChangesPage.jsx";'
NEW_IMPORT = IMPORT + '\nimport SlotChangeStaffRoute from "./variants/advising04/SlotChangeStaff.jsx";\nimport AccountAdvisorRoute from "./variants/advising04/AccountAdvisorAdmin.jsx";'
NAV = '        { id: "directory", label: "Student directory" },'
NEW_NAV = NAV + '\n        { id: "account-administration", label: "Account and advisor access" },'
TITLE = '  "financial-records": "Financial records",'
NEW_TITLE = TITLE + '\n  "account-administration": "Account and advisor access",'
DIRECTORY = '          {activeScreen === "directory" && <StudentDirectoryPage token={token} role={profile.role} notify={notify} />}'
NEW_DIRECTORY = DIRECTORY + '\n          {activeScreen === "account-administration" && <AccountAdvisorRoute token={token} role={profile.role} Original={<StudentDirectoryPage token={token} role={profile.role} notify={notify} />} />}'
SLOTS = '          {activeScreen === "slot-changes" && <SlotChangesPage token={token} role={profile.role} onOpenSchedule={() => openScreen("my-schedule")} />}'
NEW_SLOTS = '          {activeScreen === "slot-changes" && (["advisor", "coordinator"].includes(profile.role) ? <SlotChangeStaffRoute token={token} role={profile.role} Original={<SlotChangesPage token={token} role={profile.role} onOpenSchedule={() => openScreen("my-schedule")} />} /> : <SlotChangesPage token={token} role={profile.role} onOpenSchedule={() => openScreen("my-schedule")} />)}'
REPLACEMENTS = [(IMPORT,NEW_IMPORT),(NAV,NEW_NAV),(TITLE,NEW_TITLE),(DIRECTORY,NEW_DIRECTORY),(SLOTS,NEW_SLOTS)]

def patched(text):
    for old,new in REPLACEMENTS:
        if new in text: continue
        if text.count(old) != 1:
            raise ValueError(f'Expected one integration anchor, found {text.count(old)}: {old[:90]}')
        text = text.replace(old,new,1)
    return text

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--project',type=Path,required=True,help='Supplied project root containing apps/web')
    p.add_argument('--apply',action='store_true',help='Apply after all preconditions pass; otherwise check only')
    args=p.parse_args(); app=args.project/'apps/web/src/App.jsx'; source=Path(__file__).resolve().parent.parent/'react'
    if not app.is_file(): p.error(f'App.jsx not found: {app}')
    original=app.read_text(); result=patched(original)
    destination=app.parent/'variants/advising04'
    files=sorted(source.glob('*'))
    for file in files:
        target=destination/file.name
        if target.exists() and target.read_bytes()!=file.read_bytes():
            raise ValueError(f'Refusing to replace a differing installed adapter: {target}. Review the changes manually.')
    print('Checked: src/App.jsx import, staff navigation, title, account renderer and staff-only slot renderer.')
    print(f'Adapters: {destination} ({len(files)} files)')
    if not args.apply:
        print('No files changed. Repeat with --apply to install.');return
    destination.mkdir(parents=True,exist_ok=True)
    for file in files: shutil.copy2(file,destination/file.name)
    app.write_text(result)
    print('Installed. Existing Directory, student slot requests, authentication, Overview and API files are unchanged.')
if __name__=='__main__':
    try: main()
    except (ValueError,OSError) as error: print(f'Integration stopped: {error}',file=sys.stderr);sys.exit(1)
