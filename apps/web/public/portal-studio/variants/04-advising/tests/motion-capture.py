#!/usr/bin/env python3
"""Capture exposed drawing poses from the integrated studio, not a separately rendered animation."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright

def run(args):
 out=Path(args.output);out.mkdir(parents=True,exist_ok=True);records=[]
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox']);p=b.new_page(viewport={'width':1440,'height':1000});p.goto(args.url+'?preview=live&role=coordinator');p.locator('#auth-form button[type=submit]').click();p.evaluate('lab.dark=false;applyLook();render()')
  for key,kind in [('directory','folder'),('mandatory-removals','letter')]:
   p.evaluate('(key)=>{page=key;render();}',key);p.locator('#content > label select').select_option('3');p.wait_for_timeout(1200)
   p.locator('[data-ad4-action=next-record]').click();start=p.evaluate('performance.now()')
   for i,target in enumerate([0,120,240,380,650,1150]):
    elapsed=p.evaluate('performance.now()')-start
    if target>elapsed:p.wait_for_timeout(target-elapsed)
    art=p.locator('.ad4-context [data-ad4-art]').first;pose=art.get_attribute('data-pose');elapsed=round(p.evaluate('performance.now()')-start)
    art.screenshot(path=str(out/f'{kind}-{i}.png'));records.append({'kind':kind,'frame':i,'observedPose':pose,'observedMilliseconds':elapsed,'trigger':'Next record in the actual preview'})
   p.screenshot(path=str(out/f'{kind}-rest-in-context.png'),full_page=False)
  b.close()
 (out/'motion-captures.json').write_text(json.dumps(records,indent=2));print(json.dumps(records,indent=2))
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8000/portal-studio/index.html');a.add_argument('--output',default='motion-evidence');a.add_argument('--browser',default='/usr/bin/chromium');run(a.parse_args())
