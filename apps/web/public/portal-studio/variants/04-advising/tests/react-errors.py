#!/usr/bin/env python3
"""Error recovery, detail responsiveness and keyboard checks. HTTP fixtures only, not backend proof."""
import argparse,importlib.util,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('contract',Path(__file__).with_name('react-contract.py'));contract=importlib.util.module_from_spec(spec);spec.loader.exec_module(contract)
def run(args):
 out=Path(args.output);out.mkdir(parents=True,exist_ok=True);results={'checks':[],'detailRenders':[],'errors':[],'backend':'HTTP fixtures only'}
 def check(name,ok=True):assert ok,name;results['checks'].append(name)
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1440,'height':1000});ctx.add_init_script("localStorage.setItem('bobos.token','contract-test-token')");p=ctx.new_page();p.on('pageerror',lambda e:results['errors'].append(str(e)));state,route=contract.fixtures('coordinator');p.route('**/api/**',route);p.goto(args.url)
  p.locator('.sidebar').get_by_role('button',name='Slot change requests',exact=True).click();state['fail']=('/api/slot-changes','GET',503);p.get_by_label('Page design',exact=True).select_option('3');expect(p.get_by_role('alert')).to_contain_text('unavailable');p.get_by_role('button',name='Retry loading',exact=True).click();p.get_by_role('button',name=re.compile('Review 70-71577')).wait_for();check('queue service failure and retry')
  p.get_by_label('From',exact=True).fill('2026-11-19');p.get_by_label('To',exact=True).fill('2026-11-01');expect(p.get_by_role('alert')).to_contain_text('end date');p.get_by_role('button',name='Clear filters',exact=True).click();check('invalid date range has actionable feedback')
  state['fail']=('/api/slot-changes/'+f'{100:024x}','GET',500);p.get_by_role('button',name=re.compile('Review 70-71577')).click();expect(p.get_by_role('alert')).to_contain_text('unavailable');check('failed opening leaves no stale decision controls',p.get_by_role('button',name='Approve change',exact=True).count()==0);p.get_by_role('button',name='Retry loading',exact=True).click();p.locator('input[name=replacementSlotId]:enabled').first.wait_for();check('detail retry opens requested record')
  # All ten choices with an opened record; preserve exact current request and selection across choices.
  p.locator('input[name=replacementSlotId]:enabled').first.check()
  for width,height in [(1440,1000),(390,844)]:
   p.set_viewport_size({'width':width,'height':height})
   for mode in ['light','dark']:
    p.evaluate('(m)=>document.documentElement.dataset.theme=m',mode)
    for n in range(1,11):
     p.get_by_label('Page design',exact=True).select_option(str(n));p.wait_for_timeout(30);overflow=p.evaluate('document.documentElement.scrollWidth>innerWidth+1');assert not overflow,(n,width,mode);results['detailRenders'].append({'route':'slot-changes-staff','design':n,'width':width,'theme':mode,'overflow':overflow})
     if (mode=='light' and width==1440) or n==3 or (mode=='light' and n in [8,9]):p.screenshot(path=str(out/f'slot-detail-{n}-{mode}-{width}.png'),full_page=False)
  p.set_viewport_size({'width':1440,'height':1000});p.evaluate("document.documentElement.dataset.theme='light'");p.get_by_label('Page design',exact=True).select_option('9');p.get_by_role('button',name='2. Alternatives',exact=True).click();check('slot selection survives design and step changes',p.locator('input[name=replacementSlotId]:checked').count()==1);p.get_by_role('button',name='3. Decision',exact=True).click();p.get_by_label('Response to student (optional)').fill('Please use the available Thursday slot.');p.get_by_role('button',name='Approve change',exact=True).click();p.keyboard.press('Escape');check('confirmation Escape restores focused action',p.get_by_role('button',name='Approve change',exact=True).evaluate('(e)=>document.activeElement===e'))
  p.get_by_role('button',name='Approve change',exact=True).click();state['fail']=('/decision','POST',503);p.locator('dialog.ad4r-dialog').get_by_role('button',name='Approve change',exact=True).click();expect(p.locator('dialog.ad4r-dialog')).to_contain_text('unavailable');check('failed decision retains confirmation and response',p.get_by_label('Response to student (optional)').input_value()=='Please use the available Thursday slot.');p.locator('dialog.ad4r-dialog').get_by_role('button',name='Approve change',exact=True).click();expect(p.get_by_role('heading',name='Decision record',exact=True)).to_be_visible();check('decision retry resolves using server response')
  p.get_by_role('button',name='← Back to request queue').click();p.get_by_role('button',name=re.compile('Review 70-71580')).click();expect(p.locator('.ad4r-reader')).to_contain_text('Withdrawn');check('withdrawn request is read-only',p.get_by_role('button',name='Approve change',exact=True).count()==0)
  p.locator('.sidebar').get_by_role('button',name='Account and advisor access',exact=True).click();state['fail']=('/api/admin/students','GET',503);p.get_by_label('Page design',exact=True).select_option('3');expect(p.get_by_role('alert')).to_contain_text('unavailable');p.get_by_role('button',name='Retry loading',exact=True).click();p.get_by_role('button',name='Open record',exact=True).first.wait_for();check('account directory failure and retry')
  p.get_by_role('button',name='Open record',exact=True).first.click();p.get_by_label('Active advisor',exact=True).wait_for()
  for width,height in [(1440,1000),(390,844)]:
   p.set_viewport_size({'width':width,'height':height})
   for mode in ['light','dark']:
    p.evaluate('(m)=>document.documentElement.dataset.theme=m',mode)
    for n in range(1,11):
     p.get_by_label('Page design',exact=True).select_option(str(n));p.wait_for_timeout(30);overflow=p.evaluate('document.documentElement.scrollWidth>innerWidth+1');assert not overflow,(n,width,mode);results['detailRenders'].append({'route':'account-administration','design':n,'width':width,'theme':mode,'overflow':overflow})
     if (mode=='light' and width==1440) or n==3 or (mode=='light' and n in [6,10]):p.screenshot(path=str(out/f'account-detail-{n}-{mode}-{width}.png'),full_page=False)
  p.set_viewport_size({'width':1440,'height':1000});p.evaluate("document.documentElement.dataset.theme='light'");p.get_by_label('Page design',exact=True).select_option('10');p.get_by_role('button',name='2. Review and act',exact=True).click();p.get_by_label('Active advisor',exact=True).select_option(contract.B);p.get_by_role('button',name='Save reassignment',exact=True).click();state['fail']=('/advisor','PATCH',403);p.locator('dialog.ad4r-dialog').get_by_role('button',name='Save assignment',exact=True).click();expect(p.locator('dialog.ad4r-dialog')).to_contain_text('unavailable');check('server authorization error retains assignment form',p.get_by_label('Active advisor',exact=True).input_value()==contract.B);p.locator('dialog.ad4r-dialog').get_by_role('button',name='Cancel',exact=True).click();check('failed assignment does not mutate record',state['students'][0]['assignedAdvisor']['_id']==contract.A)
  p.get_by_role('button',name='← Back to students').click();expect(p.get_by_placeholder('Student ID, name or GUC email')).to_be_visible();p.get_by_placeholder('Student ID, name or GUC email').fill('absent');p.get_by_role('button',name='Apply filters',exact=True).click();expect(p.get_by_text('No matching students',exact=True)).to_be_visible();p.get_by_role('button',name='Clear filters',exact=True).click();check('account empty results and explicit return-to-search')
  # Original is genuinely the pre-existing renderer, not a fabricated eleventh design.
  p.get_by_label('Page design',exact=True).select_option('0');check('account Original restores native directory',p.locator('.ad4r-admin').count()==0 and p.get_by_role('heading',name='Student directory',exact=True).count()==1)
  p.locator('.sidebar').get_by_role('button',name='Slot change requests',exact=True).click();check('independent slot preference retained',p.get_by_label('Page design',exact=True).input_value()=='9');p.get_by_label('Page design',exact=True).select_option('0');check('slot Original restores native component',p.locator('.ad4r-slots').count()==0)
  b.close()
 check('no JavaScript errors',not results['errors']);(out/'react-errors-results.json').write_text(json.dumps(results,indent=2));print(json.dumps({'detailRenders':len(results['detailRenders']),'checks':len(results['checks']),'errors':results['errors']},indent=2))
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:5173');a.add_argument('--output',default='react-error-evidence');a.add_argument('--browser',default='/usr/bin/chromium');run(a.parse_args())
