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
