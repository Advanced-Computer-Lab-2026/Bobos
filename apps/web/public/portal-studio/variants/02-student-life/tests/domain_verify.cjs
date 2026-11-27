#!/usr/bin/env node
// No package install needed: pure preview rules, registry isolation and PDF structure.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../pages.js'),'utf8');
const store=new Map(); const results=[];
const context={URL,Blob,console,courseData:[['CSEN 701','Embedded Systems','Computer Engineering','5'],['CSEN 703','Analysis & Design of Algorithms','Computer Engineering','5'],['CSEN 704','Advanced Computer Lab','Computer Engineering','4'],['DMET 701','Computer Graphics','Digital Media Engineering','5']],window:{portalVariants:{external:[{name:'Other contributor'}]}},document:{currentScript:{src:'http://localhost/portal-studio/variants/02-student-life/pages.js'},createElement:()=>({dataset:{}}),head:{append(){}}},sessionStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},setTimeout,render(){}};
vm.createContext(context);vm.runInContext(source,context,{filename:'pages.js'});
const api=context.window.PortalStudentLife;
function test(name,fn){try{fn();results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:e.message});}}
const base=()=>({days:['Thursday'],preferred:[],avoided:[],notes:'',priorities:[1,2,3,4],times:[]});
test('registry:only-seven-owned-keys',()=>assert.equal(Object.keys(api.designs).length,7));
for(const key of Object.keys(api.designs)){
 test('registry:'+key+':ten-unique',()=>{assert.equal(context.window.portalVariants[key].length,10);assert.equal(new Set(api.designs[key]).size,10);});
 test('registry:'+key+':callable',()=>assert.ok(context.window.portalVariants[key].every(v=>typeof v.apply==='function')));
}
test('registry:other-contributor-intact',()=>assert.equal(context.window.portalVariants.external[0].name,'Other contributor'));
for(const group of [1,2,4]){
 const rows=api.fixtureMeetings(group);
 test(`meetings:${group}:12`,()=>assert.equal(rows.length,12));
 test(`meetings:${group}:unique-components`,()=>assert.equal(new Set(rows.map(m=>m.id)).size,12));
 test(`meetings:${group}:exact-course-set`,()=>assert.equal([...new Set(rows.map(m=>m.code))].sort().join(','),'CSEN 701,CSEN 703,CSEN 704,DMET 701'));
 test(`meetings:${group}:full-assignment`,()=>assert.ok(rows.every(m=>m.room&&m.instructor&&m.title&&m.start<m.end&&m.group===group)));
 test(`meetings:${group}:no-clashes`,()=>{for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)if(rows[i].day===rows[j].day)assert.ok(rows[i].end<=rows[j].start||rows[j].end<=rows[i].start);});
 test(`meetings:${group}:all-components`,()=>{for(const code of new Set(rows.map(m=>m.code)))assert.equal(rows.filter(m=>m.code===code).map(m=>m.type).sort().join(','),'Lab,Lecture,Tutorial');});
}
test('preferences:valid',()=>assert.equal(api.validatePreferences(base()),''));
test('preferences:days-off-cap',()=>assert.ok(api.validatePreferences({...base(),days:['Sunday','Monday','Thursday']})));
test('preferences:preferred-and-off',()=>assert.ok(api.validatePreferences({...base(),preferred:['Thursday']})));
test('preferences:preferred-and-avoided',()=>assert.ok(api.validatePreferences({...base(),preferred:['Monday'],avoided:['Monday']})));
test('preferences:long-note',()=>assert.ok(api.validatePreferences({...base(),notes:'x'.repeat(1001)})));
for(const priority of [0,-1,1.5,21,NaN])test('preferences:invalid-priority:'+priority,()=>assert.ok(api.validatePreferences({...base(),priorities:[priority]})));
for(const [start,end] of [['12:00','10:00'],['12:00','12:00'],['','12:00']])test(`preferences:invalid-time:${start}-${end}`,()=>assert.ok(api.validatePreferences({...base(),times:[{day:'Sunday',kind:'Prefer',start,end,priority:1}]})));
const range={day:'Sunday',kind:'Prefer',start:'08:30',end:'10:00',priority:1};
test('preferences:valid-range',()=>assert.equal(api.validatePreferences({...base(),times:[range]}),''));
test('preferences:duplicate-range',()=>assert.ok(api.validatePreferences({...base(),times:[range,range]})));
test('preferences:contradictory-range',()=>assert.ok(api.validatePreferences({...base(),times:[range,{...range,kind:'Avoid'}]})));
test('permissions:normal-only-swaps',()=>assert.equal(api.permissions['schedule-swap'].join(','),'normalStudent'));
test('permissions:records-exclude-admin-normal',()=>assert.equal(api.permissions.records.join(','),'advisingStudent,advisor,coordinator'));
test('permissions:calendar-students-only',()=>assert.equal(api.permissions['calendar-sync'].join(','),'normalStudent,advisingStudent'));
test('state:malformed-storage-safe',()=>{store.set('portal-student-life:round2:state:normalStudent','{bad');assert.equal(api.readPreview('normalStudent').status,'processed');});
test('scenario:reject-unknown-page',()=>assert.throws(()=>api.setScenario('not-owned','empty')));
test('scenario:reject-unknown-state',()=>assert.throws(()=>api.setScenario('my-schedule','invented')));
for(const size of [0,1,43,44,100])test('pdf:structural:'+size,()=>{
 const pdf=api.pdfBytes('Test (PDF)',Array.from({length:size},(_,i)=>`Line ${i}: standard characters`));
 assert.ok(pdf.startsWith('%PDF-1.4'));assert.ok(pdf.endsWith('%%EOF'));
 const at=Number(pdf.match(/startxref\n(\d+)/)[1]);assert.equal(pdf.slice(at,at+4),'xref');
 assert.equal(Number(pdf.match(/\/Count (\d+)/)[1]),Math.max(1,Math.ceil(size/43)));
 const rows=pdf.slice(at).split('\n');const count=Number(rows[1].split(' ')[1]);
 for(let id=1;id<count;id++){const offset=Number(rows[id+2].slice(0,10));assert.ok(pdf.slice(offset).startsWith(id+' 0 obj'));}
});
const report={scope:'Pure local preview logic; not backend acceptance',checks:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
console.log(JSON.stringify(report,null,2));process.exitCode=report.failed?1:0;
