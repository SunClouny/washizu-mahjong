'use strict';
const crypto = require('node:crypto');
const {makeWall, visibleHand} = require('./tiles.cjs');
const {calculate,waits} = require('./scoring.cjs');
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
const makeToken = () => crypto.randomBytes(32).toString('base64url');
function cleanName(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 16) throw new Error('名前は1〜16文字で入力してください');
  return name.trim();
}
function createRoom(name) {
  const token=makeToken();
  return { room:{version:1, phase:'lobby',players:[{name:cleanName(name),tokenHash:digest(token)}],hands:[],discards:[],wall:[],turn:null,scores:[25000,25000,25000,25000],result:null,riichi:[false,false,false,false],furiten:[false,false,false,false],riichiSticks:0,pending:null,dora:null}, token };
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
  const wall=makeWall(randomInt); room.hands=Array.from({length:4},()=>[]); room.discards=Array.from({length:4},()=>[]);
  for(let i=0;i<13;i++) for(let p=0;p<4;p++) room.hands[p].push(wall.pop());
  room.wall=wall; room.dora=wall[4].face; room.hands[0].push(room.wall.pop()); room.turn=0; room.phase='playing'; room.version++;
}
function discard(room, token, tileId, declareRiichi=false) {
  const seat=seatFor(room,token);
  if(room.phase!=='playing'||room.turn!==seat) throw new Error('あなたの番ではありません');
  const index=room.hands[seat].findIndex(t=>t.id===tileId);
  if(index<0) throw new Error('手牌にない牌です');
  if(room.riichi[seat]&&index!==room.hands[seat].length-1) throw new Error('リーチ後はツモ牌を捨ててください');
  if(declareRiichi){
    if(room.riichi[seat]||room.scores[seat]<1000||room.wall.length<18) throw new Error('リーチできません');
    const remaining=room.hands[seat].filter((_,i)=>i!==index).map(t=>t.face);
    if(!waits(remaining).length) throw new Error('テンパイしていないためリーチできません');
    room.riichi[seat]=true;room.scores[seat]-=1000;room.riichiSticks++;
  }
  const tile=room.hands[seat].splice(index,1)[0];room.discards[seat].push(tile);
  room.pending={discarder:seat,tile,answers:{}};room.phase='response';
  room.version++;
}
function ronResult(room,seat) {
  const p=room.pending;if(!p||seat===p.discarder||room.furiten[seat])return null;
  const faces=room.hands[seat].map(t=>t.face),waiting=waits(faces);
  if(!waiting.includes(p.tile.face)||room.discards[seat].some(t=>waiting.includes(t.face)))return null;
  const direction={1:'+',2:'=',3:'-'}[(p.discarder-seat+4)%4];
  return calculate(faces,p.tile.face,{seat,method:'ron',direction,riichi:room.riichi[seat],doraIndicators:[room.dora],riichiSticks:room.riichiSticks});
}
function respond(room,token,choice) {
  const seat=seatFor(room,token),p=room.pending;
  if(room.phase!=='response'||!p||seat===p.discarder||p.answers[seat]) throw new Error('応答できません');
  if(!['pass','ron'].includes(choice))throw new Error('応答が不正です');
  const result=ronResult(room,seat);
  if(choice==='ron'&&!result)throw new Error('ロンできません');
  if(choice==='pass'&&result) room.furiten[seat]=true;
  p.answers[seat]=choice;
  if(Object.keys(p.answers).length===3){
    const winners=Object.keys(p.answers).map(Number).filter(i=>p.answers[i]==='ron').sort((a,b)=>(a-p.discarder+4)%4-(b-p.discarder+4)%4);
    if(winners.length){const winner=winners[0],r=ronResult(room,winner);room.scores=room.scores.map((s,i)=>s+r.payments[i]);room.result={winner,method:'ron',discarder:p.discarder,...r};room.riichiSticks=0;room.phase='won';room.turn=null;}
    else if(room.wall.length<=14){room.phase='exhausted';room.turn=null;}
    else {room.turn=(p.discarder+1)%4;room.hands[room.turn].push(room.wall.pop());if(!room.riichi[room.turn])room.furiten[room.turn]=false;room.phase='playing';}
    room.pending=null;
  }
  room.version++;
}
function tsumo(room, token) {
  const seat=seatFor(room,token);
  if(room.phase!=='playing'||room.turn!==seat) throw new Error('あなたのツモ番ではありません');
  const hand=room.hands[seat];
  if(hand.length!==14) throw new Error('和了できる手牌ではありません');
  const result=calculate(hand.slice(0,13).map(t=>t.face),hand[13].face,{seat,riichi:room.riichi[seat],doraIndicators:[room.dora],riichiSticks:room.riichiSticks});
  if(!result) throw new Error('和了できる役がありません');
  room.scores=room.scores.map((score,i)=>score+result.payments[i]);
  room.result={winner:seat,method:'tsumo',...result};room.riichiSticks=0;room.phase='won';room.turn=null;room.version++;
}
function snapshot(room, token) {
  const seat=seatFor(room,token);
  return {version:room.version,phase:room.phase,players:room.players.map(p=>({name:p.name})),seat,turn:room.turn,wallRemaining:Math.max(0,room.wall.length-14),scores:room.scores,result:room.result,riichi:room.riichi,riichiSticks:room.riichiSticks,dora:room.dora,pending:room.pending?{discarder:room.pending.discarder,tile:room.pending.tile.face,answered:!!room.pending.answers[seat],canRon:!!ronResult(room,seat)}:null, hands:room.hands.map((hand,i)=>visibleHand(hand,i===seat)),discards:room.discards.map(p=>p.map(t=>({face:t.face,transparent:t.transparent})))};
}
module.exports={createRoom,join,start,discard,respond,tsumo,snapshot};
