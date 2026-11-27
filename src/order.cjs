'use strict';
// Ordering is a local display preference; game rules and tile ownership are unchanged.
function moveTile(ids, from, to) {
  if (!Array.isArray(ids) || !Number.isInteger(from) || !Number.isInteger(to) || from<0 || to<0 || from>=ids.length || to>=ids.length) throw new RangeError('Invalid tile position');
  const next=ids.slice(); const [tile]=next.splice(from,1); next.splice(to,0,tile); return next;
}
// Retain the relative order of known tiles as draws and discards occur.
function reconcileOrder(previousIds, hand) {
  const byId=new Map(hand.map(tile=>[tile.id,tile]));
  const ordered=[]; for(const id of previousIds) if(byId.has(id)) { ordered.push(byId.get(id)); byId.delete(id); }
  return ordered.concat([...byId.values()]);
}
module.exports={moveTile,reconcileOrder};
