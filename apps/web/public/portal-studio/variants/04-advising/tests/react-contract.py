#!/usr/bin/env python3
"""Browser API-contract tests against the actual React App. Fixtures intercept HTTP only in this test.
Usage: python react-contract.py --url http://127.0.0.1:5173 --output ./react-evidence
Requires Python Playwright and a Chromium executable. Does not test MongoDB/SMTP atomicity.
"""
import argparse, copy, json, re
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect

A='a'*24; B='b'*24
STUDENTS=[{'id':f'{i+1:024x}','studentId':f'70-{71577+i}','fullName':name,'email':name.lower().replace(' ','.')+'@student.guc.edu.eg','studentType':'normal' if i==3 else 'advising','major':'Computer Engineering','currentSemester':7,'academicStanding':'veryGood','assignedAdvisor':{'_id':A,'fullName':'Dr. Salma Adel','email':'salma.adel@guc.edu.eg'},'accountStatus':'inactive' if i==4 else 'active','workflowStatus':'readyForStudentReview','blockingStep':'None','lastUpdatedAt':'2026-11-18T09:30:00Z'} for i,name in enumerate(['Omar Hassan','Mariam Mostafa','Ahmed Khaled','Farah Mahmoud','Youssef Tarek'])]
ROSTER=[{'_id':A,'fullName':'Dr. Salma Adel','email':'salma.adel@guc.edu.eg'},{'_id':B,'fullName':'Dr. Hany Youssef','email':'hany.youssef@guc.edu.eg'}]

