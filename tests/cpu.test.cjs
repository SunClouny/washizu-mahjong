'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../src/room.cjs');
test('CPU 3人を追加し、人間の操作とともに局を進める',()=>{
 const {room,token}=R.createRoom('人間');
 for(let i=0;i<3;i++)R.addCpu(room,token);
 assert.deepEqual(room.players.map(p=>p.name),['人間','CPU 1','CPU 2','CPU 3']);
 R.start(room,token);
 let moves=0;
 while(['playing','response'].includes(room.phase)&&moves++<150){
  R.advanceCpu(room);
  if(room.phase==='playing'&&room.turn===0) R.discard(room,token,room.hands[0][0].id);
  else if(room.phase==='response'&&room.pending.discarder!==0&&!room.pending.answers[0]) R.respond(room,token,'pass');
 }
 R.advanceCpu(room);
 assert.ok(['won','exhausted'].includes(room.phase));
 assert.ok(moves<150);
});

test('最後の人間が待機室を退出するとCPUだけが残らない',()=>{const {room,token}=R.createRoom('人間');R.addCpu(room,token);R.addCpu(room,token);R.leave(room,token);assert.equal(room.players.length,0)});
test('作成者が退出しても残った人間が部屋を管理できる',()=>{const {room,token}=R.createRoom('親');R.addCpu(room,token);const guest=R.join(room,'子');R.leave(room,token);assert.equal(R.snapshot(room,guest).seat,0);R.addCpu(room,guest);assert.equal(room.players.length,3)});
