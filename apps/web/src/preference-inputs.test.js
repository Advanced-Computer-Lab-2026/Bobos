import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDays,parseTimes} from './preference-inputs.js';
test('multiple weekday entries accept lowercase, spaces and a trailing separator',()=>{
 assert.deepEqual(parseDays('monday, WEDNESDAY, friday, '),[{day:'Monday',priority:1},{day:'Wednesday',priority:2},{day:'Friday',priority:3}]);
 assert.throws(()=>parseDays('monday, Monday'),/duplicate/);
 assert.throws(()=>parseDays('Funday'),/Unknown weekday/);
});
test('multiple time ranges retain priority and accept displayed dash variants',()=>{
 assert.deepEqual(parseTimes('09:00-12:00, 13:00–15:00, '),[{startMinute:540,endMinute:720,priority:1},{startMinute:780,endMinute:900,priority:2}]);
 assert.throws(()=>parseTimes('25:00-26:00'),/Invalid time/);
});
