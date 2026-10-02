import Phaser from "phaser";
import type {ActMsg,HeldItem,Me,PosMsg,Stage,WorldSnapshot} from "./types";
import {STATIONS,COLS,ROWS,TILE,buildSolidGrid} from "./layout";
import {ITEM_LABEL} from "./recipes";

export interface EngineHooks{
 me:Me;isHost:boolean;getWorld:()=>WorldSnapshot;getStage:()=>Stage;
 outfits:Record<Me,{outfit:string;hair:string}>;
 sendPos:(p:PosMsg)=>void;onPos:(cb:(p:PosMsg,from:Me)=>void)=>()=>void;
 sendAct:(a:ActMsg)=>void;onAct:(cb:(a:ActMsg,from:Me)=>void)=>()=>void;
 applyHostAction:(stationId:string,held:HeldItem,from?:Me)=>{world:WorldSnapshot;held:HeldItem}|null;
 onWorldChanged:(w:WorldSnapshot)=>void;onHeldChanged:(h:HeldItem)=>void;onStationFocus:(id:string|null)=>void;
}
export interface EngineHandle{destroy:()=>void;setJoystick:(x:number,y:number)=>void;pressAction:()=>void;pressThrow:()=>void;showBubble:(who:Me,text:string)=>void;}

const colors:Record<string,number>={parede:0x744b3e,balcao:0xb46d43,geladeira:0x75aeb9,tabua:0xd4a05d,fogao:0x70777c,forno:0xb96657,liquidificador:0x8e7eb2,montagem:0xe5c883,entrega:0x4f9a68,lixeira:0x5f686d};
const itemColor=(i:string)=>i.includes("carne")?0xb94e50:i.includes("tomate")?0xd84f45:i==="queijo"?0xf0c84f:i.includes("pao")?0xd99a49:i.includes("massa")?0xe8c776:i==="molho"?0x9f403c:i.includes("fruta")?0xe66d5d:i==="cobertura"?0xf0a5ba:0xd8d8d8;

