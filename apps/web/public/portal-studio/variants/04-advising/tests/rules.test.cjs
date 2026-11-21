/* Deterministic PREVIEW policy tests. These do not replace the server's integration tests. */
const assert = require('node:assert/strict');
const R = require('../src/rules.js');
const results = [];
function test(name, fn) { fn(); results.push(name); }
const student = { semester: 7, gpa: 2, standing: 'Very good', reason: '', failedCount: 2, completedHours: 158, restrictedPair: true, bachelorEligible: true };
const courses = [
 {code:'C1',credits:5,type:'core',published:true,eligible:true,components:['lecture','tutorial']},
 {code:'C2',credits:5,type:'core',published:true,eligible:true,components:['lecture']},
 {code:'C3',credits:5,type:'core',published:true,eligible:true,components:['lecture']},
 {code:'H1',credits:4,type:'huma',published:true,eligible:true,components:[]},
 {code:'H2',credits:4,type:'huma',published:true,eligible:true,components:[]},
 {code:'H3',credits:4,type:'huma',published:true,eligible:true,components:[]},
];
const slots = [
 {id:'L1',course:'C1',component:'lecture',group:1,day:'Sunday',start:'08:30',end:'10:00',remaining:1},
 {id:'T1',course:'C1',component:'tutorial',group:1,day:'Monday',start:'08:30',end:'10:00',remaining:2},
 {id:'L2',course:'C2',component:'lecture',group:1,day:'Sunday',start:'10:00',end:'11:30',remaining:1},
 {id:'L3',course:'C3',component:'lecture',group:1,day:'Sunday',start:'09:30',end:'11:00',remaining:0},
];
const baseline = {courses:['C1','C2'],mandatory:['C1'],removed:[],slots:{C1:{lecture:'L1',tutorial:'T1'},C2:{lecture:'L2'}},reserved:[],status:'Draft',pendingSlot:false,pendingRemoval:false,extra:null,bachelor:''};
const draft = (changes = {}) => ({...structuredClone(baseline),...changes});
const valid = (d,s=student,c=courses,sl=slots) => R.validate(d,s,c,sl);
for (const [sem,hours] of [[3,34],[4,34],[5,30],[6,30],[7,28],[8,24],[10,24]]) test(`standard allowance semester ${sem}`,()=>assert.equal(R.allowance({...student,semester:sem}).allowed,hours));
test('GPA boundary 3.70 is probation',()=>assert.equal(R.allowance({...student,gpa:3.7}).allowed,21));
test('GPA below boundary retains standard allowance',()=>assert.equal(R.allowance({...student,gpa:3.69}).allowed,28));
test('standing-based probation without GPA flag',()=>assert.equal(R.allowance({...student,gpa:2,standing:'Probation',semester:3}).allowed,26));
test('reason-based probation rounds 75 percent upward',()=>assert.equal(R.allowance({...student,reason:'Probation',semester:5}).allowed,23));
test('approved unpaid extra hours not activated',()=>assert.equal(R.totals(draft({extra:{approved:true,hours:3,settlement:''}}),student,courses).extra,0));
test('paid approved extra hours activated',()=>assert.equal(R.totals(draft({extra:{approved:true,hours:3,settlement:'paid'}}),student,courses).extra,3));
test('next-installment approved extra hours activated',()=>assert.equal(R.totals(draft({extra:{approved:true,hours:3,settlement:'deferred'}}),student,courses).extra,3));
test('unapproved extra hours not activated',()=>assert.equal(R.totals(draft({extra:{approved:false,hours:3,settlement:'paid'}}),student,courses).extra,0));
test('probation cannot activate extra hours',()=>assert.equal(R.totals(draft({extra:{approved:true,hours:3,settlement:'paid'}}),{...student,gpa:3.8},courses).extra,0));
test('credit total and remaining are derived',()=>assert.deepEqual(R.totals(draft(),student,courses),{selected:10,allowed:28,extra:0,remaining:18}));
test('complete non-clashing draft has no issues',()=>assert.deepEqual(valid(draft()),[]));
test('touching endpoints do not clash',()=>assert.equal(R.overlap(slots[0],slots[2]),false));
test('overlapping intervals clash',()=>assert.equal(R.overlap(slots[0],slots[3]),true));
test('same time on different days does not clash',()=>assert.equal(R.overlap(slots[0],slots[1]),false));
test('missing mandatory course blocks readiness',()=>assert(valid(draft({courses:['C2']})).some(x=>x.includes('mandatory'))));
test('approved mandatory removal lifts selection obligation',()=>assert(!valid(draft({courses:['C2'],removed:['C1']})).some(x=>x.includes('mandatory'))));
test('missing component blocks readiness',()=>assert(valid(draft({slots:{C1:{lecture:'L1'},C2:{lecture:'L2'}}})).some(x=>x.includes('tutorial'))));
test('wrong course component ID rejected',()=>assert(valid(draft({slots:{C1:{lecture:'L2',tutorial:'T1'},C2:{lecture:'L2'}}})).some(x=>x.includes('invalid'))));
test('unpublished offering rejected',()=>assert(valid(draft(),student,courses.map(c=>({...c,published:false}))).some(x=>x.includes('published'))));
test('prerequisite or progression ineligibility rejected',()=>assert(valid(draft(),student,courses.map(c=>({...c,eligible:false}))).some(x=>x.includes('prerequisite'))));
test('unknown catalogue entry rejected',()=>assert(valid(draft({courses:['NONE']})).some(x=>x.includes('catalogue'))));
test('full unreserved component rejected',()=>assert(valid(draft(),student,courses,slots.map(s=>({...s,remaining:0}))).some(x=>x.includes('full'))));
test('existing reservations do not require another seat',()=>assert.deepEqual(valid(draft({reserved:['L1','T1','L2']}),student,courses,slots.map(s=>({...s,remaining:0}))),[]));
test('clash detected between selected course components',()=>assert(valid(draft({courses:['C1','C3'],slots:{C1:{lecture:'L1',tutorial:'T1'},C3:{lecture:'L3'}}})).some(x=>x.includes('clash'))));
test('empty draft can exist but is not ready',()=>assert(valid(draft({courses:[],mandatory:[]})).includes('Select at least one course.')));
test('credit overflow blocked',()=>assert(valid(draft(),student,courses.map(c=>({...c,credits:20}))).some(x=>x.includes('credits exceed'))));
test('ineligible bachelor project blocked',()=>assert(valid(draft({bachelor:'Winter'}),{...student,bachelorEligible:false}).some(x=>x.includes('eligibility'))));
test('bachelor project limited to Winter or Spring',()=>assert(valid(draft({bachelor:'Summer'})).some(x=>x.includes('Winter or Spring'))));
test('bachelor accompanying core courses require extra flow',()=>assert(valid(draft({bachelor:'Winter'})).some(x=>x.includes('extra-hours approval'))));
test('bachelor two core with activated approval valid',()=>assert.deepEqual(valid(draft({bachelor:'Spring',extra:{approved:true,hours:10,settlement:'deferred'}})),[]));
test('bachelor third core blocked',()=>assert(valid(draft({bachelor:'Winter',courses:['C1','C2','C3']})).some(x=>x.includes('at most two core'))));
test('bachelor third humanity blocked',()=>assert(valid(draft({bachelor:'Winter',courses:['H1','H2','H3']})).some(x=>x.includes('at most two core'))));
for (const [key,value,text] of [['pendingSlot',true,'slot-change'],['pendingRemoval',true,'removal'],['extra',{approved:false},'approval'],['extra',{approved:true,settlement:''},'payment']]) test(`processing blocker ${text}`,()=>assert(R.blockers(draft({[key]:value})).some(x=>x.includes(text))));
test('processed state takes precedence',()=>assert.equal(R.status(draft({status:'Processed',pendingSlot:true})),'Processed'));
test('pending slot status derived',()=>assert.equal(R.status(draft({pendingSlot:true})),'Change request pending'));
test('pending approval status derived',()=>assert.equal(R.status(draft({pendingRemoval:true})),'Pending approval'));
test('payment-choice status derived',()=>assert.equal(R.status(draft({extra:{approved:true,settlement:''}})),'Awaiting payment choice'));
test('first makeup eligible independently of failed count',()=>assert(R.removalEligible({...student,failedCount:10},'First makeup')));
test('second makeup at two failed courses eligible',()=>assert(R.removalEligible(student,'Second makeup')));
test('second makeup at three failed courses ineligible',()=>assert(!R.removalEligible({...student,failedCount:3},'Second makeup')));
test('157-hour boundary is strict',()=>assert(!R.removalEligible({...student,completedHours:157},'Completed hours')));
test('158 completed hours eligible',()=>assert(R.removalEligible(student,'Completed hours')));
test('restricted pair requires matching flag',()=>assert(!R.removalEligible({...student,restrictedPair:false},'Restricted pair')));
for(const [role,task,allowed] of [['advisor','advising',true],['advisor','assign',false],['coordinator','assign',true],['coordinator','account',false],['administrator','account',true],['administrator','edit',false],['administrator','removalDecision',false],['advisor','removalRequest',true],['coordinator','removalRequest',false],['coordinator','removalDecision',true],['advisingStudent','edit',false]])test(`permission ${role}/${task}`,()=>assert.equal(R.can(role,task),allowed));
const records=[{name:'Omar Hassan',studentId:'70-71577',email:'omar@student.guc.edu.eg',status:'Draft',date:'2026-11-13'},{name:'Mariam Mostafa',studentId:'70-71578',email:'mariam@student.guc.edu.eg',status:'Processed',date:'2026-11-15'}];
test('search student ID',()=>assert.equal(R.filter(records,{search:'71577'}).length,1));
test('search email case insensitive',()=>assert.equal(R.filter(records,{search:'MARIAM@'}).length,1));
test('combined search and facets',()=>assert.equal(R.filter(records,{search:'omar',status:'Processed'}).length,0));
test('date range inclusive',()=>assert.equal(R.filter(records,{from:'2026-11-13',to:'2026-11-13'}).length,1));
test('empty filters retain records',()=>assert.equal(R.filter(records,{}).length,2));
console.log(JSON.stringify({passed:results.length,checks:results},null,2));
