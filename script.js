const canvas = document.getElementById('game');
let vx=0,vy=0;
if(keys['ArrowUp']||keys['w']) vy-=1;
if(keys['ArrowDown']||keys['s']) vy+=1;
if(keys['ArrowLeft']||keys['a']) vx-=1;
if(keys['ArrowRight']||keys['d']) vx+=1;
// 모바일 터치 방향
vx += touchDir.x; vy += touchDir.y;


const mag=Math.hypot(vx,vy)||1;
police.x += (vx/mag)*police.speed;
police.y += (vy/mag)*police.speed;
police.x=Math.max(police.size,Math.min(W-police.size,police.x));
police.y=Math.max(police.size,Math.min(H-police.size,police.y));


if(Math.random()<0.01+0.002*level){robberDir={x:rand(-1,1),y:rand(-1,1)};normalize(robberDir);}
const dx=robber.x-police.x, dy=robber.y-police.y, dist=Math.hypot(dx,dy);
if(dist<160-(level*6)){robberDir.x+=dx/dist*0.8; robberDir.y+=dy/dist*0.8; normalize(robberDir);}
robber.x+=robberDir.x*robber.speed; robber.y+=robberDir.y*robber.speed;
if(robber.x<robber.size||robber.x>W-robber.size) robberDir.x*=-1;
if(robber.y<robber.size||robber.y>H-robber.size) robberDir.y*=-1;


if(dist<police.size+robber.size){
score+=10*level; scoreEl.textContent=score;
if(score>=level*50){level++; levelEl.textContent=level; robber.speed+=0.3; police.speed+=0.15; timeLeft+=10;}
robber.x=rand(30,W-30); robber.y=rand(30,H-30); robberDir={x:rand(-1,1),y:rand(-1,1)}; normalize(robberDir);
}


function draw(){
ctx.clearRect(0,0,W,H);
ctx.strokeStyle='rgba(0,0,0,0.03)';
for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
robber.draw(); police.draw();
if(gameOver){ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.font='36px sans-serif';ctx.textAlign='center';ctx.fillText('게임오버',W/2,H/2-10);ctx.font='20px sans-serif';ctx.fillText('다시 시작하려면 버튼을 누르세요',W/2,H/2+26);}
}


let last=performance.now();
function loop(now){const dt=now-last;last=now;update(dt);draw();timeEl.textContent=Math.ceil(timeLeft);requestAnimationFrame(loop);}
requestAnimationFrame(loop);


window.addEventListener('keydown',e=>keys[e.key]=true);
window.addEventListener('keyup',e=>keys[e.key]=false);


restartBtn.addEventListener('click',()=>{
score=0;level=1;timeLeft=60;gameOver=false;
police.x=W/2;police.y=H/2;police.speed=3.2;
robber.x=rand(30,W-30);robber.y=rand(30,H-30);robber.speed=2.2;
scoreEl.textContent=score;levelEl.textContent=level;timeEl.textContent=timeLeft;
});


// 모바일 터치 조작 추가
touchStart=null; touchDir={x:0,y:0};
canvas.addEventListener('touchstart',e=>{
const t=e.touches[0]; touchStart={x:t.clientX,y:t.clientY}; touchDir={x:0,y:0};
});
canvas.addEventListener('touchmove',e=>{
if(!touchStart) return;
const t=e.touches[0];
const dx=t.clientX-touchStart.x;
const dy=t.clientY-touchStart.y;
const threshold=20; // 최소 이동 거리
touchDir.x=Math.abs(dx)>threshold?Math.sign(dx):0;
touchDir.y=Math.abs(dy)>threshold?Math.sign(dy):0;
});
canvas.addEventListener('touchend',()=>{touchStart=null; touchDir={x:0,y:0};});
