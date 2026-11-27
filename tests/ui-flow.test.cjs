const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {Readable}=require('node:stream');const {createServer}=require('../src/server.cjs');
class Element {constructor(){this.children=[];this.value='';this.textContent='';this.hidden=false;this.disabled=false;}append(...x){this.children.push(...x)}replaceChildren(...x){this.children=x}setAttribute(){} }
function client(server){
 const elements=new Map();const document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id)},createElement(){return new Element()},createElementNS(){return new Element()}};const storage=new Map();
 const fetch=async(url,options)=>new Promise(resolve=>{const req=Readable.from([options.body]);req.method=options.method;req.url=url;const res={writeHead(status){this.status=status},end(data){resolve({ok:this.status<400,json:async()=>JSON.parse(data)})}};server.emit('request',req,res)});
 const context=vm.createContext({document,fetch,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},navigator:{clipboard:{writeText:async()=>{}}},setInterval:()=>0,console,Map,Set});
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
