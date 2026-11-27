const test=require('node:test');
const assert=require('node:assert/strict');
const roomApi=require('../src/room.cjs');
test('4人だけが参加し本人の手牌以外は不透明牌を隠す',()=>{
  const {room,token}=roomApi.createRoom('親'); const tokens=[token,roomApi.join(room,'南'),roomApi.join(room,'西'),roomApi.join(room,'北')];
  assert.throws(()=>roomApi.join(room,'5人目')); assert.throws(()=>roomApi.start(room,tokens[1]));
  roomApi.start(room,token); const s=roomApi.snapshot(room,tokens[1]);
  assert.equal(s.hands[0].length,14);assert.equal(s.hands[1].length,13);
  assert.ok(s.hands[1].every(t=>t.id && t.face));
  assert.ok(s.hands[0].filter(t=>!t.transparent).every(t=>!('face' in t)&&!('id' in t)));
  assert.ok(!JSON.stringify(s).includes('tokenHash'));
  assert.throws(()=>roomApi.snapshot(room,'invalid'));
});
test('手番と所持牌を検証し次の人にツモを渡す',()=>{
  const {room,token}=roomApi.createRoom('親'); const b=roomApi.join(room,'南'); roomApi.join(room,'西');roomApi.join(room,'北'); roomApi.start(room,token);
  const id=room.hands[0][0].id; assert.throws(()=>roomApi.discard(room,b,id)); assert.throws(()=>roomApi.discard(room,token,'bad-id'));
  roomApi.discard(room,token,id); assert.equal(room.turn,1); assert.equal(room.hands[0].length,13);assert.equal(room.hands[1].length,14);assert.equal(room.discards[0].length,1);
});
