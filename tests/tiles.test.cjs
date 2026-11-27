const test = require('node:test');
const assert = require('node:assert/strict');
const {faces, makeWall, visibleHand} = require('../src/tiles.cjs');
test('牌山は34種各4枚で各種3枚が透明', () => {
  const wall = makeWall(); assert.equal(wall.length,136); assert.equal(new Set(wall.map(t=>t.id)).size,136);
  for (const face of faces) { const tiles=wall.filter(t=>t.face===face); assert.equal(tiles.length,4); assert.equal(tiles.filter(t=>t.transparent).length,3); }
});
test('他家に不透明牌の種類と識別子を渡さない', () => {
  const wall=makeWall(); const result=visibleHand(wall,false);
  assert.equal(result.filter(t=>!t.transparent).length,34);
  assert.ok(result.filter(t=>!t.transparent).every(t=>!('id' in t)&&!('face' in t)));
  assert.deepEqual(visibleHand(wall,true),wall);
});
