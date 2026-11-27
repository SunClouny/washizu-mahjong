'use strict';
const crypto = require('node:crypto');
const {makeWall, visibleHand} = require('./tiles.cjs');
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
const makeToken = () => crypto.randomBytes(32).toString('base64url');
function cleanName(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 16) throw new Error('名前は1〜16文字で入力してください');
  return name.trim();
}
function createRoom(name) {
  const token=makeToken();
  return { room:{version:1, phase:'lobby',players:[{name:cleanName(name),tokenHash:digest(token)}],hands:[],discards:[],wall:[],turn:null}, token };
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
  room.wall=wall; room.hands[0].push(room.wall.pop()); room.turn=0; room.phase='playing'; room.version++;
}
function discard(room, token, tileId) {
  const seat=seatFor(room,token);
  if(room.phase!=='playing'||room.turn!==seat) throw new Error('あなたの番ではありません');
  const index=room.hands[seat].findIndex(t=>t.id===tileId);
  if(index<0) throw new Error('手牌にない牌です');
  room.discards[seat].push(room.hands[seat].splice(index,1)[0]);
  if(room.wall.length<=14){room.phase='exhausted'; room.turn=null;}
  else {room.turn=(seat+1)%4;room.hands[room.turn].push(room.wall.pop());}
  room.version++;
}
function snapshot(room, token) {
  const seat=seatFor(room,token);
  return {version:room.version,phase:room.phase,players:room.players.map(p=>({name:p.name})),seat,turn:room.turn,wallRemaining:room.wall.length, hands:room.hands.map((hand,i)=>visibleHand(hand,i===seat)),discards:room.discards.map(p=>p.map(t=>({face:t.face,transparent:t.transparent})))};
}
module.exports={createRoom,join,start,discard,snapshot};
