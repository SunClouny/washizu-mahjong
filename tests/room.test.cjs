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
  const {room,token}=roomApi.createRoom('親'); const b=roomApi.join(room,'南'); const c=roomApi.join(room,'西');const d=roomApi.join(room,'北'); roomApi.start(room,token);
  const id=room.hands[0][0].id; assert.throws(()=>roomApi.discard(room,b,id)); assert.throws(()=>roomApi.discard(room,token,'bad-id'));
  roomApi.discard(room,token,id); assert.equal(room.phase,'response');assert.equal(room.hands[0].length,13);assert.equal(room.discards[0].length,1);
  for(const t of [b,c,d]) roomApi.respond(room,t,'pass');assert.equal(room.turn,1);assert.equal(room.hands[1].length,14);
});
test('ツモ時に役と点数を確定し、他人による申告を拒否',()=>{
  const {room,token}=roomApi.createRoom('親');const b=roomApi.join(room,'南');roomApi.join(room,'西');roomApi.join(room,'北');roomApi.start(room,token);
  const faces=['m1','m2','m3','p1','p2','p3','s1','s2','s3','z1','z1','z1','z2','z2'];room.hands[0]=faces.map((face,i)=>({id:'test'+i,face,transparent:i%4!==0}));
  assert.throws(()=>roomApi.tsumo(room,b));roomApi.tsumo(room,token);
  assert.equal(room.phase,'won');assert.equal(room.result.winner,0);assert.equal(room.scores.reduce((a,b)=>a+b,0),100000);assert.ok(room.scores[0]>25000);
  assert.throws(()=>roomApi.tsumo(room,token));
});
test('ロン判定と打牌後の応答、頭ハネ精算',()=>{
 const {room,token}=roomApi.createRoom('親');const b=roomApi.join(room,'南'),c=roomApi.join(room,'西'),d=roomApi.join(room,'北');roomApi.start(room,token);
 let faces=['m1','m2','m3','p1','p2','p3','s1','s2','s3','z1','z1','z1','z2'];room.hands[1]=faces.map((face,i)=>({id:'b'+i,face,transparent:true}));
 room.hands[0][0]={id:'throw',face:'z2',transparent:true};roomApi.discard(room,token,'throw');assert.equal(roomApi.snapshot(room,b).pending.canRon,true);
 assert.throws(()=>roomApi.respond(room,token,'pass'));roomApi.respond(room,b,'ron');assert.throws(()=>roomApi.respond(room,b,'pass'));roomApi.respond(room,c,'pass');roomApi.respond(room,d,'pass');
 assert.equal(room.phase,'won');assert.equal(room.result.method,'ron');assert.equal(room.result.winner,1);assert.equal(room.result.discarder,0);assert.equal(room.scores.reduce((a,b)=>a+b),100000);
});
test('リーチには門前テンパイを要し、1000点を供託',()=>{
 const {room,token}=roomApi.createRoom('親');roomApi.join(room,'南');roomApi.join(room,'西');roomApi.join(room,'北');roomApi.start(room,token);
 let faces=['m1','m2','m3','p1','p2','p3','s1','s2','s3','z1','z1','z1','z2','z3'];room.hands[0]=faces.map((face,i)=>({id:'a'+i,face,transparent:true}));
 roomApi.discard(room,token,'a13',true);assert.equal(room.riichi[0],true);assert.equal(room.scores[0],24000);assert.equal(room.riichiSticks,1);
});
test('親の和了は連荘し、子の和了は親が移動して東風戦を終了',()=>{
 const {room,token}=roomApi.createRoom('親');roomApi.join(room,'南');roomApi.join(room,'西');roomApi.join(room,'北');roomApi.start(room,token);
 room.phase='won';room.result={method:'tsumo',winner:0};roomApi.nextRound(room,token);assert.equal(room.round,1);assert.equal(room.honba,1);assert.equal(room.turn,0);
 room.phase='won';room.result={method:'tsumo',winner:1};roomApi.nextRound(room,token);assert.equal(room.round,2);assert.equal(room.dealer,1);assert.equal(room.honba,0);assert.equal(room.turn,1);
 room.round=4;room.dealer=3;room.phase='won';room.result={method:'ron',winner:0};roomApi.nextRound(room,token);assert.equal(room.phase,'finished');
});
