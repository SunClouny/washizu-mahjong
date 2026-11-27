'use strict';
const crypto = require('node:crypto');
const {makeWall, visibleHand} = require('./tiles.cjs');
const {calculate,waits,callOptions,callDiscards,ownKanOptions} = require('./scoring.cjs');
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
const makeToken = () => crypto.randomBytes(32).toString('base64url');
function cleanName(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 16) throw new Error('名前は1〜16文字で入力してください');
  return name.trim();
}
function createRoom(name) {
  const token=makeToken();
  return { room:{version:1, phase:'lobby',players:[{name:cleanName(name),tokenHash:digest(token)}],hands:[],discards:[],wall:[],turn:null,scores:[25000,25000,25000,25000],result:null,riichi:[false,false,false,false],furiten:[false,false,false,false],riichiSticks:0,pending:null,dora:null,dealer:0,round:1,honba:0}, token };
}
function seatFor(room, token) {
  if (typeof token !== 'string' || !token) throw new Error('参加者を確認できません');
  const hash=digest(token), seat=room.players.findIndex(p=>p.tokenHash===hash);
  if(seat<0) throw new Error('参加者を確認できません');
  return seat;
}
function join(room,name) {
  if(room.phase!=='lobby') throw new Error('対局は始まっています');
  if(room.players.length>=4) throw new Error('部屋は満員です');
  const token=makeToken(); room.players.push({name:cleanName(name),tokenHash:digest(token)}); room.version++;
  return token;
}
function start(room, token, randomInt) {
  if(seatFor(room,token)!==0) throw new Error('開始できるのは部屋の作成者です');
  if(room.phase!=='lobby'||room.players.length!==4) throw new Error('4人そろうと開始できます');
  deal(room,randomInt);
}
function deal(room,randomInt){
  const wall=makeWall(randomInt); room.hands=Array.from({length:4},()=>[]); room.discards=Array.from({length:4},()=>[]);room.discardHistory=Array.from({length:4},()=>[]);
  for(let i=0;i<13;i++) for(let p=0;p<4;p++) room.hands[p].push(wall.pop());
  for(const hand of room.hands)hand.sort((a,b)=>a.face.localeCompare(b.face));
  room.deadWall=wall.splice(0,14);room.wall=wall;room.kanCount=0;room.kanOwners=[];room.abortAfterDiscard=false;room.doraIndicators=[room.deadWall[4].face];room.rinshan=false;room.uninterrupted=true;room.doubleRiichi=[false,false,false,false];room.ippatsu=[false,false,false,false];room.melds=Array.from({length:4},()=>[]);room.drawnIds=[null,null,null,null];room.afterCall=false;room.allowedDiscards=null;room.riichi=[false,false,false,false];room.furiten=[false,false,false,false];room.pending=null;room.result=null;room.dora=room.doraIndicators[0];const drawn=room.wall.pop();room.hands[room.dealer].push(drawn);room.drawnIds[room.dealer]=drawn.id; room.turn=room.dealer; room.phase='playing'; room.version++;
}
function cancelIppatsu(room){room.ippatsu=[false,false,false,false];room.uninterrupted=false;}
function uraFor(room,seat){return room.riichi[seat]?room.doraIndicators.map((_,i)=>room.deadWall[5+2*i].face):null;}
function replacementDraw(room,seat){
  if(room.kanCount>=4||room.wall.length===0)throw new Error('これ以上カンできません');
  const tile=room.deadWall[room.kanCount];room.kanCount++;room.kanOwners.push(seat);room.abortAfterDiscard=room.kanCount===4&&new Set(room.kanOwners).size>1;room.doraIndicators.push(room.deadWall[4+2*room.kanCount].face);
  room.wall.pop();room.hands[seat].push(tile);room.drawnIds[seat]=tile.id;room.rinshan=true;room.turn=seat;room.afterCall=false;room.allowedDiscards=null;room.phase='playing';
}
function drawnLast(room,seat){const hand=room.hands[seat],id=room.drawnIds[seat],drawn=hand.find(t=>t.id===id);return drawn?[...hand.filter(t=>t.id!==id),drawn]:hand.slice();}
function reorder(room,token,ids){
 const seat=seatFor(room,token),hand=room.hands[seat];
 if(!['playing','response'].includes(room.phase)||!Array.isArray(ids)||ids.length!==hand.length||new Set(ids).size!==ids.length)throw new Error('並べ替えできません');
 const byId=new Map(hand.map(t=>[t.id,t]));if(ids.some(id=>!byId.has(id)))throw new Error('手牌が変わりました。もう一度操作してください');
 room.hands[seat]=ids.map(id=>byId.get(id));room.version++;
}
function seatWind(room,seat){return (seat-room.dealer+4)%4;}
function applyPayment(room,payments){room.scores=room.scores.map((score,i)=>score+payments[seatWind(room,i)]);}
function abortRound(room,reason){room.result={method:'abort',reason};room.phase='exhausted';room.turn=null;}
function canNineTerminals(room,seat){return room.phase==='playing'&&room.turn===seat&&!room.afterCall&&room.uninterrupted&&room.discardHistory[seat].length===0&&new Set(room.hands[seat].map(t=>t.face).filter(p=>p[0]==='z'||p[1]==='1'||p[1]==='9')).size>=9;}
function nineTerminals(room,token){const seat=seatFor(room,token);if(!canNineTerminals(room,seat))throw new Error('九種九牌を宣言できません');abortRound(room,'九種九牌');room.version++;}
function discard(room, token, tileId, declareRiichi=false) {
  const seat=seatFor(room,token);
  if(room.phase!=='playing'||room.turn!==seat) throw new Error('あなたの番ではありません');
  const index=room.hands[seat].findIndex(t=>t.id===tileId);
  if(index<0) throw new Error('手牌にない牌です');
  if(room.allowedDiscards&&!room.allowedDiscards.includes(room.hands[seat][index].face))throw new Error('その牌は鳴いた直後に捨てられません');
  if(room.riichi[seat]&&tileId!==room.drawnIds[seat]) throw new Error('リーチ後はツモ牌を捨ててください');
  const wasRiichi=room.riichi[seat];
  if(declareRiichi){
    if(room.riichi[seat]||room.melds[seat].some(m=>/[+\-=]/.test(m.pattern))||room.scores[seat]<1000||room.wall.length<4) throw new Error('リーチできません');
    const remaining=room.hands[seat].filter((_,i)=>i!==index).map(t=>t.face);
    if(!waits(remaining,room.melds[seat].map(m=>m.pattern)).length) throw new Error('テンパイしていないためリーチできません');
    room.doubleRiichi[seat]=room.uninterrupted&&room.discards[seat].length===0;room.riichi[seat]=true;room.ippatsu[seat]=true;room.scores[seat]-=1000;room.riichiSticks++;
  }
  if(wasRiichi)room.ippatsu[seat]=false;
  const tile=room.hands[seat].splice(index,1)[0];room.drawnIds[seat]=null;room.discards[seat].push(tile);room.discardHistory[seat].push(tile.face);room.afterCall=false;room.allowedDiscards=null;room.rinshan=false;
  room.pending={discarder:seat,tile,answers:{},riichiDeclaration:declareRiichi};room.phase='response';
  room.version++;
}
function ronResult(room,seat) {
  const p=room.pending;if(!p||seat===p.discarder||room.furiten[seat])return null;
  const faces=room.hands[seat].map(t=>t.face),melds=room.melds[seat].map(m=>m.pattern),waiting=waits(faces,melds);
  if(!waiting.includes(p.tile.face)||room.discardHistory[seat].some(face=>waiting.includes(face)))return null;
  const direction={1:'+',2:'=',3:'-'}[(p.discarder-seat+4)%4];
  return calculate(faces,p.tile.face,{seat:seatWind(room,seat),method:'ron',direction,riichi:room.riichi[seat],doubleRiichi:room.doubleRiichi[seat],ippatsu:room.ippatsu[seat],doraIndicators:room.doraIndicators,uraIndicators:uraFor(room,seat),riichiSticks:room.riichiSticks,honba:room.honba,melds,chankan:p.kind==='added-kan',lastTile:p.kind!=='added-kan'&&room.wall.length===0?2:0});
}
function optionsFor(room,seat){
  const p=room.pending;if(!p||room.abortAfterDiscard||p.kind==='added-kan'||seat===p.discarder||room.riichi[seat])return {chi:[],pon:[],kan:[]};
  const direction={1:'+',2:'=',3:'-'}[(p.discarder-seat+4)%4];
  const options=callOptions(room.hands[seat].map(t=>t.face),room.melds[seat].map(m=>m.pattern),p.tile.face,direction,room.wall.length);if(room.kanCount>=4)options.kan=[];return options;
}
function respond(room,token,choice,pattern,tileIds) {
  const seat=seatFor(room,token),p=room.pending;
  if(room.phase!=='response'||!p||seat===p.discarder||p.answers[seat]) throw new Error('応答できません');
  if(!['pass','ron','chi','pon','kan'].includes(choice))throw new Error('応答が不正です');
  const result=ronResult(room,seat);
  if(choice==='ron'&&!result)throw new Error('ロンできません');
  if(['chi','pon','kan'].includes(choice)){
    if(!optionsFor(room,seat)[choice].includes(pattern))throw new Error('その牌では鳴けません');
    const requiredCount=choice==='kan'?3:2;
    if(!Array.isArray(tileIds)||tileIds.length!==requiredCount||new Set(tileIds).size!==requiredCount)throw new Error('使う手牌の枚数が違います');
    const tiles=tileIds.map(id=>room.hands[seat].find(t=>t.id===id));
    const required=(pattern.slice(1).match(/\d(?![+\-=])/g)||[]).map(n=>pattern[0]+n).sort();
    if(tiles.some(t=>!t)||tiles.map(t=>t.face).sort().join()!==required.join())throw new Error('選択した手牌が合いません');
    p.answers[seat]={choice,pattern,tileIds};
  } else p.answers[seat]={choice};
  if(choice!=='ron'&&result) room.furiten[seat]=true;
  if(Object.keys(p.answers).length===3){
    const winners=Object.keys(p.answers).map(Number).filter(i=>p.answers[i].choice==='ron').sort((a,b)=>(a-p.discarder+4)%4-(b-p.discarder+4)%4);
    if(winners.length){
      if(p.riichiDeclaration){room.riichi[p.discarder]=false;room.doubleRiichi[p.discarder]=false;room.ippatsu[p.discarder]=false;room.scores[p.discarder]+=1000;room.riichiSticks--;}
      const winner=winners[0],r=ronResult(room,winner);if(p.kind==='added-kan')room.hands[p.discarder]=room.hands[p.discarder].filter(t=>t.id!==p.tile.id);applyPayment(room,r.payments);room.result={winner,method:'ron',discarder:p.discarder,uraIndicators:uraFor(room,winner),...r};room.riichiSticks=0;room.phase='won';room.turn=null;
    }
    else if(p.kind==='added-kan'){
      const player=p.discarder,m=room.melds[player].find(m=>m.pattern===p.pattern.slice(0,5));
      room.hands[player]=room.hands[player].filter(t=>t.id!==p.tile.id);m.pattern=p.pattern;m.tiles.push({face:p.tile.face,transparent:p.tile.transparent});replacementDraw(room,player);
    }
    else if(room.abortAfterDiscard){abortRound(room,'四槓散了');}
    else if(room.riichi.every(Boolean)){abortRound(room,'四家立直');}
    else if(Object.values(p.answers).some(a=>['chi','pon','kan'].includes(a.choice))){
      const callers=Object.keys(p.answers).map(Number).filter(i=>['chi','pon','kan'].includes(p.answers[i].choice)).sort((a,b)=>((p.answers[b].choice!=='chi')-(p.answers[a].choice!=='chi'))||((a-p.discarder+4)%4-(b-p.discarder+4)%4));
      const caller=callers[0],answer=p.answers[caller],used=answer.tileIds.map(id=>room.hands[caller].find(t=>t.id===id));
      cancelIppatsu(room);
      room.hands[caller]=room.hands[caller].filter(t=>!answer.tileIds.includes(t.id));room.discards[p.discarder].pop();
      room.melds[caller].push({pattern:answer.pattern,tiles:[...used,p.tile].map(t=>({face:t.face,transparent:t.transparent}))});
      if(answer.choice==='kan')replacementDraw(room,caller);
      else {room.turn=caller;room.afterCall=true;room.allowedDiscards=callDiscards(room.hands[caller].map(t=>t.face),room.melds[caller].map(m=>m.pattern),answer.pattern);room.phase='playing';}
    }
    else if(room.uninterrupted&&room.discardHistory.every(h=>h.length===1)&&room.discardHistory.every(h=>h[0]===room.discardHistory[0][0])&&/^z[1-4]$/.test(room.discardHistory[0][0])){abortRound(room,'四風連打');}
    else if(room.wall.length===0){
      const tenpai=room.hands.map((h,i)=>waits(h.map(t=>t.face),room.melds[i].map(m=>m.pattern)).length>0),n=tenpai.filter(Boolean).length;
      if(n>0&&n<4)room.scores=room.scores.map((s,i)=>s+(tenpai[i]?3000/n:-3000/(4-n)));
      room.result={method:'draw',tenpai};room.phase='exhausted';room.turn=null;
    }
    else {room.turn=(p.discarder+1)%4;const drawn=room.wall.pop();room.hands[room.turn].push(drawn);room.drawnIds[room.turn]=drawn.id;room.afterCall=false;if(!room.riichi[room.turn])room.furiten[room.turn]=false;room.phase='playing';}
    room.pending=null;
  }
  room.version++;
}
function tsumo(room, token) {
  const seat=seatFor(room,token);
  if(room.phase!=='playing'||room.turn!==seat) throw new Error('あなたのツモ番ではありません');
  const hand=drawnLast(room,seat);
  if(room.afterCall||hand.length!==14-3*room.melds[seat].length) throw new Error('和了できる手牌ではありません');
  const heavenly=room.uninterrupted&&!room.rinshan&&room.discardHistory[seat].length===0?(seat===room.dealer?1:2):0;
  const result=calculate(hand.slice(0,-1).map(t=>t.face),hand[hand.length-1].face,{seat:seatWind(room,seat),riichi:room.riichi[seat],doubleRiichi:room.doubleRiichi[seat],ippatsu:room.ippatsu[seat],heavenly,doraIndicators:room.doraIndicators,uraIndicators:uraFor(room,seat),riichiSticks:room.riichiSticks,honba:room.honba,melds:room.melds[seat].map(m=>m.pattern),rinshan:room.rinshan,lastTile:!room.rinshan&&room.wall.length===0?1:0});
  if(!result) throw new Error('和了できる役がありません');
  applyPayment(room,result.payments);
  room.result={winner:seat,method:'tsumo',uraIndicators:uraFor(room,seat),...result};room.riichiSticks=0;room.phase='won';room.turn=null;room.version++;
}
function closedKan(room,token,pattern,tileIds){
 const seat=seatFor(room,token);
 if(room.phase!=='playing'||room.turn!==seat||room.afterCall)throw new Error('暗カンできません');
 const options=ownKanOptions(drawnLast(room,seat).map(t=>t.face),room.melds[seat].map(m=>m.pattern),room.riichi[seat],room.wall.length,room.kanCount).filter(m=>/^[mpsz]\d{4}$/.test(m));
 if(!options.includes(pattern)||!Array.isArray(tileIds)||tileIds.length!==4||new Set(tileIds).size!==4)throw new Error('暗カンできません');
 const used=tileIds.map(id=>room.hands[seat].find(t=>t.id===id));
 if(used.some(t=>!t||t.face!==pattern.slice(0,2)))throw new Error('選択した牌が合いません');
 room.hands[seat]=room.hands[seat].filter(t=>!tileIds.includes(t.id));room.melds[seat].push({pattern,closed:true,tiles:used.map(t=>({face:t.face,transparent:t.transparent}))});cancelIppatsu(room);replacementDraw(room,seat);room.version++;
}
function addedKan(room,token,pattern,tileId){
 const seat=seatFor(room,token);
 if(room.phase!=='playing'||room.turn!==seat||room.afterCall)throw new Error('加カンできません');
 const options=ownKanOptions(drawnLast(room,seat).map(t=>t.face),room.melds[seat].map(m=>m.pattern),room.riichi[seat],room.wall.length,room.kanCount);
 const tile=room.hands[seat].find(t=>t.id===tileId);
 if(!options.includes(pattern)||!/[+\-=]\d$/.test(pattern)||!tile||tile.face!==pattern[0]+pattern.slice(-1))throw new Error('加カンできません');
 cancelIppatsu(room);room.pending={kind:'added-kan',discarder:seat,tile,pattern,answers:{}};room.phase='response';room.version++;
}
function nextRound(room,token,randomInt){
  if(seatFor(room,token)!==0)throw new Error('進行できるのは部屋の作成者です');
  if(!['won','exhausted'].includes(room.phase))throw new Error('まだ局は終了していません');
  const repeat=room.phase==='won'?room.result.winner===room.dealer:room.result.method==='abort'||room.result.tenpai[room.dealer];
  if(repeat)room.honba++;
  else {room.dealer=(room.dealer+1)%4;room.round++;room.honba=room.phase==='exhausted'?room.honba+1:0;}
  if(room.round>4||room.scores.some(s=>s<0)){
    const order=room.scores.map((score,seat)=>({score,seat})).sort((a,b)=>b.score-a.score||a.seat-b.seat);
    if(room.riichiSticks){room.scores[order[0].seat]+=room.riichiSticks*1000;room.riichiSticks=0;}
    room.phase='finished';room.turn=null;room.version++;return;
  }
  deal(room,randomInt);
}
function snapshot(room, token) {
  const seat=seatFor(room,token);
  const ownKans=room.phase==='playing'&&room.turn===seat&&!room.afterCall?ownKanOptions(drawnLast(room,seat).map(t=>t.face),room.melds[seat].map(m=>m.pattern),room.riichi[seat],room.wall.length,room.kanCount):[];
  const rankings=room.phase==='finished'?room.scores.map((score,seat)=>({score,seat})).sort((a,b)=>b.score-a.score||a.seat-b.seat):null;
  return {version:room.version,phase:room.phase,players:room.players.map(p=>({name:p.name})),seat,turn:room.turn,wallRemaining:room.wall.length,scores:room.scores,rankings,result:room.result,round:room.round,dealer:room.dealer,honba:room.honba,riichi:room.riichi,riichiSticks:room.riichiSticks,dora:room.dora,doraIndicators:room.doraIndicators,canNineTerminals:room.phase==='playing'&&canNineTerminals(room,seat),closedKans:ownKans.filter(m=>/^[mpsz]\d{4}$/.test(m)),addedKans:ownKans.filter(m=>/[+\-=]\d$/.test(m)),melds:room.melds,pending:room.pending?{kind:room.pending.kind||'discard',discarder:room.pending.discarder,tile:room.pending.tile.face,answered:!!room.pending.answers[seat],canRon:!!ronResult(room,seat),calls:optionsFor(room,seat)}:null, hands:room.hands.map((hand,i)=>visibleHand(hand,i===seat)),discards:room.discards.map(p=>p.map(t=>({face:t.face,transparent:t.transparent})))};
}
module.exports={createRoom,join,start,discard,reorder,respond,tsumo,closedKan,addedKan,nineTerminals,nextRound,snapshot};
