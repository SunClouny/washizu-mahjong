const test=require('node:test');const assert=require('node:assert/strict');const {Readable}=require('node:stream');const {createServer}=require('../src/server.cjs');
test('通信処理：部屋作成、参加、本人認証と手牌の秘匿',async()=>{
 const server=createServer();
 const api=async(route,data)=>new Promise(resolve=>{const req=Readable.from([JSON.stringify(data)]);req.method='POST';req.url='/api/'+route;const res={writeHead(status){this.status=status;},end(content){resolve({status:this.status,data:JSON.parse(content)});}};server.emit('request',req,res);});
 let owner=(await api('create',{name:'親'})).data;let all=[owner];for(let name of ['南','西','北']) all.push((await api('join',{code:owner.code,name})).data);
 assert.equal((await api('start',{code:owner.code,token:owner.token})).status,200);
 const state=(await api('state',{code:owner.code,token:all[1].token})).data;
 assert.equal(state.players.length,4);assert.ok(state.hands[0].filter(t=>!t.transparent).every(t=>!('face' in t)&&!('id' in t)));
 assert.equal((await api('state',{code:owner.code,token:'invalid'})).status,400);
});
