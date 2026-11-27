'use strict';
// Development server only: the game rules are not yet complete.
const http=require('node:http');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const R=require('./room.cjs');
const rooms=new Map();
const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function roomCode(){let code;do{code=Array.from(crypto.randomBytes(8),b=>chars[b%chars.length]).join('');}while(rooms.has(code));return code;}
function respond(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(value));}
function body(req){return new Promise((resolve,reject)=>{let data='';req.on('data',chunk=>{data+=chunk;if(data.length>8192){reject(new Error('入力が長すぎます'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(data||'{}'));}catch{reject(new Error('入力が不正です'));}});req.on('error',reject);});}
function createServer(){return http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/'){
    const html=fs.readFileSync(path.join(__dirname,'../public/index.html'));
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});return res.end(html);
  }
  if(req.method==='GET'&&url.pathname==='/health'){return respond(res,200,{ok:true,stage:'development'});}
  if(req.method!=='POST'||!url.pathname.startsWith('/api/')) return respond(res,404,{error:'見つかりません'});
  const data=await body(req);
  if(url.pathname==='/api/create'){const created=R.createRoom(data.name);const code=roomCode();rooms.set(code,created.room);return respond(res,200,{code,token:created.token});}
  const code=String(data.code||'').trim().toUpperCase();const room=rooms.get(code);
  if(!room) return respond(res,404,{error:'部屋が見つかりません'});
  if(url.pathname==='/api/join'){const token=R.join(room,data.name);return respond(res,200,{code,token});}
  if(url.pathname==='/api/state') return respond(res,200,R.snapshot(room,data.token));
  if(url.pathname==='/api/start'){R.start(room,data.token);return respond(res,200,R.snapshot(room,data.token));}
  if(url.pathname==='/api/discard'){R.discard(room,data.token,data.tileId,data.riichi===true);return respond(res,200,R.snapshot(room,data.token));}
  if(url.pathname==='/api/reorder'){R.reorder(room,data.token,data.tileIds);return respond(res,200,R.snapshot(room,data.token));}
  if(url.pathname==='/api/respond'){R.respond(room,data.token,data.choice,data.pattern,data.tileIds);return respond(res,200,R.snapshot(room,data.token));}
  if(url.pathname==='/api/tsumo'){R.tsumo(room,data.token);return respond(res,200,R.snapshot(room,data.token));}
  if(url.pathname==='/api/closed-kan'){R.closedKan(room,data.token,data.pattern,data.tileIds);return respond(res,200,R.snapshot(room,data.token));}
  if(url.pathname==='/api/added-kan'){R.addedKan(room,data.token,data.pattern,data.tileId);return respond(res,200,R.snapshot(room,data.token));}
  if(url.pathname==='/api/nine-terminals'){R.nineTerminals(room,data.token);return respond(res,200,R.snapshot(room,data.token));}
  if(url.pathname==='/api/next'){R.nextRound(room,data.token);return respond(res,200,R.snapshot(room,data.token));}
  return respond(res,404,{error:'見つかりません'});
 }catch(err){return respond(res,400,{error:err.message});}});}
if(require.main===module){const port=Number(process.env.PORT||3000);createServer().listen(port,'127.0.0.1',()=>console.log(`開発サーバー: http://127.0.0.1:${port}`));}
module.exports={createServer};