def fixtures(role):
    students=copy.deepcopy(STUDENTS); roster=copy.deepcopy(ROSTER)
    requests=[]
    for i,s in enumerate(students[:4]):
        requests.append({'_id':f'{100+i:024x}','student':{'_id':s['id'],'studentId':s['studentId'],'user':{'fullName':s['fullName'],'email':s['email']},'assignedAdvisor':s['assignedAdvisor']},'course':{'_id':f'{200+i:024x}','code':['CSEN 701','CSEN 703','CSEN 704','DMET 701'][i],'name':'Published course'},'term':{'code':'Winter 2026/2027'},'componentType':'tutorial','currentSlotLabel':'Group 4 · Tuesday 10:00–11:30 · C1.204','preferenceNote':'A Thursday tutorial would fit my commute better.','status':['pending','pending','approved','withdrawn'][i],'createdAt':f'2026-11-{13+i}T09:00:00Z','replacementSlotLabel':'Group 2 · Thursday 12:00–13:30 · C1.204' if i==2 else '', 'responseNote':'Changed to the available group.' if i==2 else ''})
    state={'students':students,'roster':roster,'requests':requests,'calls':[],'fail':None,'membership':True}
    def route(handler):
        request=handler.request; url=urlparse(request.url); path=url.path; query=parse_qs(url.query); method=request.method; body=request.post_data_json if request.post_data else None
        state['calls'].append({'path':path,'method':method,'body':body})
        status=200; result={}
        if state['fail'] and state['fail'][0] in path and method==state['fail'][1]:
            status=state['fail'][2];result={'message':'The last seat was taken.' if status==409 else 'Service temporarily unavailable.'};state['fail']=None
        elif path=='/api/identity/profile': result={'profile':{'_id':'f'*24,'fullName':'Nadia Ahmed' if role=='coordinator' else 'Portal Reviewer','email':'nadia.ahmed@guc.edu.eg','role':role}}
        elif path=='/api/identity/login':result={'token':'contract-test-token'}
        elif path=='/api/identity/logout':result={'message':'Signed out'}
        elif path=='/api/academic-terms/academicTerm':result=[{'_id':'e'*24,'code':'Winter 2026/2027','season':'Winter','academicYear':'2026/2027','isActive':True,'termStart':'2026-10-01','termEnd':'2027-01-31'}]
        elif path=='/api/admin/pending-work':result={'students':[]}
        elif path=='/api/admin/schedule-activity':result={'activities':[]}
        elif path=='/api/admin/students':
            rows=state['students'];search=query.get('search',[''])[0].lower()
            rows=[s for s in rows if search in f"{s['studentId']} {s['fullName']} {s['email']}".lower() and all(not query.get(k) or s.get(k)==query[k][0] for k in ['accountStatus','studentType']) and (not query.get('advisor') or s['assignedAdvisor'].get('_id')==query['advisor'][0])]
            result={'students':rows,'filters':{'advisors':[dict(id=a['_id'],fullName=a['fullName']) for a in state['roster']]},'term':{'season':'Winter','academicYear':'2026/2027'}}
        elif re.match(r'^/api/admin/students/[^/]+$',path):
            s=next(s for s in state['students'] if s['id']==path.rsplit('/',1)[1]);result={'_id':s['id'],'studentId':s['studentId'],'studentType':s['studentType'],'major':s['major'],'currentSemester':s['currentSemester'],'academicStanding':s['academicStanding'],'assignedAdvisor':s['assignedAdvisor'],'user':{'_id':s['id'],'fullName':s['fullName'],'email':s['email'],'isActive':s['accountStatus']=='active'}}
        elif '/api/admin/users/' in path and path.endswith('/status'):
            s=next(s for s in state['students'] if s['id']==path.split('/')[-2]);s['accountStatus']='active' if body['isActive'] else 'inactive';result={'isActive':body['isActive']}
        elif path=='/api/advisor/advisors':result=state['roster']
        elif path=='/api/admin/advisors/lookup':
            email=query.get('email',[''])[0]
            if email=='dina.samir@guc.edu.eg':result={'fullName':'Dr. Dina Samir','email':email,'isAdvisorInSystem':False}
            elif email in [a['email'] for a in ROSTER]:result={'fullName':'Dr. Salma Adel','email':email,'isAdvisorInSystem':state['membership']}
            else:status=404;result={'message':'Advisor not found.'}
        elif path=='/api/admin/advisors' or path.startswith('/api/admin/advisors/'):
            state['membership']=method=='POST';result={'emailStatus':'sent'}
            if method=='DELETE':
                state['roster']=[a for a in state['roster'] if a['email'] not in path]
                for s in state['students']:
                    if s['assignedAdvisor'].get('email') in path:s['assignedAdvisor']={}
        elif re.match(r'^/api/advisor/students/[^/]+/advisor$',path):
            s=next(s for s in state['students'] if s['id']==path.split('/')[-2]);s['assignedAdvisor']=next(a for a in state['roster'] if a['_id']==body['advisorId']);result={'message':'Assigned'}
        elif path=='/api/slot-changes':result={'requests':state['requests'] if role=='coordinator' else state['requests'][:2]}
        elif path.startswith('/api/slot-changes/'):
            rid=path.split('/')[3];r=next(r for r in state['requests'] if r['_id']==rid)
            if path.endswith('/decision'):
                r['status']=body['decision'];r['responseNote']=body.get('responseNote','');r['decidedBy']={'fullName':'Nadia Ahmed'};r['decidedAt']='2026-11-20T12:00:00Z';r['replacementSlotLabel']='Group 2 · Thursday 12:00–13:30 · C1.204' if body['decision']=='approved' else '';result={'message':'Request '+body['decision']+'.'}
            else:result={'request':r,'current':{'type':'tutorial','groupNumber':4,'day':'Tuesday','startTime':'10:00','endTime':'11:30','room':'C1.204'},'alternatives':[{'slotId':f'{400+i:024x}','type':'tutorial','groupNumber':i+2,'remainingSeats':[3,0,5][i],'clashes':['CSEN 703 lecture'] if i==2 else [],'meetings':[{'slotId':f'{400+i:024x}','day':'Thursday','startTime':'12:00','endTime':'13:30','room':'C1.204'}]} for i in range(3)],'issue':None}
        else:status=404;result={'message':'Endpoint not in this contract fixture: '+path}
        handler.fulfill(status=status,content_type='application/json',body=json.dumps(result))
    return state,route

