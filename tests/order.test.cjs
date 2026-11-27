const test=require('node:test');
const assert=require('node:assert/strict');
const {moveTile,reconcileOrder}=require('../src/order.cjs');
test('並べ替えは元の配列を変えない',()=>{const ids=['a','b','c'];assert.deepEqual(moveTile(ids,0,2),['b','c','a']);assert.deepEqual(ids,['a','b','c']);assert.throws(()=>moveTile(ids,3,0));});
test('打牌後も順序を保ち新たな牌を末尾に追加',()=>{assert.deepEqual(reconcileOrder(['c','a','b'],[{id:'a'},{id:'c'},{id:'d'}]).map(t=>t.id),['c','a','d']);});