export async function createCozinhaGame(container:HTMLElement,hooks:EngineHooks):Promise<EngineHandle>{
 const remote:Record<Me,Phaser.GameObjects.Container|null>={gu:null,li:null};
 const last:Record<Me,PosMsg|undefined>={gu:undefined,li:undefined};
 const joy={x:0,y:0};let act=false,thr=false,seq=0;
 const solid=buildSolidGrid();

 class Scene extends Phaser.Scene{
  player!:Phaser.GameObjects.Container; shadow!:Phaser.GameObjects.Ellipse; heldText!:Phaser.GameObjects.Text;
  vx=0;vy=0;facing:PosMsg["facing"]="down";nearest:string|null=null;lastSend=0;keys!:any;
  constructor(){super("kitchen");}
  create(){
   this.drawFloor();this.drawStations();
   this.player=this.chef(hooks.me,hooks.outfits[hooks.me]);this.add.existing(this.player);
   this.player.setPosition(hooks.me==="gu"?6.5*TILE:9.5*TILE,7.2*TILE);
   this.shadow=this.add.ellipse(this.player.x,this.player.y+20,30,10,0x000000,.2).setDepth(9);
   this.heldText=this.add.text(this.player.x,this.player.y-43,"",{fontFamily:"Arial",fontSize:"10px",fontStyle:"bold",color:"#fff",backgroundColor:"#252126dd",padding:{x:5,y:3}}).setOrigin(.5).setDepth(90);
   this.keys=this.input.keyboard?.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,Q");
   this.cameras.main.centerOn(COLS*TILE/2,ROWS*TILE/2);
  }
  drawFloor(){const g=this.add.graphics();g.fillStyle(0xd8b26b).fillRect(TILE,TILE,(COLS-2)*TILE,(ROWS-2)*TILE);for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++){if((x+y)%2===0)g.fillStyle(0xe7c67f,.3).fillRect(x*TILE,y*TILE,TILE,TILE);g.lineStyle(1,0x7d603e,.12).strokeRect(x*TILE,y*TILE,TILE,TILE);}}
  drawStations(){for(const s of STATIONS){const c=this.add.container((s.x+.5)*TILE,(s.y+.5)*TILE).setDepth(20+s.y);const body=this.add.rectangle(0,2,TILE-5,TILE-7,colors[s.type]??0x777777).setStrokeStyle(2,0x4b3530,.7);c.add(body);if(s.type!=="parede")c.add(this.add.rectangle(0,-15,TILE-11,12,0xf3dfbb,.9));if(s.type==="geladeira")c.add(this.add.circle(0,-3,7,itemColor(s.ingredient??"")));if(s.type==="fogao")c.add(this.add.circle(0,-1,13,0x292d31));if(s.type==="forno")c.add(this.add.rectangle(0,0,28,20,0x33383c));if(s.type==="tabua")c.add(this.add.rectangle(0,0,34,18,0x895832));if(s.type==="montagem")c.add(this.add.rectangle(0,0,36,22,0xf7e3ac));if(s.type==="entrega")c.add(this.add.rectangle(0,0,38,27,0x326d4b).setStrokeStyle(3,0xb6e6c6));}}
  chef(me:Me,m:{outfit:string;hair:string}){const c=this.add.container(0,0),out=Number(m.outfit)||0xf59ac2,h=Number(m.hair)||0x3b2318;c.add(this.add.ellipse(0,17,29,10,0x000000,.22));c.add(this.add.rectangle(0,5,25,28,out).setStrokeStyle(2,0x453238));c.add(this.add.circle(0,-14,14,0xf0c4a5).setStrokeStyle(2,0x453238));c.add(this.add.ellipse(0,-25,23,9,0xffffff).setStrokeStyle(2,0x453238));c.add(this.add.rectangle(0,-30,17,7,0xffffff));c.add(this.add.arc(0,-22,12,Math.PI,Math.PI*2,false,h));c.add(this.add.circle(-5,-14,2,0x282329));c.add(this.add.circle(5,-14,2,0x282329));return c;}
  blocked(x:number,y:number){const gx=Math.floor(x/TILE),gy=Math.floor(y/TILE);return gx<1||gy<1||gx>=COLS-1||gy>=ROWS-1||solid[gy][gx];}
  move(dt:number){let x=0,y=0;if(this.keys?.W.isDown||this.keys?.UP.isDown)y--;if(this.keys?.S.isDown||this.keys?.DOWN.isDown)y++;if(this.keys?.A.isDown||this.keys?.LEFT.isDown)x--;if(this.keys?.D.isDown||this.keys?.RIGHT.isDown)x++;x+=joy.x;y+=joy.y;const l=Math.hypot(x,y);if(l>1){x/=l;y/=l;}const tx=x*215,ty=y*215,a=dt/1000*1450;this.vx=Phaser.Math.Clamp(this.vx+(tx-this.vx)*Math.min(1,a/215),-215,215);this.vy=Phaser.Math.Clamp(this.vy+(ty-this.vy)*Math.min(1,a/215),-215,215);if(!x&&!y){this.vx*=.78;this.vy*=.78;}const nx=this.player.x+this.vx*dt/1000,ny=this.player.y+this.vy*dt/1000;if(!this.blocked(nx,this.player.y))this.player.x=nx;else this.vx=0;if(!this.blocked(this.player.x,ny))this.player.y=ny;else this.vy=0;if(Math.abs(this.vx)>5||Math.abs(this.vy)>5)this.facing=Math.abs(this.vx)>Math.abs(this.vy)?(this.vx>0?"right":"left"):(this.vy>0?"down":"up");}
  nearestStation(){let best:string|null=null,bd=76;for(const s of STATIONS){if(s.type==="parede")continue;const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,(s.x+.5)*TILE,(s.y+.5)*TILE);if(d<bd){bd=d;best=s.id;}}if(best!==this.nearest){this.nearest=best;hooks.onStationFocus(best);}}
  interact(){this.nearestStation();if(this.nearest)hooks.sendAct({seq:++seq,stationId:this.nearest,held:hooks.getWorld().heldBy[hooks.me]});}
  throwItem(){const h=hooks.getWorld().heldBy[hooks.me];if(!h)return;const dx=this.facing==="right"?1:this.facing==="left"?-1:0,dy=this.facing==="down"?1:this.facing==="up"?-1:0;hooks.sendAct({seq:++seq,stationId:"",held:h});hooks.onHeldChanged(null);}
  update(_t:number,dt:number){if(hooks.getStage()!=="jogando")return;this.move(dt);this.nearestStation();if(act){act=false;this.interact();}if(thr){thr=false;this.throwItem();}this.heldText.setPosition(this.player.x,this.player.y-43).setText(hooks.getWorld().heldBy[hooks.me]?ITEM_LABEL[hooks.getWorld().heldBy[hooks.me]!]??"": "");this.shadow.setPosition(this.player.x,this.player.y+19);if(Date.now()-this.lastSend>60){this.lastSend=Date.now();hooks.sendPos({x:this.player.x,y:this.player.y,facing:this.facing,holding:hooks.getWorld().heldBy[hooks.me],t:Date.now()});}for(const m of ["gu","li"] as Me[]){if(m===hooks.me)continue;const p=last[m];if(!p)continue;if(!remote[m]){remote[m]=this.chef(m,hooks.outfits[m]);this.add.existing(remote[m]!);}remote[m]!.setPosition(p.x,p.y);}}
  bubble(_w:Me,_t:string){}
 }
 const game=new Phaser.Game({type:Phaser.WEBGL,parent:container,width:container.clientWidth,height:container.clientHeight,backgroundColor:"#20242a",render:{antialias:true,powerPreference:"high-performance"},scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[Scene],fps:{target:60,min:30}});
 const unsub=hooks.onPos((p,from)=>{last[from]=p;});
 const unsubAct=()=>{};
 return{destroy:()=>{unsub();game.destroy(true);},setJoystick:(x,y)=>{joy.x=x;joy.y=y;},pressAction:()=>{act=true;},pressThrow:()=>{thr=true;},showBubble:()=>{}};
}
