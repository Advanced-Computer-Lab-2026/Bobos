#!/usr/bin/env python3
"""Install only Chat 05's React adapters and narrowly scoped import/prop edits.
Run: python path/to/variants/05-operations/install.py --project path/to/project
Use --check for a dry run, --undo to reverse only this installer's exact edits.
The studio plugin itself needs only folder copying, not this installer.
"""
import argparse, difflib, hashlib, json, shutil, sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
EDITS={
 'apps/web/src/App.jsx':[
  ('import FinancialRecordsPage from "./components/FinancialRecordsPage.jsx";', 'import FinancialRecordsPage from "./operations/FinancialRecordsPage.jsx";'),
  ('import { CalendarSyncPage, PendingWorkPage, ScheduleActivityPage } from "./components/B1Pages.jsx";', 'import { CalendarSyncPage } from "./components/B1Pages.jsx";\nimport { PendingWorkPage, ScheduleActivityPage } from "./operations/B1Pages.jsx";'),
  ('import ExtraHoursPage from "./components/ExtraHoursPage.jsx";', 'import ExtraHoursPage from "./operations/ExtraHoursPage.jsx";'),
  ('import GraduationReview, { StudentGraduation } from "./components/GraduationReview.jsx";', 'import GraduationReview, { StudentGraduation } from "./operations/GraduationReview.jsx";'),
  ('<StudentGraduation token={token} />','<StudentGraduation token={token} role={profile.role} />'),
  ('<PendingWorkPage token={token} />','<PendingWorkPage token={token} role={profile.role} onOpen={openScreen} />'),
  ('<ScheduleActivityPage token={token} />','<ScheduleActivityPage token={token} role={profile.role} />'),
  ('<ExtraHoursPage token={token} role={profile.role} notify={notify} />','<ExtraHoursPage token={token} role={profile.role} actorId={profile._id} notify={notify} />'),
 ],
 'apps/web/src/components/AdvisingPage.jsx':[
  ('import GraduationPlans from "./GraduationPlans.jsx";', 'import GraduationPlans from "../operations/GraduationPlans.jsx";'),
  ('<GraduationPlans student={graduationStudent} token={token} onBack=', '<GraduationPlans student={graduationStudent} token={token} role={role} onBack='),
 ],
 'apps/web/src/components/StudentDirectoryPage.jsx':[
  ('import { ScheduleActivityPage } from "./B1Pages.jsx";', 'import { ScheduleActivityPage } from "../operations/B1Pages.jsx";'),
  ('<ScheduleActivityPage token={token} studentId={details._id} />','<ScheduleActivityPage token={token} role={role} studentId={details._id} />'),
 ],
}
def plan(project,undo=False):
 changes=[]
 for relative,edits in EDITS.items():
  path=project/relative
  if not path.is_file():raise ValueError(f'Missing baseline file: {path}')
  old=path.read_text();new=old
  for before,after in edits:
   if undo:before,after=after,before
   if before in new:
    if new.count(before)!=1:raise ValueError(f'Ambiguous patch in {relative}: {before}')
    new=new.replace(before,after,1)
   elif after not in new:raise ValueError(f'Baseline differs at {relative}: {before}. No files changed.')
  changes.append((relative,old,new))
 return changes

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--project',type=Path,required=True);p.add_argument('--check',action='store_true');p.add_argument('--undo',action='store_true');p.add_argument('--write-patch',type=Path);a=p.parse_args()
 try:changes=plan(a.project,a.undo)
 except (OSError,ValueError) as error:sys.exit(str(error))
 if a.write_patch:
  a.write_patch.write_text(''.join(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/'+relative,tofile='b/'+relative)) for relative,old,new in changes))
 for relative,old,new in changes:
  print(('UNCHANGED' if old==new else 'WOULD CHANGE' if a.check else 'UPDATED'),relative)
 if not a.check:
  if not a.undo:
   destination=a.project/'apps/web/src/operations';destination.mkdir(exist_ok=True)
   for source in (HERE/'react').iterdir():
    if source.is_file():shutil.copy2(source,destination/source.name)
  for relative,old,new in changes:
   if old!=new:(a.project/relative).write_text(new)
  # Undo leaves adapters in place to avoid deleting another integrator's edits.
 print('No shell, authentication, shared CSS, calendar, API or package dependencies are modified.')
if __name__=='__main__':main()
