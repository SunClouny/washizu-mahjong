const test=require('node:test');const assert=require('node:assert/strict');const game=require('../src/room.cjs');
test('4人が各打牌に応答し東風戦を終了まで進められる',()=>{
 const {room,token}=game.createRoom('A');const tokens=[token,game.join(room,'B'),game.join(room,'C'),game.join(room,'D')];game.start(room,token);let steps=0,rounds=0;
 while(room.phase!=='finished'&&steps++<2000){
  for(let i=0;i<4;i++){const v=game.snapshot(room,tokens[i]);assert.equal(v.seat,i);for(let j=0;j<4;j++)if(i!==j)assert.ok(v.hands[j].filter(t=>!t.transparent).every(t=>!('face' in t)&&!('id' in t)));}
  if(room.phase==='playing'){const s=room.turn;const h=room.hands[s];const allowed=room.allowedDiscards;const tile=h.find(t=>!allowed||allowed.includes(t.face));assert.ok(tile);game.discard(room,tokens[s],tile.id);}
  else if(room.phase==='response'){const pending=room.pending;for(let i=0;i<4&&room.phase==='response';i++)if(i!==pending.discarder&&!pending.answers[i])game.respond(room,tokens[i],'pass');}
  else if(room.phase==='won'||room.phase==='exhausted'){rounds++;game.nextRound(room,token);}
  else assert.fail('予期しない状態 '+room.phase);
  assert.equal(room.scores.reduce((a,b)=>a+b,0)+1000*room.riichiSticks,100000);
 }
 assert.equal(room.phase,'finished');assert.ok(rounds>=4);assert.ok(steps<2000);
});
test('鳴き・和了を含むランダム対局で進行と点数を保つ',()=>{
 for(let trial=0;trial<8;trial++){
  let seed=trial+1;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};const randInt=n=>Math.floor(random()*n);
  const {room,token}=game.createRoom('A');const tokens=[token,game.join(room,'B'),game.join(room,'C'),game.join(room,'D')];game.start(room,token,randInt);let steps=0;
  while(room.phase!=='finished'&&steps++<2500){
   if(room.phase==='playing'){
    const s=room.turn,v=game.snapshot(room,tokens[s]);let won=false;
    if(!room.afterCall){try{game.tsumo(room,tokens[s]);won=true;}catch{}}
    if(!won&&v.closedKans.length&&random()<.35){const pat=v.closedKans[0];const ids=room.hands[s].filter(t=>t.face===pat.slice(0,2)).map(t=>t.id);game.closedKan(room,tokens[s],pat,ids);}
    else if(!won){const hand=room.hands[s],allowed=room.allowedDiscards;const possible=hand.filter(t=>!allowed||allowed.includes(t.face));const tile=room.riichi[s]?hand.find(t=>t.id===room.drawnIds[s]):possible[Math.floor(random()*possible.length)];assert.ok(tile);game.discard(room,tokens[s],tile.id);}
   } else if(room.phase==='response'){
    const pending=room.pending;for(let i=0;i<4&&room.phase==='response';i++)if(i!==pending.discarder&&!pending.answers[i]){
     const v=game.snapshot(room,tokens[i]);if(v.pending.canRon){game.respond(room,tokens[i],'ron');continue;}
     let chosen=false;for(const kind of ['kan','pon','chi']){if(random()>.25)continue;const pattern=v.pending.calls[kind][0];if(!pattern)continue;const needed=(pattern.slice(1).match(/\d(?![+\-=])/g)||[]).map(n=>pattern[0]+n);let available=room.hands[i].slice(),ids=[];for(const face of needed){const idx=available.findIndex(t=>t.face===face);if(idx<0)break;ids.push(available.splice(idx,1)[0].id)}if(ids.length===needed.length){game.respond(room,tokens[i],kind,pattern,ids);chosen=true;break;}}
     if(!chosen)game.respond(room,tokens[i],'pass');
    }
   }else if(['won','exhausted'].includes(room.phase))game.nextRound(room,token,randInt);else assert.fail(room.phase);
   assert.equal(room.scores.reduce((a,b)=>a+b,0)+1000*room.riichiSticks,100000);
  }
  assert.equal(room.phase,'finished',`trial ${trial} at ${steps}`);
 }
});
