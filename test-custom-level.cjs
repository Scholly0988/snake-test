const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync('custom-level.js','utf8')+'\nthis.levelLoader=SnakeCustomLevel;',context);
const raw = fs.readFileSync('Level_4.json','utf8');
const level = context.levelLoader.parse(raw);

assert.equal(level.format,'the-snake-level');
assert.equal(level.version,1);
assert.equal(level.width,1000);
assert.equal(level.height,2200);
assert.equal(level.snakes.length,5);
assert.equal(level.snakes[0].segments,100);
assert.equal(level.snakes[0].waypoints.length,6);
assert.equal(level.snakes[4].headPng,'snake-head.png');
assert.equal(level.snakes[4].bodyPng,'snake-body.png');
assert.equal(level.obstacles.length,2);
assert.equal(level.obstacles[0].png,'Busch.png');
assert.equal(level.firstHp,5);
assert.equal(level.lastHp,5500);
assert.equal(level.hpFallback,true);

const explicit = context.levelLoader.validate({
  format:'the-snake-level',version:1,name:'HP-Test',width:1000,height:2200,
  firstHp:15,lastHp:9000,
  snakes:[{name:'Test',segments:3,speed:90,headPng:'C:\\Temp\\head.png',bodyPng:'body.png',waypoints:[]}],
  obstacles:[]
});
assert.equal(explicit.firstHp,15);
assert.equal(explicit.lastHp,9000);
assert.equal(explicit.hpFallback,false);
assert.equal(explicit.snakes[0].headPng,'head.png');

assert.throws(()=>context.levelLoader.parse('{kaputt'),/gültiges JSON/);
assert.throws(()=>context.levelLoader.validate({format:'wrong',version:1}),/unterstütztes/);
assert.throws(()=>context.levelLoader.validate({format:'the-snake-level',version:1,width:1000,height:2200,snakes:[],obstacles:[]}),/1 bis 50/);

console.log('PASS: editor Level_4 format, Windows PNG paths, HP fallback and validation');
