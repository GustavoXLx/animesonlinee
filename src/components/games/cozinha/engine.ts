import Phaser from "phaser";
import type { ActMsg,HeldItem,Me,PosMsg,Stage,WorldSnapshot } from "./types";
import { STATIONS,COLS,ROWS,TILE,buildSolidGrid } from "./layout";
import { ITEM_LABEL, COOK_DURATIONS } from "./recipes";

export interface EngineHooks{
 me:Me;isHost:boolean;getWorld:()=>WorldSnapshot;getStage:()=>Stage;
 outfits:Record<Me,{outfit:string;hair:string}>;
 sendPos:(p:PosMsg)=>void;onPos:(cb:(p:PosMsg,from:Me)=>void)=>()=>void;
 sendAct:(a:ActMsg)=>void;onAct:(cb:(a:ActMsg,from:Me)=>void)=>()=>void;
 applyHostAction:(stationId:string,held:HeldItem,from?:Me)=>{world:WorldSnapshot;held:HeldItem}|null;
 onWorldChanged:(w:WorldSnapshot)=>void;onHeldChanged:(h:HeldItem)=>void;onStationFocus:(id:string|null)=>void;
}
export interface EngineHandle{
 destroy:()=>void;setJoystick:(x:number,y:number)=>void;pressAction:()=>void;pressThrow:()=>void;showBubble:(who:Me,text:string)=>void;
}

const C={
 floor:0xead9b8,floor2:0xe1cda7,wall:0x46363a,wood:0x9b603e,metal:0x69737b,
 green:0x3f9b6f,cream:0xfff2d2,ink:0x30282b,accent:0xffc85b,red:0xe45b55,
 blue:0x5ba8d8,pink:0xe981ad,shadow:0x231b20
};
const itemColor=(i:string)=>{
 if(i.includes("carne"))return 0xb9474f;
 if(i.includes("tomate"))return 0xe04d46;
 if(i==="queijo")return 0xf5cf52;
 if(i.includes("pao"))return 0xd6944e;
 if(i.includes("massa"))return 0xf0d08a;
 if(i==="molho")return 0x9e3f39;
 if(i==="fruta")return 0xe86662;
 if(i==="cobertura")return 0xf09bb4;
 return 0xd8d8d8;
};

type ChefView=Phaser.GameObjects.Container&{parts?:any};

