'use strict';
// Tiles have distinct IDs: one opaque and three clear for each face.
const crypto = require('crypto');
const faces = [...'mps'].flatMap(s => Array.from({length:9}, (_, i) => s + (i + 1))).concat(Array.from({length:7}, (_, i) => 'z' + (i + 1)));
function makeWall(randomInt = crypto.randomInt) {
  const wall = faces.flatMap(face => Array.from({length:4}, (_, i) => ({id: face + '-' + i, face, transparent:i !== 0})));
  for (let i = wall.length - 1; i > 0; i--) { const j = randomInt(i + 1); [wall[i], wall[j]] = [wall[j], wall[i]]; }
  return wall;
}
function visibleHand(hand, isOwner) {
  return hand.map(t => isOwner || t.transparent ? {id:t.id, face:t.face, transparent:t.transparent} : {transparent:false});
}
module.exports = {faces, makeWall, visibleHand};
