'use strict';
// Japanese mahjong scoring wrapper. Round control and furiten are checked separately.
const M=require('../vendor/majiang-core/lib');
const RULE=M.rule({'場数':1,'赤牌':{m:0,p:0,s:0}});
function hand13(faces,melds=[]) {
 if(!Array.isArray(melds)||melds.length>4||melds.some(m=>M.Shoupai.valid_mianzi(m)!==m))throw new Error('副露が不正です');
 if(!Array.isArray(faces)||faces.length!==13-3*melds.length||faces.some(p=>!/^([mps][1-9]|z[1-7])$/.test(p))) throw new Error('手牌の枚数か牌が不正です');
 const counts={};for(const p of faces){counts[p]=(counts[p]||0)+1;if(counts[p]>4)throw new Error('同じ牌は4枚までです');}
 const hand=new M.Shoupai(faces);hand._fulou=melds.slice();return hand;
}
function calculate(faces,winningTile,options={}) {
 let h=hand13(faces,options.melds||[]);
 if(!/^([mps][1-9]|z[1-7])$/.test(winningTile)||faces.filter(p=>p===winningTile).length>=4)throw new Error('和了牌が不正です');
 const seat=options.seat??1;if(!Number.isInteger(seat)||seat<0||seat>3)throw new Error('自風が不正です');
 const method=options.method||'tsumo';if(!['tsumo','ron'].includes(method))throw new Error('和了方法が不正です');
 const direction=options.direction;if(method==='ron'&&!['+','=','-'].includes(direction))throw new Error('放銃者の位置が必要です');
 const param=M.Util.hule_param({rule:RULE,menfeng:seat,zhuangfeng:0,lizhi:options.doubleRiichi?2:options.riichi?1:0,yifa:!!options.ippatsu,haidi:options.lastTile||0,lingshang:!!options.rinshan,qianggang:!!options.chankan,baopai:options.doraIndicators||[],fubaopai:options.uraIndicators||null,changbang:options.honba||0,lizhibang:options.riichiSticks||0});
 if(method==='tsumo')h.zimo(winningTile);
 const result=M.Util.hule(h,method==='ron'?winningTile+direction:null,param);
 if(!result||!result.hupai||result.hupai.length===0||!result.defen)return null;
 return {fu:result.fu,han:result.fanshu,yakuman:result.damanguan,yaku:result.hupai,points:result.defen,payments:result.fenpei};
}
function waits(faces,melds=[]) {
 const hand=hand13(faces,melds);
 return M.Util.xiangting(hand)===0 ? M.Util.tingpai(hand) : [];
}
function callOptions(faces,melds,tile,direction,paishu){
 const h=hand13(faces,melds),p=tile+direction;
 return {chi:M.Game.get_chi_mianzi(RULE,h,p,paishu)||[],pon:M.Game.get_peng_mianzi(RULE,h,p,paishu)||[],kan:M.Game.get_gang_mianzi(RULE,h,p,paishu,0)||[]};
}
function ownKanOptions(faces,melds,riichi,paishu,kanCount){
 if(!faces.length)return [];
 const h=hand13(faces.slice(0,-1),melds);h.zimo(faces[faces.length-1]);h._lizhi=riichi;
 return M.Game.get_gang_mianzi(RULE,h,null,paishu,kanCount)||[];
}
function callDiscards(faces,melds,lastMeld){
 const h=new M.Shoupai(faces);h._fulou=melds.slice();h._zimo=lastMeld;
 return M.Game.get_dapai(RULE,h)||[];
}
module.exports={calculate,waits,callOptions,callDiscards,ownKanOptions};