export async function createCozinhaGame(container:HTMLElement,hooks:EngineHooks):Promise<EngineHandle>{
 const remote:Record<Me,ChefView|null>={gu:null,li:null};
 const last:Record<Me,PosMsg|undefined>={gu:undefined,li:undefined};
 const joy={x:0,y:0};let act=false,thr=false,seq=0;
 const solid=buildSolidGrid();

 class Scene extends Phaser.Scene{
  player!:ChefView;
  focusRing!:Phaser.GameObjects.Graphics;
  heldLabel!:Phaser.GameObjects.Text;
  stationLabel!:Phaser.GameObjects.Text;
  fpsLabel!:Phaser.GameObjects.Text;
  keys!:any;
  vx=0;vy=0;facing:PosMsg["facing"]="down";nearest:string|null=null;lastSend=0;lastHeld:HeldItem=null;
  pulse=0;
  rushSteam:Phaser.GameObjects.Graphics[]=[];
  rushActive=false;
  lastScore=0;
  lastStreak=0;

  constructor(){super("kitchen");}

  create(){
   this.drawBackdrop();
   this.drawFloor();
   this.drawStations();
   this.player=this.chef(hooks.me,hooks.outfits[hooks.me]);
   this.add.existing(this.player);
   this.player.setPosition(hooks.me==="gu"?6.2*TILE:9.8*TILE,7.45*TILE);
   this.lastScore=hooks.getWorld().score;
   this.lastStreak=hooks.getWorld().streak;
   this.focusRing=this.add.graphics().setDepth(7);
   this.heldLabel=this.add.text(0,0,"",{fontFamily:"Arial",fontSize:"11px",fontStyle:"bold",color:"#ffffff",backgroundColor:"#292229ee",padding:{x:7,y:4}})
    .setOrigin(.5).setDepth(120);
   this.stationLabel=this.add.text(0,0,"",{fontFamily:"Arial",fontSize:"10px",fontStyle:"bold",color:"#fff4d8",backgroundColor:"#33272ddd",padding:{x:7,y:4}})
    .setOrigin(.5).setDepth(120).setVisible(false);
   this.fpsLabel=this.add.text(12,ROWS*TILE-24,"",{fontFamily:"Arial",fontSize:"10px",color:"#ffffffaa"}).setScrollFactor(0).setDepth(200).setVisible(false);
   this.keys=this.input.keyboard?.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,Q");
   this.cameras.main.setBackgroundColor("#171318");
   this.cameras.main.centerOn(COLS*TILE/2,ROWS*TILE/2);
   this.cameras.main.postFX.addVignette(0.5,0.48,0.78,0.16);
   this.fitCamera();
   this.scale.on("resize",()=>this.fitCamera());
  }

  fitCamera(){
   const w=this.scale.width,h=this.scale.height;
   const zx=w/(COLS*TILE),zy=h/(ROWS*TILE);
   this.cameras.main.setZoom(Math.min(zx,zy)*0.98);
   this.cameras.main.centerOn(COLS*TILE/2,ROWS*TILE/2);
  }

  drawBackdrop(){
   const g=this.add.graphics();
   g.fillStyle(0x171318).fillRect(0,0,COLS*TILE,ROWS*TILE);
   g.fillStyle(0x2a2027).fillRect(0,0,COLS*TILE,TILE);
   g.fillStyle(0x211a20).fillRect(0,(ROWS-1)*TILE,COLS*TILE,TILE);
   g.fillStyle(0x0d0b0e,.8).fillRect(TILE,TILE,(COLS-2)*TILE,10);

   for(let i=0;i<11;i++){
    const x=26+i*84;
    g.fillStyle(i%2?0x46343d:0x523b45).fillRoundedRect(x,13,66,29,7);
    g.lineStyle(2,0x73535f,.65).strokeRoundedRect(x,13,66,29,7);
    g.fillStyle(i%3===0?0xffd36e:i%3===1?0x7dd0e8:0xf59ac2).fillCircle(x+9,27,2.5);
    g.fillStyle(0xffffff,.08).fillRoundedRect(x+18,19,39,4,2);
   }

   const shelf=this.add.graphics().setDepth(2);
   shelf.fillStyle(0x5d3b2e).fillRoundedRect(24,54,COLS*TILE-48,13,5);
   shelf.fillStyle(0x2c2022).fillRect(31,67,COLS*TILE-62,5);
   for(let i=0;i<12;i++){
    const x=48+i*77;
    shelf.fillStyle([0x8fd1e0,0xffd36e,0xf59ac2,0x9ed6a3][i%4],.85).fillCircle(x,49,7);
    shelf.fillStyle(0xffffff,.25).fillCircle(x-2,47,2);
   }

   const sign=this.add.container(COLS*TILE-165,16).setDepth(5);
   const plate=this.add.graphics();
   plate.fillStyle(0x171318,.9).fillRoundedRect(0,0,135,31,9);
   plate.lineStyle(2,0xffd36e,.45).strokeRoundedRect(0,0,135,31,9);
   sign.add(plate);
   sign.add(this.add.text(68,8,"SERVICE", {fontFamily:"Arial",fontSize:"9px",fontStyle:"bold",color:"#fff2d2",letterSpacing:2}).setOrigin(.5));
   sign.postFX.addBloom(0xffd36e,1,1,.35,.12,2);

   this.add.text(22,19,"KITCHEN // SERVICE",{
    fontFamily:"Arial",fontSize:"11px",fontStyle:"bold",color:"#fff2d2",letterSpacing:2
   }).setDepth(6);
  }

  drawFloor(){
   const g=this.add.graphics();
   g.fillStyle(0xdcc7a0).fillRect(TILE,TILE,(COLS-2)*TILE,(ROWS-2)*TILE);
   for(let y=1;y<ROWS-1;y++){
    for(let x=1;x<COLS-1;x++){
     const alt=(x+y)%2===0;
     g.fillStyle(alt?0xe8d7b5:0xd6bd92,.72).fillRect(x*TILE+2,y*TILE+2,TILE-4,TILE-4);
     g.lineStyle(1,0x8c6b4e,.18).strokeRect(x*TILE,y*TILE,TILE,TILE);
     if((x*7+y*13)%9===0){
      g.fillStyle(0xffffff,.13).fillCircle(x*TILE+14,y*TILE+18,2);
      g.fillStyle(0x7f5d43,.09).fillCircle(x*TILE+36,y*TILE+35,2);
     }
    }
   }
   g.fillStyle(0x7e563e,.22).fillRect(TILE,TILE,(COLS-2)*TILE,7);
   g.fillStyle(0x7e563e,.15).fillRect(TILE,(ROWS-1)*TILE-10,(COLS-2)*TILE,10);
   g.lineStyle(5,0x6e4938,.42).strokeRect(TILE+3,TILE+3,(COLS-2)*TILE-6,(ROWS-2)*TILE-6);

   const runner=this.add.graphics().setDepth(1);
   runner.fillStyle(0x8d6a49,.13).fillRoundedRect(6*TILE,6*TILE,6*TILE,2*TILE,18);
   runner.lineStyle(2,0xffffff,.08).strokeRoundedRect(6*TILE+2,6*TILE+2,6*TILE-4,2*TILE-4,16);
  }

  stationBox(x:number,y:number,w:number,h:number,color:number){
   const g=this.add.graphics();
   g.fillStyle(C.shadow,.22).fillRoundedRect(x-w/2+5,y-h/2+7,w,h,9);
   g.fillStyle(0x2d2528,.25).fillRoundedRect(x-w/2-2,y-h/2-2,w+4,h+4,10);
   g.fillStyle(color).fillRoundedRect(x-w/2,y-h/2,w,h,8);
   g.fillStyle(0xffffff,.12).fillRoundedRect(x-w/2+5,y-h/2+4,w-10,7,4);
   g.lineStyle(2,0x2c2428,.82).strokeRoundedRect(x-w/2,y-h/2,w,h,8);
   g.lineStyle(1,0xffffff,.22).strokeRoundedRect(x-w/2+3,y-h/2+3,w-6,h-6,6);
   return g;
  }

  drawStations(){
   for(const s of STATIONS){
    if(s.type==="parede")continue;
    const x=(s.x+.5)*TILE,y=(s.y+.5)*TILE;
    let color=C.wood;
    if(s.type==="geladeira")color=C.blue;
    if(s.type==="tabua")color=0xc38a50;
    if(s.type==="fogao"||s.type==="forno")color=C.metal;
    if(s.type==="montagem")color=0xd9a951;
    if(s.type==="entrega")color=C.green;
    if(s.type==="lixeira")color=0x596268;
    if(s.type==="liquidificador")color=0x8d75b7;
    const box=this.stationBox(x,y,TILE-8,TILE-10,color);
    if(s.type==="fogao"||s.type==="forno"||s.type==="entrega") box.postFX.addGlow(s.type==="entrega"?0x8ff0bf:0xffb65b,2,1,false,.45,5);
    const g=this.add.graphics();
    if(s.type==="geladeira"){
     g.fillStyle(0xd9f2fa,.8).fillRoundedRect(x-16,y-13,32,27,5);
     g.lineStyle(2,0x487d91,.8).strokeRoundedRect(x-16,y-13,32,27,5);
     g.fillStyle(itemColor(s.ingredient??"")).fillCircle(x,y+3,7);
     g.lineStyle(2,0xffffff,.55).lineBetween(x-10,y-3,x+10,y-3);
    }else if(s.type==="tabua"){
     g.fillStyle(0x6f432b).fillRoundedRect(x-17,y-9,34,18,4);
     g.fillStyle(0xb9824d).fillCircle(x-9,y-3,2);g.fillCircle(x+5,y+4,2);
    }else if(s.type==="fogao"){
     g.fillStyle(0x20252a).fillCircle(x,y,15);
     g.lineStyle(3,0x9ca8ad,.7).strokeCircle(x,y,14);
     g.lineStyle(2,0x40484e,.9).strokeCircle(x,y,7);
    }else if(s.type==="forno"){
     g.fillStyle(0x1e2225).fillRoundedRect(x-17,y-14,34,28,5);
     g.fillStyle(0x39434a).fillRoundedRect(x-11,y-8,22,13,3);
     g.fillStyle(0xffbd5a,.85).fillCircle(x,y-1,3);
    }else if(s.type==="montagem"){
     g.fillStyle(0xfff0c7).fillRoundedRect(x-18,y-11,36,22,4);
     g.lineStyle(2,0xa57a38,.5).strokeRoundedRect(x-18,y-11,36,22,4);
     g.fillStyle(0xf1d37c).fillCircle(x,y,7);
    }else if(s.type==="entrega"){
     g.fillStyle(0xb8efd3,.2).fillRoundedRect(x-19,y-13,38,26,6);
     g.lineStyle(3,0xd8ffea,.85).strokeRoundedRect(x-19,y-13,38,26,6);
     g.fillStyle(0xd8ffea,.8).fillCircle(x,y,7);
    }else if(s.type==="liquidificador"){
     g.fillStyle(0xe6d9ff,.85).fillRoundedRect(x-12,y-4,24,14,4);
     g.fillStyle(0xc4b1e8,.9).fillRoundedRect(x-8,y-15,16,13,4);
     g.lineStyle(2,0x5b4b76,.7).strokeRoundedRect(x-8,y-15,16,13,4);
    }else if(s.type==="lixeira"){
     g.fillStyle(0x2e3438).fillRoundedRect(x-13,y-10,26,21,4);
     g.fillStyle(0x889197).fillRect(x-16,y-14,32,4);
    }else if(s.type==="balcao"){
     g.fillStyle(0xe7bd83).fillRoundedRect(x-17,y-10,34,20,5);
     g.fillStyle(0xf7dfae,.8).fillRoundedRect(x-13,y-6,26,4,2);
    }
    this.add.text(x,y+22,s.label??"",{
     fontFamily:"Arial",fontSize:"7px",fontStyle:"bold",color:"#2e2528",stroke:"#f4dfb7",strokeThickness:2
    }).setOrigin(.5).setDepth(3);

    if(s.type==="fogao"||s.type==="forno"){
      const flame=this.add.circle(x,y-20,3,0xffc45b,.55).setDepth(4);
      this.tweens.add({targets:flame,scale:{from:0.7,to:1.25},alpha:{from:.3,to:.8},duration:520,yoyo:true,repeat:-1,ease:"Sine.easeInOut",delay:(s.x+s.y)*70});
    }
   }
  }

  chef(me:Me,m:{outfit:string;hair:string}):ChefView{
   const c=this.add.container(0,0) as ChefView;
   const outfit=Number(m.outfit)||0xf59ac2;
   const hair=Number(m.hair)||0x3b2318;
   const shadow=this.add.ellipse(0,20,32,11,C.shadow,.28);
   const legL=this.add.rectangle(-6,18,8,22,0x33343a).setAngle(-3);
   const legR=this.add.rectangle(6,18,8,22,0x33343a).setAngle(3);
   const body=this.add.rectangle(0,2,28,27,outfit).setStrokeStyle(2,0x392c31,.9);
   const apron=this.add.rectangle(0,7,18,18,0xfff0d4,.85).setStrokeStyle(1,0x8f7160,.6);
   const armL=this.add.rectangle(-17,5,8,20,outfit).setAngle(10);
   const armR=this.add.rectangle(17,5,8,20,outfit).setAngle(-10);
   const head=this.add.circle(0,-16,14,0xf1c5a6).setStrokeStyle(2,0x392c31,.9);
   const hairShape=this.add.arc(0,-20,24,0,Math.PI,true,hair,1);
   const hat=this.add.ellipse(0,-29,28,11,0xffffff).setStrokeStyle(2,0x6d6264,.8);
   const hatTop=this.add.rectangle(0,-35,17,9,0xffffff).setStrokeStyle(1,0x6d6264,.6);
   c.add([shadow,legL,legR,body,apron,armL,armR,head,hairShape,hat,hatTop]);
   c.add([this.add.circle(-5,-17,1.8,0x29252a),this.add.circle(5,-17,1.8,0x29252a)]);
   const badge=this.add.circle(0,3,4,me==="gu"?C.pink:C.blue).setStrokeStyle(1,0xffffff,.6);
   c.add(badge);
   const item=this.add.container(0,-39).setDepth(5);item.setVisible(false);c.add(item);
   c.parts={body,head,hat,armL,armR,legL,legR,item,shadow};
   return c;
  }

  blocked(x:number,y:number){
   const world=hooks.getWorld();
   const rush=world.timeLeft<90000;
   if(rush){
    const steamY=5.9*TILE;
    if(Math.abs(y-steamY)<30 && x>11*TILE && x<16*TILE) return true;
   }
   const gx=Math.floor(x/TILE),gy=Math.floor(y/TILE);
   if(gx<1||gy<1||gx>=COLS-1||gy>=ROWS-1)return true;
   for(const [dx,dy] of [[0,0],[11,0],[-11,0],[0,11],[0,-11]])if(solid[Math.floor((y+dy)/TILE)]?.[Math.floor((x+dx)/TILE)])return true;
   return false;
  }

  move(dt:number){
   let x=0,y=0;
   if(this.keys?.W.isDown||this.keys?.UP.isDown)y--;
   if(this.keys?.S.isDown||this.keys?.DOWN.isDown)y++;
   if(this.keys?.A.isDown||this.keys?.LEFT.isDown)x--;
   if(this.keys?.D.isDown||this.keys?.RIGHT.isDown)x++;
   x+=joy.x;y+=joy.y;
   const len=Math.hypot(x,y);
   if(len>1){x/=len;y/=len;}
   const rush=hooks.getWorld().timeLeft<90000;
   const targetSpeed=rush && this.player.y>5.2*TILE && this.player.y<6.6*TILE ? 188 : 235;
   const targetX=x*targetSpeed,targetY=y*targetSpeed;
   const t=Math.min(1,dt/1000*16);
   this.vx=Phaser.Math.Linear(this.vx,targetX,t);
   this.vy=Phaser.Math.Linear(this.vy,targetY,t);
   if(len<.08){
    const stop=Math.pow(.001,dt/1000);
    this.vx*=stop;this.vy*=stop;
   }
   const nx=this.player.x+this.vx*dt/1000;
   const ny=this.player.y+this.vy*dt/1000;
   if(!this.blocked(nx,this.player.y))this.player.x=nx;else this.vx=0;
   if(!this.blocked(this.player.x,ny))this.player.y=ny;else this.vy=0;
   if(Math.abs(this.vx)>8||Math.abs(this.vy)>8){
    this.facing=Math.abs(this.vx)>Math.abs(this.vy)?(this.vx>0?"right":"left"):(this.vy>0?"down":"up");
   }
  }

  nearestStation(){
   let best:string|null=null,bd=78;
   for(const s of STATIONS){
    if(s.type==="parede")continue;
    const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,(s.x+.5)*TILE,(s.y+.5)*TILE);
    if(d<bd){bd=d;best=s.id;}
   }
   if(best!==this.nearest){
    this.nearest=best;
    hooks.onStationFocus(best);
   }
  }

  directionTarget(){
   const fx=this.facing==="right"?1:this.facing==="left"?-1:0;
   const fy=this.facing==="down"?1:this.facing==="up"?-1:0;
   let best:string|null=null,bestScore=Infinity;
   for(const s of STATIONS){
    if(s.type==="parede")continue;
    const sx=(s.x+.5)*TILE,sy=(s.y+.5)*TILE;
    const dx=sx-this.player.x,dy=sy-this.player.y;
    const forward=dx*fx+dy*fy;
    if(forward<30)continue;
    const side=Math.abs(dx*fy-dy*fx);
    const score=side+forward*.18;
    if(score<bestScore&&forward<260){bestScore=score;best=s.id;}
   }
   return best;
  }

  action(){
   this.nearestStation();
   if(!this.nearest)return;
   const held=hooks.getWorld().heldBy[hooks.me];
   if(hooks.isHost){
    const result=hooks.applyHostAction(this.nearest,held,hooks.me);
    if(result)hooks.onHeldChanged(result.held);
   }else{
    hooks.sendAct({seq:++seq,stationId:this.nearest,held,kind:"interact"});
   }
   this.flashAction(this.nearest);
  }

  throwItem(){
   const held=hooks.getWorld().heldBy[hooks.me];
   if(!held)return;
   const target=this.directionTarget();
   if(!target)return;
   const station=STATIONS.find(s=>s.id===target);
   if(!station)return;
   const tx=(station.x+.5)*TILE,ty=(station.y+.5)*TILE;
   const item=this.makeHeldVisual(held);
   item.setPosition(this.player.x,this.player.y-36);item.setDepth(130);
   this.add.existing(item);
   this.tweens.add({targets:item,x:tx,y:ty,duration:190,ease:"Quad.easeOut",onComplete:()=>{
    item.destroy();
   }});
   if(hooks.isHost){
    const result=hooks.applyHostAction(target,held,hooks.me);
    if(result)hooks.onHeldChanged(result.held);
   }else{
    hooks.sendAct({seq:++seq,stationId:target,held,kind:"throw"});
   }
  }

  makeHeldVisual(item:HeldItem){
   const c=this.add.container(0,0);
   if(!item)return c;
   const shadow=this.add.ellipse(1,8,24,7,0x20191b,.22);
   c.add(shadow);

   const addPlate=(fill=0xfff4dd)=>{
    c.add(this.add.ellipse(0,3,30,10,0x6d5a52,.22));
    c.add(this.add.ellipse(0,1,27,9,fill,.96).setStrokeStyle(1.5,0x5a4640,.7));
   };
   const addBun=(y:number)=>{
    c.add(this.add.ellipse(0,y,26,12,0xd89a4b).setStrokeStyle(1.5,0x74462a,.75));
    c.add(this.add.ellipse(0,y-2,22,7,0xf1c36c,.7));
    for(const sx of [-7,0,7]) c.add(this.add.ellipse(sx,y-4,2.5,1.2,0xffefbf,.8));
   };

   if(item==="pao"){
    addBun(0);
   }else if(item==="carne"||item==="carne_cozida"){
    c.add(this.add.rectangle(0,0,22,13,item==="carne_cozida"?0x6f3928:0x9d4d3e).setStrokeStyle(1.5,0x542b27,.8));
    c.add(this.add.rectangle(0,-3,16,2,0xd47a5d,.35));
    c.add(this.add.rectangle(0,3,17,2,0x4a2926,.35));
   }else if(item==="queijo"){
    c.add(this.add.rectangle(0,1,25,15,0xf6c94f).setStrokeStyle(1.5,0x8b6723,.7));
    c.add(this.add.circle(-6,-1,2,0xffe98a,.8));c.add(this.add.circle(5,4,1.6,0xe9ae31,.75));
   }else if(item==="tomate"||item==="tomate_cortado"){
    if(item==="tomate"){
     c.add(this.add.circle(0,0,11,0xd94b45).setStrokeStyle(1.5,0x7d2d2e,.8));
     c.add(this.add.circle(-3,-3,3,0xf47b66,.45));c.add(this.add.circle(0,-10,3,0x4f8e50));
    }else{
     c.add(this.add.circle(-5,0,6,0xe65c4e).setStrokeStyle(1,0x8b302d,.7));
     c.add(this.add.circle(5,0,6,0xe65c4e).setStrokeStyle(1,0x8b302d,.7));
     c.add(this.add.circle(0,-4,1.5,0xffd7a1,.8));
    }
   }else if(item==="massa"||item==="pizza_crua"){
    addPlate();
    c.add(this.add.ellipse(0,-1,23,14,0xd9a56a).setStrokeStyle(1.2,0x795033,.7));
    if(item==="pizza_crua"){
     c.add(this.add.ellipse(0,-1,20,11,0xf4d17d,.9));
     for(const [x,y] of [[-6,-2],[2,1],[7,-3]]) c.add(this.add.circle(x,y,2,0xb94a3d,.9));
    }
   }else if(item==="molho"){
    c.add(this.add.ellipse(0,2,22,13,0xc9493e).setStrokeStyle(1.5,0x702b29,.8));
    c.add(this.add.ellipse(-4,-1,8,3,0xf17b61,.35));
   }else if(item==="fruta"){
    c.add(this.add.circle(0,1,10,0xf0b84f).setStrokeStyle(1.5,0x80572b,.75));
    c.add(this.add.arc(2,-7,7,-2.7,-.6,false,0x69a653,1.2));
    c.add(this.add.circle(-3,-2,2.5,0xffdf80,.5));
   }else if(item==="massa_cupcake"||item==="cupcake_assado"){
    c.add(this.add.rectangle(0,4,17,11,item==="cupcake_assado"?0xb96d42:0xe5bd74).setStrokeStyle(1.2,0x704331,.7));
    c.add(this.add.ellipse(0,-3,19,13,item==="cupcake_assado"?0xc98150:0xe9c988).setStrokeStyle(1.2,0x704331,.7));
    if(item==="cupcake_assado")c.add(this.add.circle(0,-7,5,0xf0d6b0,.8));
   }else if(item==="cobertura"){
    c.add(this.add.circle(0,1,10,0xf3a0c5).setStrokeStyle(1.2,0x8c4967,.7));
    c.add(this.add.circle(-3,-3,3,0xffd3e2,.45));
   }else if(item==="hamburguer"||item==="sanduiche"){
    addPlate();addBun(-6);
    c.add(this.add.rectangle(0,1,22,5,0x6f3a29).setStrokeStyle(1,0x4d2a24,.7));
    c.add(this.add.rectangle(0,5,23,3,0xf5cf4d));
    c.add(this.add.ellipse(0,9,25,7,0x78a852).setStrokeStyle(1,0x4d7039,.6));
    if(item==="sanduiche")c.add(this.add.rectangle(0,-1,21,3,0xe5c9a2));
   }else if(item==="pizza"){
    addPlate();c.add(this.add.ellipse(0,-1,25,16,0xd89b50).setStrokeStyle(1.3,0x75472d,.7));
    c.add(this.add.ellipse(0,-2,21,12,0xe4d16f));
    c.add(this.add.arc(0,-2,17,0,Math.PI*2,false,0xc94c3f,.95));
    for(const [x,y] of [[-6,-3],[2,1],[7,-4],[-1,-5]])c.add(this.add.circle(x,y,2,0xd95a42));
   }else if(item==="cupcake"){
    addPlate();c.add(this.add.rectangle(0,5,16,10,0xb66a42).setStrokeStyle(1,0x704331,.7));
    c.add(this.add.circle(0,-3,10,0xf2d4df).setStrokeStyle(1,0x8c536d,.6));
    c.add(this.add.circle(-5,-4,5,0xf7dbe5,.8));c.add(this.add.circle(5,-4,5,0xe99fc0,.75));
   }else if(item==="suco"){
    c.add(this.add.rectangle(0,2,17,19,0xf0a84e).setStrokeStyle(1.5,0x794c28,.7));
    c.add(this.add.rectangle(0,-2,13,10,0xffcf70,.5));
    c.add(this.add.rectangle(6,-10,3,11,0xf4f1e5).setAngle(18));
   }else if(item==="queimado"){
    c.add(this.add.circle(0,1,10,0x29252a).setStrokeStyle(1.5,0x151316,.9));
    c.add(this.add.circle(-3,-3,2,0x6e4938,.7));
   }else{
    c.add(this.add.circle(0,0,9,itemColor(item)).setStrokeStyle(1.5,0x2d2529,.85));
   }
   return c;
  }

  flashAction(stationId:string){
   const s=STATIONS.find(v=>v.id===stationId);if(!s)return;
   const x=(s.x+.5)*TILE,y=(s.y+.5)*TILE;
   const ring=this.add.circle(x,y,22,0xffffff,0).setStrokeStyle(3,C.accent,.9).setDepth(110);
   this.tweens.add({targets:ring,scale:1.45,alpha:0,duration:240,onComplete:()=>ring.destroy()});
  }

  updateChef(view:ChefView,speed:number,dt:number){
   const p=view.parts;if(!p)return;
   this.pulse+=dt;
   const moving=speed>18;
   const swing=moving?Math.sin(this.pulse*.018)*.55:Math.sin(this.pulse*.004)*.04;
   p.legL.angle=-swing*18;p.legR.angle=swing*18;
   p.armL.angle=10+swing*10;p.armR.angle=-10-swing*10;
   p.body.y=2+(moving?Math.abs(Math.sin(this.pulse*.018))*1.2:0);
   p.hat.y=-29+(moving?Math.abs(Math.sin(this.pulse*.018))*.8:0);
   view.setDepth(Math.floor(view.y));
  }

  updateHeldVisual(view:ChefView,held:HeldItem){
   const item=view.parts?.item;if(!item)return;
   item.removeAll(true);
   if(!held){item.setVisible(false);return;}
   item.add(this.makeHeldVisual(held));
   item.setVisible(true);
  }

  scoreFeedback(delta:number,streak:number){
   const text=streak>1?`+${delta}  •  COMBO x${streak}`:`+${delta}`;
   const t=this.add.text(this.player.x,this.player.y-78,text,{fontFamily:"Arial",fontSize:streak>1?"14px":"13px",fontStyle:"bold",color:streak>1?"#ffe08a":"#ffffff",stroke:"#2a2025",strokeThickness:5,shadow:{offsetX:0,offsetY:2,color:"#000000",blur:5,fill:true}}).setOrigin(.5).setDepth(180);
   this.tweens.add({targets:t,y:t.y-30,alpha:0,scale:1.12,duration:720,ease:"Cubic.easeOut",onComplete:()=>t.destroy()});
  }

  updateProcessFx(){
   for(const g of this.processFx)g.destroy();
   this.processFx=[];
   const world=hooks.getWorld();
   for(const s of STATIONS){
    if(!["fogao","forno","liquidificador"].includes(s.type))continue;
    const p=world.stations[s.id]?.process;
    if(!p?.itemIn||!p.startedAt)continue;
    const d=COOK_DURATIONS[p.itemIn];
    if(!d)continue;
    const elapsed=Math.max(0,Date.now()-p.startedAt);
    const ratio=Math.min(1,elapsed/d.ready);
    const x=(s.x+.5)*TILE,y=(s.y+.5)*TILE;
    const g=this.add.graphics().setDepth(115);
    g.lineStyle(5,0x241d20,.42).strokeCircle(x,y-25,10);
    g.lineStyle(5,p.burnt?0xe24f45:p.ready?0x65d99b:0xffc85b,.95);
    g.beginPath();g.arc(x,y-25,10,-Math.PI/2,-Math.PI/2+Math.PI*2*ratio,false);g.strokePath();
    if(p.ready&&!p.burnt){
      g.fillStyle(0x65d99b,.18).fillCircle(x,y-25,7);
    }
    this.processFx.push(g);
   }
  }

  updateFocus(){
   this.focusRing.clear();
   if(!this.nearest){this.stationLabel.setVisible(false);return;}
   const s=STATIONS.find(v=>v.id===this.nearest);if(!s)return;
   const x=(s.x+.5)*TILE,y=(s.y+.5)*TILE;
   this.focusRing.lineStyle(5,0x1c1518,.22).strokeRoundedRect(x-27,y-27,54,54,12);
   this.focusRing.lineStyle(3,C.accent,.92).strokeRoundedRect(x-24,y-24,48,48,10);
   this.focusRing.fillStyle(C.accent,.045).fillRoundedRect(x-22,y-22,44,44,9);
   this.stationLabel.setPosition(x,y-38).setText(s.label??"AÇÃO").setVisible(true);
  }

  update(_time:number,dt:number){
   if(hooks.getStage()!=="jogando")return;
   const rush=hooks.getWorld().timeLeft<90000;
   if(rush!==this.rushActive){
    this.rushActive=rush;
    if(rush){
     for(let i=0;i<7;i++){
      const steam=this.add.graphics().setDepth(95);
      steam.fillStyle(0xffffff,.16).fillCircle(0,0,5);
      steam.setPosition((12+i*.58)*TILE,6.35*TILE);
      this.rushSteam.push(steam);
     }
    }else{
     this.rushSteam.forEach(v=>v.destroy());
     this.rushSteam=[];
    }
   }
   if(rush){
    this.rushSteam.forEach((steam,i)=>{
     steam.y=6.35*TILE-Math.sin(this.pulse*.003+i)*8-(this.pulse*.018+i*0.7)%26;
     steam.alpha=.08+.1*Math.sin(this.pulse*.006+i);
    });
   }
   this.move(dt);
   this.nearestStation();
   if(Phaser.Input.Keyboard.JustDown(this.keys?.Q))thr=true;
   if(act){act=false;this.action();}
   if(thr){thr=false;this.throwItem();}

   const held=hooks.getWorld().heldBy[hooks.me];
   if(held!==this.lastHeld){this.lastHeld=held;hooks.onHeldChanged(held);}
   this.updateHeldVisual(this.player,held);
   this.updateProcessFx();
   const world=hooks.getWorld();
   if(world.score>this.lastScore){this.scoreFeedback(world.score-this.lastScore,world.streak);this.lastScore=world.score;this.lastStreak=world.streak;}
   this.updateChef(this.player,Math.hypot(this.vx,this.vy),dt);
   this.updateFocus();

   this.heldLabel.setPosition(this.player.x,this.player.y-54).setText(held?ITEM_LABEL[held]??held:"");
   this.heldLabel.setVisible(Boolean(held));

   if(Date.now()-this.lastSend>55){
    this.lastSend=Date.now();
    hooks.sendPos({x:this.player.x,y:this.player.y,facing:this.facing,holding:held,t:Date.now()});
   }

   for(const m of ["gu","li"] as Me[]){
    if(m===hooks.me)continue;
    const p=last[m];if(!p)continue;
    if(!remote[m]){
     remote[m]=this.chef(m,hooks.outfits[m]);
     this.add.existing(remote[m]!);
    }
    const r=remote[m]!;
    r.x=Phaser.Math.Linear(r.x,p.x,.32);
    r.y=Phaser.Math.Linear(r.y,p.y,.32);
    this.updateChef(r,Math.hypot(p.x-r.x,p.y-r.y)*8,dt);
    this.updateHeldVisual(r,p.holding);
   }
   if(this.fpsLabel.visible)this.fpsLabel.setText(`FPS ${Math.round(this.game.loop.actualFps||0)}`);
  }

  showBubble(_who:Me,_text:string){}
 }

 const game=new Phaser.Game({
  type:Phaser.WEBGL,parent:container,width:container.clientWidth,height:container.clientHeight,
  backgroundColor:"#211b20",
  render:{antialias:true,powerPreference:"high-performance"},
  scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},
  scene:[Scene],fps:{target:60,min:30}
 });
 const unsub=hooks.onPos((p,from)=>{last[from]=p;});
 const unsubAct=hooks.onAct((a,from)=>{
  if(!hooks.isHost)return;
  if(a.stationId)hooks.applyHostAction(a.stationId,a.held,from);
 });
 return{
  destroy:()=>{unsub();unsubAct();game.destroy(true);},
  setJoystick:(x,y)=>{joy.x=x;joy.y=y;},
  pressAction:()=>{act=true;},
  pressThrow:()=>{thr=true;},
  showBubble:()=>{}
 };
}