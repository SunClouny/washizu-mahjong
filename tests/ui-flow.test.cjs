const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {Readable}=require('node:stream');const {createServer}=require('../src/server.cjs');
class Element {constructor(){this.children=[];this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.style={setProperty:(k,v)=>{this.style[k]=v}};this.clientWidth=600;}append(...x){this.children.push(...x)}replaceChildren(...x){this.children=x}setAttribute(){} }
function client(server){
 const elements=new Map();const document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id)},createElement(){return new Element()},createElementNS(){return new Element()}};const storage=new Map();
 const fetch=async(url,options)=>new Promise(resolve=>{const req=Readable.from([options.body]);req.method=options.method;req.url=url;const res={writeHead(status){this.status=status},end(data){resolve({ok:this.status<400,json:async()=>JSON.parse(data)})}};server.emit('request',req,res)});
 const context=vm.createContext({document,window:{innerWidth:900},fetch,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},navigator:{clipboard:{writeText:async()=>{}}},setInterval:()=>0,console,Map,Set});
 const html=fs.readFileSync(require('node:path').join(__dirname,'../public/index.html'),'utf8');vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
 return {doc:document,run:code=>vm.runInContext(code,context)};
}
test('画面操作から4人で入室、配牌、並べ替え、打牌が進む',async()=>{
 const server=createServer(),clients=Array.from({length:4},()=>client(server));const [host,...others]=clients;host.doc.getElementById('name').value='親';await host.doc.getElementById('create').onclick();const code=host.run('session.code');assert.ok(code);
 for(let i=0;i<3;i++){others[i].doc.getElementById('name').value='子'+i;others[i].doc.getElementById('code').value=code;await others[i].doc.getElementById('join').onclick();}
 await host.run('refresh()');await host.doc.getElementById('start').onclick();for(const c of others)await c.run('refresh()');assert.equal(host.run('state.phase'),'playing');assert.equal(host.doc.getElementById('hand').children.length,14);
 const first=host.run('state.hands[0][0].id');host.doc.getElementById('hand').children[0].onclick();await host.doc.getElementById('right').onclick();assert.equal(host.run('state.hands[0][1].id'),first);
 await host.doc.getElementById('discard').onclick();assert.equal(host.run('state.phase'),'response');for(const c of others){await c.run('refresh()');if(c.run("state.phase==='response' && state.pending && !state.pending.answered && state.pending.discarder!==state.seat"))await c.doc.getElementById('pass').onclick();}
 await host.run('refresh()');assert.equal(host.run('state.phase'),'playing');assert.equal(host.run('state.turn'),1);assert.ok(host.run('state.scores.every(x=>x===25000)'));
});
test('画面から4人で東風戦の最後まで進行し順位を表示',async()=>{
 const server=createServer(),clients=Array.from({length:4},()=>client(server));const [host,...others]=clients;host.doc.getElementById('name').value='親';await host.doc.getElementById('create').onclick();const code=host.run('session.code');
 for(let i=0;i<3;i++){others[i].doc.getElementById('name').value='子'+i;others[i].doc.getElementById('code').value=code;await others[i].doc.getElementById('join').onclick();}
 await host.run('refresh()');await host.doc.getElementById('start').onclick();let iterations=0;
 while(iterations++<2500){
   for(const c of clients)await c.run('refresh()');
   if(host.run("state.phase==='finished'"))break;
   if(host.run("state.phase==='playing'")){
     const seat=host.run('state.turn'),c=clients[seat];await c.run('refresh()');if(!c.run("state.phase==='playing' && state.turn===state.seat"))continue;
     const hand=c.doc.getElementById('hand').children;assert.ok(hand.length>0);hand[hand.length-1].onclick();await c.doc.getElementById('discard').onclick();
   }else if(host.run("state.phase==='response'")){
     for(const c of clients){await c.run('refresh()');if(c.run("state.phase==='response' && state.pending && !state.pending.answered && state.pending.discarder!==state.seat"))await c.doc.getElementById('pass').onclick();}
   }else if(host.run("state.phase==='won'||state.phase==='exhausted'")){await host.doc.getElementById('next').onclick();}
 }
 await host.run('refresh()');assert.equal(host.run('state.phase'),'finished');assert.equal(host.run('state.rankings.length'),4);assert.ok(iterations<2500);
 const standings=host.run('JSON.stringify(state.rankings)');
 await host.doc.getElementById('leave').onclick();
 assert.equal(host.run('session'),null);
 for(const c of others){
   await c.run('refresh()');
   assert.equal(c.run('JSON.stringify(state.rankings)'),standings);
   await c.doc.getElementById('leave').onclick();
 }
 await host.doc.getElementById('cpuGame').onclick();
 assert.equal(host.run('state.phase'),'playing');
});
test('各視点で河は卓の四方向に分かれ、６列で並ぶ',async()=>{
 const server=createServer(),clients=Array.from({length:4},()=>client(server));const [host,...others]=clients;host.doc.getElementById('name').value='親';await host.doc.getElementById('create').onclick();const code=host.run('session.code');for(let i=0;i<3;i++){others[i].doc.getElementById('name').value='子'+i;others[i].doc.getElementById('code').value=code;await others[i].doc.getElementById('join').onclick();}await host.run('refresh()');await host.doc.getElementById('start').onclick();
 host.run("state.discards=Array.from({length:4},()=>Array.from({length:13},()=>({face:'m1',transparent:true})));render()");const rivers=host.doc.getElementById('players').children.filter(x=>x.className?.includes('river-'));assert.equal(rivers.length,4);assert.deepEqual(rivers.map(x=>x.className.split(' ').find(c=>c.startsWith('river-'))),['river-bottom','river-right','river-top','river-left']);assert.ok(rivers.every(r=>r.children.length===13));const html=fs.readFileSync(require('node:path').join(__dirname,'../public/index.html'),'utf8');assert.match(html,/grid-template-columns:repeat\(6,/);
});

test('手牌サイズを調整し横幅に合わせられる',()=>{const c=client(createServer()),size=c.doc.getElementById('handSize'),hand=c.doc.getElementById('hand');size.value='60';size.oninput();assert.equal(hand.style['--hand-width'],'60px');c.doc.getElementById('handFit').onclick();assert.equal(hand.style['--hand-width'],'39px');});
test('手牌を選んで移動先の牌を押すと一度で移動する',async()=>{
 const server=createServer(),host=client(server);host.doc.getElementById('name').value='親';await host.doc.getElementById('create').onclick();for(let i=0;i<3;i++)await host.doc.getElementById('addCpu').onclick();await host.doc.getElementById('start').onclick();
 const hand=host.doc.getElementById('hand');const before=host.run('order.slice()');hand.children[0].onclick();hand.children[5].onclick();await new Promise(resolve=>setTimeout(resolve,20));const after=host.run('order.slice()');assert.equal(after[5],before[0]);assert.equal(after[0],before[1]);
});

test('CPU戦開始ボタンで部屋作成から配牌まで進む',async()=>{const c=client(createServer());c.doc.getElementById('name').value='親';await c.doc.getElementById('cpuGame').onclick();assert.equal(c.run('state.phase'),'playing');assert.equal(c.run('state.players.length'),4);assert.equal(c.doc.getElementById('hand').children.length,14);assert.equal(c.run('state.players[1].name'),'CPU 1')});

test('自席を含む4人の副露を各家の右隅に置き、両隣の名札は卓外に表示する',async()=>{
 const c=client(createServer());
 c.doc.getElementById('name').value='親';
 await c.doc.getElementById('cpuGame').onclick();
 c.run("state.melds=Array.from({length:4},()=>[{pattern:'m222=',tiles:[1,2,3].map(()=>({face:'m2',transparent:true}))}]);");
 for(let seat=0;seat<4;seat++){
   c.run('state.seat='+seat+';render()');
   const corners=c.doc.getElementById('players').children.filter(x=>x.className?.startsWith('meld-corner'));
   assert.equal(corners.length,4);
   assert.equal(corners[seat].className,'meld-corner meld-bottom');
   const names=c.doc.getElementById('sideScores').children;
   assert.equal(names.length,2);
   assert.ok(names.find(x=>x.className.includes('seat-right')).children[0].textContent.startsWith('下家'));
   assert.ok(names.find(x=>x.className.includes('seat-left')).children[0].textContent.startsWith('上家'));
 }
});

test('チーの実牌とポン・大明カンの指示牌、加カンの重なり、暗カンの伏せ牌を描き分ける',()=>{
 const c=client(createServer());
 const group=(pattern,faces,closed=false)=>c.run('meldCorner("bottom","親",'+JSON.stringify([{
   pattern,closed,tiles:faces.split(' ').map((face,i)=>({face,transparent:i!==2}))
 }])+').children[0].children');
 const called=slots=>Array.from(slots).findIndex(s=>s.className.includes('called'));
 const chi=group('m12-3','m3 m1 m2');
 assert.equal(called(chi),0);
 assert.equal(chi[0].children[0].textContent,'二');
 assert.ok(!chi[0].children[0].className.includes('clear'));
 assert.equal(chi[1].children[0].textContent,'一');
 for(const [from,pon,kan] of [['-',0,0],['=',1,1],['+',2,3]]){
   assert.equal(called(group('m222'+from,'m2 m2 m2')),pon);
   assert.equal(called(group('m2222'+from,'m2 m2 m2 m2')),kan);
   const slots=group('m222'+from+'2','m2 m2 m2 m2');
   assert.equal(slots.length,3);
   assert.equal(slots[pon].children.length,2);
 }
 const closed=group('m2222','m2 m2 m2 m2',true);
 assert.deepEqual(Array.from(closed,s=>s.children[0].textContent),['◆','二','二','◆']);
});
