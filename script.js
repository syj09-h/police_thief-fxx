// Game variables
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = canvas.width, H = canvas.height;

const modeEl = document.getElementById('mode');
const diffEl = document.getElementById('difficulty');
const restartBtn = document.getElementById('restart');
const timerEl = document.getElementById('timer');
const statusEl = document.getElementById('status');
const copScoreEl = document.getElementById('copScore');
const thiefScoreEl = document.getElementById('thiefScore');

let state = 'idle'; // idle, running, ended
let timeLeft = 60; // seconds per round
let lastTime = performance.now();

// Scores (persistent across rounds)
let copScore = 0;
let thiefScore = 0;

// Entities
function createEntity(x,y,color){
  return {x,y,vx:0,vy:0,speed:120,rad:14,color}
}
let cop = createEntity(100,100,'#3aa0ff');
let thief = createEntity(700,440,'#ff9a3a');

// Coins
let coins = [];
const COIN_RADIUS = 8;
let coinSpawnTimer = 0;
const MAX_COINS = 5;
const COIN_SPAWN_INTERVAL = 5.0; // seconds
const COIN_VALUE = 10;

// Difficulty adjusts thief speed & timer
function applyDifficulty(){
  const d = diffEl.value;
  if(d==='easy'){ thief.speed = 90; cop.speed = 140; timeLeft = 45 }
  else if(d==='normal'){ thief.speed = 130; cop.speed = 140; timeLeft = 60 }
  else { thief.speed = 160; cop.speed = 140; timeLeft = 60 }
}
applyDifficulty();

// Input
const keys = {};
window.addEventListener('keydown',e=>{ keys[e.key.toLowerCase()] = true });
window.addEventListener('keyup',e=>{ keys[e.key.toLowerCase()] = false });

// Touch support: simple virtual joystick
let touchPos = null;
canvas.addEventListener('touchstart', e=>{ e.preventDefault(); const t = e.touches[0]; touchPos = getCanvasPos(t); });
canvas.addEventListener('touchmove', e=>{ e.preventDefault(); const t = e.touches[0]; touchPos = getCanvasPos(t); });
canvas.addEventListener('touchend', e=>{ touchPos = null });

function getCanvasPos(evt){
  const r = canvas.getBoundingClientRect();
  return {x: (evt.clientX - r.left) * (canvas.width/r.width), y: (evt.clientY - r.top) * (canvas.height/r.height)}
}

// AI for thief (single-player)
// The AI tries to flee from cop but will also be attracted to nearest coin
function thiefAI(dt){
  // flee vector
  const dx = thief.x - cop.x;
  const dy = thief.y - cop.y;
  const dist = Math.hypot(dx,dy) || 0.001;
  const nx = dx/dist;
  const ny = dy/dist;
  const fleeStrength = Math.min(1, 200/dist);

  // seek nearest coin if exists
  let seekX = 0, seekY = 0, seekWeight = 0;
  if(coins.length > 0){
    let nearest = coins[0]; let nd = Math.hypot(thief.x - nearest.x, thief.y - nearest.y);
    for(let c of coins){
      const d2 = Math.hypot(thief.x - c.x, thief.y - c.y);
      if(d2 < nd){ nd = d2; nearest = c; }
    }
    const sx = nearest.x - thief.x;
    const sy = nearest.y - thief.y;
    const sd = Math.hypot(sx,sy)||1;
    seekX = sx/sd; seekY = sy/sd;
    seekWeight = 0.8; // how much AI goes for coins
  }

  // combine behaviors (flee + seek)
  const vx = nx * (1 + 0.6*fleeStrength) * thief.speed * -1 * (1 - seekWeight) + seekX * thief.speed * seekWeight;
  const vy = ny * (1 + 0.6*fleeStrength) * thief.speed * -1 * (1 - seekWeight) + seekY * thief.speed * seekWeight;

  // add some randomness
  thief.vx = vx + (Math.random()-0.5)*40;
  thief.vy = vy + (Math.random()-0.5)*40;
}

// coin utilities
function spawnCoin(){
  if(coins.length >= MAX_COINS) return;
  const margin = 30;
  const x = margin + Math.random() * (W - margin*2);
  const y = margin + Math.random() * (H - margin*2);
  coins.push({x,y,rad:COIN_RADIUS});
}
function removeCoin(idx){ coins.splice(idx,1); }

