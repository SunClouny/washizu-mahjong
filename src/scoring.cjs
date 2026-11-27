'use strict';
// Japanese mahjong scoring wrapper. Round control and furiten are checked separately.
const M=require('../vendor/majiang-core/lib');
const RULE=M.rule({'場数':1,'赤牌':{m:0,p:0,s:0}});
function hand13(faces) {
 if(!Array.isArray(faces)||faces.length!==13||faces.some(p=>!/^([mps][1-9]|z[1-7])$/.test(p))) throw new Error('手牌は13枚の有効な牌が必要です');
 const counts={};for(const p of faces){counts[p]=(counts[p]||0)+1;if(counts[p]>4)throw new Error('同じ牌は4枚までです');}
 return new M.Shoupai(faces);
}
function calculate(faces,winningTile,options={}) {
 let h=hand13(faces);
 if(!/^([mps][1-9]|z[1-7])$/.test(winningTile)||faces.filter(p=>p===winningTile).length>=4)throw new Error('和了牌が不正です');
 const seat=options.seat??1;if(!Number.isInteger(seat)||seat<0||seat>3)throw new Error('自風が不正です');
 const method=options.method||'tsumo';if(!['tsumo','ron'].includes(method))throw new Error('和了方法が不正です');
 const direction=options.direction;if(method==='ron'&&!['+','=','-'].includes(direction))throw new Error('放銃者の位置が必要です');
 const param=M.Util.hule_param({rule:RULE,menfeng:seat,zhuangfeng:0,lizhi:options.riichi?1:0,baopai:options.doraIndicators||[],changbang:options.honba||0,lizhibang:options.riichiSticks||0});
 if(method==='tsumo')h.zimo(winningTile);
 const result=M.Util.hule(h,method==='ron'?winningTile+direction:null,param);
 if(!result||!result.hupai||result.hupai.length===0||!result.defen)return null;
 return {fu:result.fu,han:result.fanshu,yakuman:result.damanguan,yaku:result.hupai,points:result.defen,payments:result.fenpei};
}
function waits(faces) {
 const hand=hand13(faces);
 return M.Util.xiangting(hand)===0 ? M.Util.tingpai(hand) : [];
}
module.exports={calculate,waits};
