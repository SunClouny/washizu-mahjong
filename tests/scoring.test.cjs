const test=require('node:test');const assert=require('node:assert/strict');const {calculate}=require('../src/scoring.cjs');
test('子の門前ツモの役と点数を計算',()=>{let r=calculate(['m1','m2','m3','p1','p2','p3','s1','s2','s3','z1','z1','z1','z2'],'z2',{seat:1});assert.equal(r.fu,40);assert.equal(r.han,6);assert.equal(r.points,12000);assert.deepEqual(r.payments,[-6000,12000,-3000,-3000]);assert.ok(r.yaku.some(y=>y.name==='三色同順'));});
test('完成していない手を和了としない',()=>{let r=calculate(['m1','m2','m3','p1','p2','p3','s1','s2','s3','z1','z1','z1','z2'],'z3');assert.equal(r,null);});
test('5枚目の牌や無効な入力を拒否',()=>{assert.throws(()=>calculate(['m1','m1','m1','m1','p1','p2','p3','s1','s2','s3','z1','z1','z1'],'m1'));assert.throws(()=>calculate([], 'm1'));});