// update
function update(dt){
  if(state!=='running') return;

  // coin spawn timer
  coinSpawnTimer += dt;
  if(coinSpawnTimer >= COIN_SPAWN_INTERVAL){
    coinSpawnTimer = 0;
    spawnCoin();
  }

  // Cop control (arrow keys or touch)
  let moveX=0, moveY=0;
  if(touchPos){ // move cop toward touch if single-player
    const tx = touchPos.x, ty = touchPos.y;
    const dx = tx - cop.x, dy = ty - cop.y; const d = Math.hypot(dx,dy)||1;
    moveX = dx/d; moveY = dy/d;
  } else {
    if(keys['arrowleft']) moveX -= 1;
    if(keys['arrowright']) moveX += 1;
    if(keys['arrowup']) moveY -= 1;
    if(keys['arrowdown']) moveY += 1;
  }
  // normalize
  if(Math.abs(moveX)+Math.abs(moveY) > 0.001){
    const m = Math.hypot(moveX,moveY)||1; moveX/=m; moveY/=m;
    cop.vx = moveX * cop.speed; cop.vy = moveY * cop.speed;
  } else { cop.vx = 0; cop.vy = 0 }

  // Thief control in duo mode
  if(modeEl.value === 'duo'){
    let tx=0, ty=0;
    if(keys['a']) tx -=1; if(keys['d']) tx +=1; if(keys['w']) ty -=1; if(keys['s']) ty +=1;
    if(Math.abs(tx)+Math.abs(ty)>0.001){ const m = Math.hypot(tx,ty)||1; thief.vx = tx/m * thief.speed; thief.vy = ty/m * thief.speed; }
    else { thief.vx = 0; thief.vy = 0 }
  } else {
    thiefAI(dt);
  }

  // integrate
  cop.x += cop.vx * dt;
  cop.y += cop.vy * dt;
  thief.x += thief.vx * dt;
  thief.y += thief.vy * dt;

  // stay inside bounds
  [cop,thief].forEach(e=>{
    e.x = Math.max(e.rad, Math.min(W-e.rad, e.x));
    e.y = Math.max(e.rad, Math.min(H-e.rad, e.y));
  });

  // coin collection (thief collects)
  for(let i = coins.length - 1; i >= 0; i--){
    const c = coins[i];
    const d = Math.hypot(thief.x - c.x, thief.y - c.y);
    if(d < thief.rad + c.rad + 4){
      // collect
      thiefScore += COIN_VALUE;
      thiefScoreEl.textContent = thiefScore;
      removeCoin(i);
    }
  }

  // collision check (tag)
  const dx = cop.x - thief.x, dy = cop.y - thief.y;
  const dist = Math.hypot(dx,dy);
  if(dist < cop.rad + thief.rad + 6){
    // tagged
    copScore += 1;
    copScoreEl.textContent = copScore;
    endRound('cop');
  }

  // timer
  timeLeft -= dt;
  if(timeLeft <= 0){
    // thief survived round -> bonus points
    thiefScore += 20;
    thiefScoreEl.textContent = thiefScore;
    endRound('thief');
  }
}

function endRound(winner){
  state = 'ended';
  if(winner==='cop') statusEl.textContent = '경찰 승리! (도둑 검거) — +1점';
  else statusEl.textContent = '도둑 승리! 시간 경과 — +20점';
  // show brief flash or effect (optional)
}

// draw
function draw(){
  ctx.clearRect(0,0,W,H);
  // background
  ctx.fillStyle = '#05202f';
  ctx.fillRect(0,0,W,H);

  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.lineWidth=1;
  for(let x=0;x<W;x+=40){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for(let y=0;y<H;y+=40){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // draw coins
  for(let c of coins){
    ctx.beginPath();
    ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(255,215,0,0.9)';
    ctx.fillStyle = '#ffd54d';
    ctx.arc(c.x,c.y,c.rad,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    // small shine
    ctx.beginPath(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.arc(c.x-3,c.y-3,2,0,Math.PI*2); ctx.fill();
  }

  // thief trail
  ctx.save(); ctx.globalAlpha = 0.12;
  ctx.beginPath(); ctx.fillStyle = thief.color; ctx.arc(thief.x,thief.y,thief.rad*1.8,0,Math.PI*2); ctx.fill(); ctx.restore();

  // entities
  drawEntity(thief);
  drawEntity(cop);

  // HUD overlay on canvas
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(8,8,220,36);
  ctx.fillStyle = '#fff'; ctx.font = '14px system-ui'; ctx.fillText('남은 시간: ' + formatTime(timeLeft), 16, 32);
}

function drawEntity(e){
  ctx.beginPath();
  ctx.shadowColor = e.color; ctx.shadowBlur = 20;
  ctx.fillStyle = e.color; ctx.arc(e.x, e.y, e.rad, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
}

function formatTime(t){ t = Math.max(0, Math.ceil(t)); const mm = Math.floor(t/60); const ss = t%60; return String(mm).padStart(2,'0') + ':' + String(ss).padStart(2,'0') }

// main loop
function loop(now){
  const dt = Math.min(0.05, (now - lastTime)/1000);
  lastTime = now;
  update(dt);
  draw();
  // update HUD
  timerEl.textContent = formatTime(timeLeft);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// UI handlers
restartBtn.addEventListener('click', ()=>{ startRound(); });
modeEl.addEventListener('change', ()=>{ startRound(); });
diffEl.addEventListener('change', ()=>{ applyDifficulty(); startRound(); });

// Round control
function resetEntities(){
  cop.x = 100; cop.y = 100;
  thief.x = W - 100; thief.y = H - 100;
  cop.vx = cop.vy = thief.vx = thief.vy = 0;
  coins = [];
  coinSpawnTimer = 0;
}

function startRound(){
  resetEntities();
  state = 'running'; statusEl.textContent = '실행 중';
  applyDifficulty();
  lastTime = performance.now();
}

// init
copScoreEl.textContent = copScore;
thiefScoreEl.textContent = thiefScore;
startRound();
