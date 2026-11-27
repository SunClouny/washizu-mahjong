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
test('チーに使う透明牌を選択でき、鳴いた直後の食い替えは禁止',()=>{
 const {room,token}=roomApi.createRoom('親');const b=roomApi.join(room,'南'),c=roomApi.join(room,'西'),d=roomApi.join(room,'北');roomApi.start(room,token);
 let faces=['m1','m3','m2','m8','m9','p1','p2','p3','s1','s2','s3','z2','z2'];room.hands[1]=faces.map((face,i)=>({id:'b'+i,face,transparent:i!==0}));
 room.hands[0][0]={id:'throw',face:'m2',transparent:true};roomApi.discard(room,token,'throw');let s=roomApi.snapshot(room,b);assert.ok(s.pending.calls.chi.includes('m12-3'));
 assert.throws(()=>roomApi.respond(room,b,'chi','m12-3',['b0','b2']));roomApi.respond(room,b,'chi','m12-3',['b0','b1']);roomApi.respond(room,c,'pass');roomApi.respond(room,d,'pass');
 assert.equal(room.turn,1);assert.equal(room.hands[1].length,11);assert.equal(room.melds[1][0].pattern,'m12-3');assert.equal(room.melds[1][0].tiles[0].transparent,false);assert.equal(room.discards[0].length,0);
 assert.throws(()=>roomApi.tsumo(room,b));assert.throws(()=>roomApi.discard(room,b,'b2'));roomApi.discard(room,b,'b3');assert.equal(room.phase,'response');
});
test('ポンはチーより優先し、合法な2枚以外を拒否',()=>{
 const {room,token}=roomApi.createRoom('親');const b=roomApi.join(room,'南'),c=roomApi.join(room,'西'),d=roomApi.join(room,'北');roomApi.start(room,token);
 const mk=(faces,prefix)=>faces.map((face,i)=>({id:prefix+i,face,transparent:true}));room.hands[1]=mk(['m1','m3','m7','m8','m9','p1','p2','p3','s1','s2','s3','z2','z2'],'b');room.hands[2]=mk(['m2','m2','m7','m8','m9','p1','p2','p3','s1','s2','s3','z3','z3'],'c');
 room.hands[0][0]={id:'throw',face:'m2',transparent:true};roomApi.discard(room,token,'throw');roomApi.respond(room,b,'chi','m12-3',['b0','b1']);let pattern=roomApi.snapshot(room,c).pending.calls.pon[0];assert.ok(pattern);roomApi.respond(room,c,'pon',pattern,['c0','c1']);roomApi.respond(room,d,'pass');assert.equal(room.turn,2);assert.equal(room.melds[2][0].pattern,pattern);assert.equal(room.melds[1].length,0);
});
test('暗カンで嶺上牌を引き、カンドラを表示する',()=>{
 const {room,token}=roomApi.createRoom('親');roomApi.join(room,'南');roomApi.join(room,'西');roomApi.join(room,'北');roomApi.start(room,token);
 const faces=['m1','m1','m1','m1','p1','p2','p3','s1','s2','s3','z1','z1','z2','z2'];room.hands[0]=faces.map((face,i)=>({id:'a'+i,face,transparent:i!==0}));const before=room.wall.length;
 assert.ok(roomApi.snapshot(room,token).closedKans.includes('m1111'));roomApi.closedKan(room,token,'m1111',['a0','a1','a2','a3']);
 assert.equal(room.hands[0].length,11);assert.equal(room.melds[0][0].closed,true);assert.equal(room.wall.length,before-1);assert.equal(room.doraIndicators.length,2);assert.equal(room.rinshan,true);
});
test('大明カンは3枚を選んで嶺上牌を引く',()=>{
 const {room,token}=roomApi.createRoom('親');const b=roomApi.join(room,'南'),c=roomApi.join(room,'西'),d=roomApi.join(room,'北');roomApi.start(room,token);
 const faces=['m2','m2','m2','m7','m8','m9','p1','p2','p3','s1','s2','s3','z2'];room.hands[1]=faces.map((face,i)=>({id:'b'+i,face,transparent:i!==0}));room.hands[0][0]={id:'throw',face:'m2',transparent:true};roomApi.discard(room,token,'throw');
 const pattern=roomApi.snapshot(room,b).pending.calls.kan[0];assert.ok(pattern);roomApi.respond(room,b,'kan',pattern,['b0','b1','b2']);roomApi.respond(room,c,'pass');roomApi.respond(room,d,'pass');assert.equal(room.turn,1);assert.equal(room.hands[1].length,11);assert.equal(room.kanCount,1);assert.equal(room.doraIndicators.length,2);
});
test('加カンの成立前に全員のロン機会を設け、パス後に嶺上牌を引く',()=>{
 const {room,token}=roomApi.createRoom('親');const b=roomApi.join(room,'南'),c=roomApi.join(room,'西'),d=roomApi.join(room,'北');roomApi.start(room,token);
 room.melds[0]=[{pattern:'m222+',tiles:[{face:'m2',transparent:true},{face:'m2',transparent:true},{face:'m2',transparent:false}]}];let faces=['m2','m7','m8','m9','p1','p2','p3','s1','s2','s3','z2'];room.hands[0]=faces.map((face,i)=>({id:'a'+i,face,transparent:true}));
 assert.ok(roomApi.snapshot(room,token).addedKans.includes('m222+2'));roomApi.addedKan(room,token,'m222+2','a0');assert.equal(room.phase,'response');assert.deepEqual(roomApi.snapshot(room,b).pending.calls,{chi:[],pon:[],kan:[]});
 for(const t of [b,c,d])roomApi.respond(room,t,'pass');assert.equal(room.melds[0][0].pattern,'m222+2');assert.equal(room.kanCount,1);assert.equal(room.hands[0].length,11);assert.equal(room.phase,'playing');
});
test('加カンを槍槓でき、点数精算はロンを優先',()=>{
 const {room,token}=roomApi.createRoom('親');const b=roomApi.join(room,'南'),c=roomApi.join(room,'西'),d=roomApi.join(room,'北');roomApi.start(room,token);
 room.melds[0]=[{pattern:'m222+',tiles:[{face:'m2'},{face:'m2'},{face:'m2'}]}];room.hands[0]=['m2','m7','m8','m9','p1','p2','p3','s1','s2','s3','z2'].map((face,i)=>({id:'a'+i,face,transparent:true}));
 room.hands[1]=['m1','m3','p1','p2','p3','s1','s2','s3','z1','z1','z1','z2','z2'].map((face,i)=>({id:'b'+i,face,transparent:true}));
 roomApi.addedKan(room,token,'m222+2','a0');assert.equal(roomApi.snapshot(room,b).pending.canRon,true);roomApi.respond(room,b,'ron');roomApi.respond(room,c,'pass');roomApi.respond(room,d,'pass');assert.equal(room.phase,'won');assert.equal(room.kanCount,0);assert.equal(room.melds[0][0].pattern,'m222+');assert.ok(room.result.yaku.some(y=>y.name==='槍槓'));
});
test('手牌の並び替えは他家にも反映され、ツモ牌の識別を保つ',()=>{
 const {room,token}=roomApi.createRoom('親');const b=roomApi.join(room,'南');roomApi.join(room,'西');roomApi.join(room,'北');roomApi.start(room,token);
 const before=room.hands[0].map(t=>t.id),drawn=room.drawnIds[0],reordered=[before[13],...before.slice(0,13)];roomApi.reorder(room,token,reordered);assert.equal(room.hands[0][0].id,drawn);assert.deepEqual(roomApi.snapshot(room,token).hands[0].map(t=>t.id),reordered);
 const seen=roomApi.snapshot(room,b).hands[0];assert.equal(seen.length,14);assert.equal(seen[0].transparent,room.hands[0][0].transparent);room.riichi[0]=true;assert.throws(()=>roomApi.discard(room,token,reordered[1]));roomApi.discard(room,token,drawn);assert.equal(room.phase,'response');
});
test('リーチ宣言牌でロンされた場合は供託を戻す',()=>{
 const {room,token}=roomApi.createRoom('親');const b=roomApi.join(room,'南'),c=roomApi.join(room,'西'),d=roomApi.join(room,'北');roomApi.start(room,token);
 const faces=['m1','m2','m3','p1','p2','p3','s1','s2','s3','z1','z1','z1','z2'];room.hands[0]=[...faces,'z2'].map((face,i)=>({id:'a'+i,face,transparent:true}));room.hands[1]=faces.map((face,i)=>({id:'b'+i,face,transparent:true}));
 roomApi.discard(room,token,'a13',true);assert.equal(room.riichiSticks,1);roomApi.respond(room,b,'ron');roomApi.respond(room,c,'pass');roomApi.respond(room,d,'pass');
 assert.equal(room.phase,'won');assert.equal(room.riichiSticks,0);assert.equal(room.riichi[0],false);assert.equal(room.scores.reduce((a,b)=>a+b,0),100000);assert.equal(room.scores[1]-25000,room.result.points);
});
test('鳴かれて河から消えた捨て牌もフリテン判定に残る',()=>{
 const {room,token}=roomApi.createRoom('親');const b=roomApi.join(room,'南'),c=roomApi.join(room,'西'),d=roomApi.join(room,'北');roomApi.start(room,token);
 const faces=['m1','m2','m3','p1','p2','p3','s1','s2','s3','z1','z1','z1','z2'];room.hands[1]=faces.map((face,i)=>({id:'b'+i,face,transparent:true}));room.discardHistory[1]=['z2'];room.hands[0][0]={id:'throw',face:'z2',transparent:true};roomApi.discard(room,token,'throw');
 assert.equal(roomApi.snapshot(room,b).pending.canRon,false);assert.throws(()=>roomApi.respond(room,b,'ron'));
});
test('九種九牌の宣言と途中流局後の連荘',()=>{
 const {room,token}=roomApi.createRoom('親');roomApi.join(room,'南');roomApi.join(room,'西');roomApi.join(room,'北');roomApi.start(room,token);
 let faces=['m1','m9','p1','p9','s1','s9','z1','z2','z3','z4','m2','m3','m4','m5'];room.hands[0]=faces.map((face,i)=>({id:'a'+i,face,transparent:true}));assert.equal(roomApi.snapshot(room,token).canNineTerminals,true);roomApi.nineTerminals(room,token);assert.equal(room.result.reason,'九種九牌');roomApi.nextRound(room,token);assert.equal(room.round,1);assert.equal(room.honba,1);
});
test('四風連打はロンがなければ途中流局',()=>{
 const {room,token}=roomApi.createRoom('親');const b=roomApi.join(room,'南'),c=roomApi.join(room,'西'),d=roomApi.join(room,'北');let tokens=[token,b,c,d];roomApi.start(room,token);
 for(let seat=0;seat<4;seat++){let tile=room.hands[seat][0];tile.face='z1';roomApi.discard(room,tokens[seat],tile.id);for(let i=0;i<4;i++)if(i!==seat)roomApi.respond(room,tokens[i],'pass');}
 assert.equal(room.phase,'exhausted');assert.equal(room.result.reason,'四風連打');
});
test('終局時に残った供託はトップへ渡し、順位を表示する',()=>{
 const {room,token}=roomApi.createRoom('親');roomApi.join(room,'南');roomApi.join(room,'西');roomApi.join(room,'北');roomApi.start(room,token);room.round=4;room.dealer=3;room.scores=[24000,30000,23000,22000];room.riichiSticks=1;room.phase='exhausted';room.result={method:'draw',tenpai:[false,false,false,false]};roomApi.nextRound(room,token);
 const view=roomApi.snapshot(room,token);assert.equal(view.phase,'finished');assert.equal(room.riichiSticks,0);assert.equal(view.rankings[0].seat,1);assert.equal(view.rankings[0].score,31000);assert.equal(room.scores.reduce((a,b)=>a+b),100000);
});
test('流局時に河が么九牌のみで鳴かれていない場合は流し満貫',()=>{
 const {room,token}=roomApi.createRoom('親');const b=roomApi.join(room,'南'),c=roomApi.join(room,'西'),d=roomApi.join(room,'北');roomApi.start(room,token);
 room.wall=[];room.discardHistory=[['m1'],['m2'],['m3'],['m4']];room.hands[0][0]={id:'last',face:'m9',transparent:true};roomApi.discard(room,token,'last');for(const t of [b,c,d])roomApi.respond(room,t,'pass');
 assert.equal(room.result.method,'nagashi');assert.deepEqual(room.result.nagashi,[true,false,false,false]);assert.deepEqual(room.result.scoreChanges,[12000,-4000,-4000,-4000]);assert.equal(room.scores.reduce((a,b)=>a+b),100000);
});
test('四家立直は宣言牌へのロンがなければ途中流局',()=>{
 const {room,token}=roomApi.createRoom('親');const b=roomApi.join(room,'南'),c=roomApi.join(room,'西'),d=roomApi.join(room,'北');roomApi.start(room,token);room.riichi=[true,true,true,true];const tile=room.hands[0].find(t=>t.id===room.drawnIds[0]);roomApi.discard(room,token,tile.id);for(const t of [b,c,d])roomApi.respond(room,t,'pass');assert.equal(room.phase,'exhausted');assert.equal(room.result.reason,'四家立直');
});
test('四槓散了は嶺上打牌へのロン機会のあとに成立',()=>{
 const {room,token}=roomApi.createRoom('親');const b=roomApi.join(room,'南'),c=roomApi.join(room,'西'),d=roomApi.join(room,'北');roomApi.start(room,token);room.abortAfterDiscard=true;const tile=room.hands[0][0];roomApi.discard(room,token,tile.id);assert.equal(room.phase,'response');for(const t of [b,c,d])roomApi.respond(room,t,'pass');assert.equal(room.result.reason,'四槓散了');
});
test('親の配牌直後のツモには天和が成立',()=>{
 const {room,token}=roomApi.createRoom('親');roomApi.join(room,'南');roomApi.join(room,'西');roomApi.join(room,'北');roomApi.start(room,token);const faces=['m1','m2','m3','p1','p2','p3','s1','s2','s3','z1','z1','z1','z2','z2'];room.hands[0]=faces.map((face,i)=>({id:'a'+i,face,transparent:true}));room.drawnIds[0]='a13';roomApi.tsumo(room,token);assert.ok(room.result.yaku.some(y=>y.name==='天和'));
});