def run(args):
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True);result={'renders':[],'checks':[],'errors':[],'backend':'HTTP contract fixtures; no MongoDB/SMTP execution'}
    with sync_playwright() as pw:
        b=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox'])
        for role in ['coordinator','administrator','advisor']:
            context=b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
            context.add_init_script("localStorage.setItem('bobos.token','contract-test-token')")
            p=context.new_page();p.on('pageerror',lambda e:result['errors'].append(str(e)))
            state,route=fixtures(role);p.route('**/api/**',route)
            p.goto(args.url);p.locator('.sidebar').wait_for();p.wait_for_timeout(250)
            pages=['account-administration','slot-changes-staff'] if role=='coordinator' else ['account-administration'] if role=='administrator' else ['slot-changes-staff']
            for key in pages:
                label='Account and advisor access' if key=='account-administration' else 'Slot change requests'
                p.locator('.sidebar').get_by_role('button',name=label,exact=True).click()
                design=p.get_by_role('combobox',name='Page design');expect(design).to_have_value('0')
                for mode in ['light','dark']:
                    p.evaluate('(mode)=>document.documentElement.dataset.theme=mode',mode)
                    for size in [(1440,1000),(390,844)]:
                        # Keep the existing shell in the screenshot; change only viewport and the design dropdown.
                        p.set_viewport_size({'width':size[0],'height':size[1]})
                        for n in range(1,11):
                            design.select_option(str(n));p.wait_for_timeout(55)
                            overflow=p.evaluate('document.documentElement.scrollWidth>innerWidth+1')
                            result['renders'].append({'role':role,'route':key,'design':n,'theme':mode,'width':size[0],'overflow':overflow})
                            assert not overflow,(key,role,n,mode,size,'overflow')
                            assert p.get_by_role('combobox',name='Page design').count()==1
                            if role=='coordinator' and mode=='light' and n in [3,5,10]:p.screenshot(path=str(out/f'{key}-{n}-{size[0]}.png'),full_page=False)
                p.set_viewport_size({'width':1440,'height':1000});p.evaluate("document.documentElement.dataset.theme='light'");design.select_option('3');p.wait_for_timeout(100)
                # Independent remembered design survives route departure and return.
                p.locator('.sidebar').get_by_role('button',name='Overview',exact=True).click();p.locator('.sidebar').get_by_role('button',name=label,exact=True).click();expect(p.get_by_role('combobox',name='Page design')).to_have_value('3');result['checks'].append(f'{role}:{key}:navigation persistence')
                if key=='slot-changes-staff':
                    p.get_by_placeholder('Student ID, name or course').fill('no such record');expect(p.get_by_text('No matching requests',exact=True)).to_be_visible();p.get_by_role('button',name='Clear filters',exact=True).click();result['checks'].append(f'{role}:slot empty and clear')
                    p.get_by_role('button',name=re.compile('Review 70-71577')).click();p.locator('.ad4r-reader h2').wait_for();assert p.locator('input[name=replacementSlotId]:disabled').count()==2
                    expect(p.get_by_role('button',name='Approve change',exact=True)).to_be_disabled();result['checks'].append(f'{role}:full and clashing alternatives disabled; exact selection required')
                    p.locator('input[name=replacementSlotId]:enabled').first.check();p.get_by_label('Response to student (optional)').fill('Thursday fits and has room.');p.get_by_role('button',name='Approve change',exact=True).click();expect(p.locator('dialog.ad4r-dialog')).to_be_visible();p.get_by_role('button',name='Cancel',exact=True).click();assert not [c for c in state['calls'] if c['path'].endswith('/decision')]
                    result['checks'].append(f'{role}:confirmation cancellation sends no decision')
                    if role=='coordinator':
                        state['fail']=('/decision','POST',409);p.get_by_role('button',name='Approve change',exact=True).click();p.locator('dialog.ad4r-dialog').get_by_role('button',name='Approve change',exact=True).click();expect(p.get_by_role('alert')).to_contain_text('last seat');expect(p.locator('input[name=replacementSlotId]:checked')).to_have_count(0);result['checks'].append('coordinator:409 clears stale slot and reloads request')
                        p.locator('input[name=replacementSlotId]:enabled').first.check()
                    p.get_by_role('button',name='Approve change',exact=True).click();p.locator('dialog.ad4r-dialog').get_by_role('button',name='Approve change',exact=True).click();expect(p.get_by_role('heading',name='Decision record',exact=True)).to_be_visible();assert state['requests'][0]['status']=='approved';assert state['calls'][-3:];result['checks'].append(f'{role}:exact approval POST and resolved record')
                    p.screenshot(path=str(out/f'{role}-slot-resolved.png'),full_page=False)
                    p.get_by_role('button',name='← Back to request queue').click();p.get_by_role('button',name=re.compile('Review 70-71578')).click();p.get_by_role('button',name='Reject request',exact=True).click();p.locator('dialog.ad4r-dialog').get_by_role('button',name='Reject request',exact=True).click();expect(p.get_by_role('heading',name='Decision record',exact=True)).to_be_visible();assert state['requests'][1]['status']=='rejected';result['checks'].append(f'{role}:rejection without replacement or mandatory note')
                else:
                    p.get_by_role('button',name='Open record',exact=True).first.click();p.locator('.ad4r-account-reader h2').wait_for()
                    if role=='administrator':
                        assert p.get_by_role('button',name='Look up advisor',exact=True).count()==0
                        p.get_by_role('button',name='Deactivate account',exact=True).click();p.get_by_role('button',name='Cancel',exact=True).click();assert not [c for c in state['calls'] if c['method']=='PATCH'];result['checks'].append('admin:account cancellation sends no PATCH; no advisor controls')
                        p.get_by_role('button',name='Deactivate account',exact=True).click();p.get_by_role('button',name='Confirm account change',exact=True).click();expect(p.get_by_role('button',name='Activate account',exact=True)).to_be_visible();assert state['students'][0]['accountStatus']=='inactive';result['checks'].append('admin:confirmed account PATCH and fresh state')
                    else:
                        assert p.get_by_role('button',name='Deactivate account',exact=True).count()==0
                        p.get_by_label('Active advisor',exact=True).select_option(B);p.get_by_role('button',name='Save reassignment',exact=True).click();p.locator('dialog.ad4r-dialog').get_by_role('button',name='Save assignment',exact=True).click();expect(p.locator('.ad4r-account-reader')).to_contain_text('Dr. Hany Youssef');assert state['students'][0]['assignedAdvisor']['_id']==B;result['checks'].append('coordinator:assignment PATCH; no account toggle')
                        p.get_by_label('Advisor GUC email',exact=True).fill('unknown@guc.edu.eg');p.get_by_role('button',name='Look up advisor',exact=True).click();expect(p.get_by_role('alert')).to_contain_text('Advisor not found');result['checks'].append('coordinator:invalid advisor lookup feedback')
                        p.get_by_label('Advisor GUC email',exact=True).fill('salma.adel@guc.edu.eg');p.get_by_role('button',name='Look up advisor',exact=True).click();p.get_by_role('button',name='Remove advisor',exact=True).click();p.get_by_role('button',name='Confirm advisor access',exact=True).click();expect(p.get_by_role('status')).to_contain_text('Email status: sent');assert not state['membership'];result['checks'].append('coordinator:membership DELETE and server email status')
                        p.get_by_label('Advisor GUC email',exact=True).fill('dina.samir@guc.edu.eg');p.get_by_role('button',name='Look up advisor',exact=True).click();p.get_by_role('button',name='Add advisor',exact=True).click();p.get_by_role('button',name='Confirm advisor access',exact=True).click();expect(p.get_by_role('status')).to_contain_text('Advisor added');result['checks'].append('coordinator:membership POST')
                    p.screenshot(path=str(out/f'{role}-account-action.png'),full_page=False)
            context.close()
        b.close()
    assert not result['errors'],result['errors'];(out/'react-contract-results.json').write_text(json.dumps(result,indent=2));print(json.dumps({'renders':len(result['renders']),'checks':len(result['checks']),'errors':result['errors']},indent=2))

if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:5173');a.add_argument('--output',default='react-evidence');a.add_argument('--browser',default='/usr/bin/chromium');run(a.parse_args())
