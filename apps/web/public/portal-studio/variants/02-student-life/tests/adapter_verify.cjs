#!/usr/bin/env node
// Syntax and route/prop contract checks with stubbed React components.
// Does not start Vite, MongoDB, or the API and does not certify their behavior.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
let ts;try{ts=require(process.env.TYPESCRIPT_MODULE||'typescript')}catch{console.error('Provide the TypeScript compiler module via TYPESCRIPT_MODULE or install it in the test environment.');process.exit(2)}
const sourcePath=path.join(__dirname,'../integration/StudentLifeRoutes.jsx');
const result=ts.transpileModule(fs.readFileSync(sourcePath,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS},reportDiagnostics:true,fileName:sourcePath});
const results=[];function test(name,fn){try{fn();results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:e.message})}}
test('adapter:jsx-syntax',()=>assert.equal(result.diagnostics.length,0));
const adapterExports={};
const types={};for(const name of ['StudentRecordsPage','PreferencesPage','MyAdvisorPage','CalendarSyncPage','StudentSchedulingPage','StaffSchedulesPage'])types[name]=function(){};
const context={exports:adapterExports,require(id){if(id==='react/jsx-runtime')return {jsx:(type,props,key)=>({type,props,key}),jsxs:(type,props,key)=>({type,props,key})};return types;}};
vm.runInNewContext(result.outputText,context);
const Route=adapterExports.default;const noop=()=>{};
const props=(role,key,extra={})=>({pageKey:key,token:'test-token',profile:{role,studentProfileId:'SELF'},notify:noop,onOpen:noop,...extra});
const roles=['normalStudent','advisingStudent','advisor','coordinator','administrator'];
const expected={'my-schedule':roles,'my-courses':roles.slice(0,2),'schedule-swap':roles.slice(0,1),records:roles.slice(1,4),preferences:roles.slice(1,4),'my-advisor':['advisingStudent'],'calendar-sync':roles.slice(0,2)};
for(const [key,allowed] of Object.entries(expected))for(const role of roles)test(`adapter:permission:${key}:${role}`,()=>assert.equal(adapterExports.canOpenStudentLifeRoute(key,role),allowed.includes(role)));
test('adapter:unknown-route-null',()=>assert.equal(Route(props('advisingStudent','not-owned')),null));
test('adapter:no-token-no-component',()=>assert.equal(Route(props('advisingStudent','records',{token:null})).type,'section'));
test('adapter:student-record-context-cannot-change-owner',()=>{const e=Route(props('advisingStudent','records',{context:{_id:'OTHER'}}));assert.equal(e.type,types.StudentRecordsPage);assert.equal(e.props.profileId,'SELF');});
test('adapter:staff-record-requires-selected-profile',()=>assert.equal(Route(props('advisor','records')).type,'section'));
test('adapter:staff-selected-record',()=>{const e=Route(props('advisor','records',{context:{_id:'STUDENT',fullName:'Selected student'}}));assert.equal(e.props.profileId,'STUDENT');assert.equal(e.props.viewerRole,'advisor');assert.equal(e.props.subjectName,'Selected student');});
test('adapter:student-prefs-context-cannot-change-owner',()=>assert.equal(Route(props('advisingStudent','preferences',{context:{_id:'OTHER'}})).props.profileId,'SELF'));
test('adapter:staff-preferences-use-current-component',()=>assert.equal(Route(props('advisor','preferences')).type,types.PreferencesPage));
test('adapter:staff-schedules-use-staff-endpoint-component',()=>assert.equal(Route(props('administrator','my-schedule')).type,types.StaffSchedulesPage));
test('adapter:normal-schedule-uses-own-component',()=>assert.equal(Route(props('normalStudent','my-schedule')).type,types.StudentSchedulingPage));
test('adapter:calendar-keeps-token',()=>assert.equal(Route(props('normalStudent','calendar-sync')).props.token,'test-token'));
test('adapter:advisor-component',()=>assert.equal(Route(props('advisingStudent','my-advisor')).type,types.MyAdvisorPage));
test('adapter:slot-request-handoff',()=>{let target;const e=Route(props('advisingStudent','my-schedule',{onOpen:k=>target=k}));e.props.onOpenSlotChanges();assert.equal(target,'slot-changes')});
test('adapter:normal-no-slot-request-handoff',()=>assert.equal(Route(props('normalStudent','my-schedule')).props.onOpenSlotChanges,undefined));
test('adapter:draft-handoff-preserves-term',()=>{let target,ctx;const e=Route(props('advisor','preferences',{onOpen:(k,c)=>{target=k;ctx=c}}));e.props.onOpenDraftSchedule({_id:'student'},'term');assert.equal(target,'student-schedules');assert.equal(ctx.termId,'term');assert.equal(ctx.draftStudent._id,'student');});
console.log(JSON.stringify({scope:'Transpiled route contract with stub components, not a production integration run',checks:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results},null,2));process.exitCode=results.some(r=>!r.passed)?1:0;
