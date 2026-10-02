import type PhaserType from "phaser";
import { COLS, ROWS, STATIONS, TILE, buildSolidGrid, stationAt } from "./layout";
import { COOK_DURATIONS, DISH_LABEL, ITEM_LABEL, RECIPE_NEEDS } from "./recipes";
import type { ActMsg, HeldItem, Me, PosMsg, StationDef, StationType, WorldSnapshot } from "./types";

const COLORS = {
  floorA: 0xf1dfc7,
  floorB: 0xe6cbb7,
  grout: 0xc09d91,
  wall: 0x4b3945,
  wallTop: 0x725463,
  counter: 0x5b4750,
  counterFront: 0x3d3038,
  counterTop: 0xf6e1cf,
  outline: 0x34262b,
  shadow: 0x21191d,
  cream: 0xfff6e9,
  accent: 0xe45b6f,
  success: 0x55b96e,
  warning: 0xf0b34b,
  danger: 0xd94f52,
};

export interface EngineHooks {
  me: Me;
  isHost: boolean;
  getWorld: () => WorldSnapshot;
  getStage: () => "espera" | "jogando" | "pausa" | "fim";
  outfits: Record<Me, { outfit: string; hair: string }>;
  sendPos: (p: PosMsg) => void;
  onPos: (cb: (p: PosMsg, from: Me) => void) => () => void;
  sendAct: (a: ActMsg) => void;
  onAct: (cb: (a: ActMsg, from: Me) => void) => () => void;
  applyHostAction: (stationId: string, held: HeldItem, forPlayer?: Me) => { world: WorldSnapshot; held: HeldItem } | null;
  onWorldChanged: (world: WorldSnapshot) => void;
  onHeldChanged: (held: HeldItem) => void;
  onStationFocus: (stationId: string | null) => void;
  showFps: boolean;
}

export interface EngineHandle {
  destroy: () => void;
  showBubble: (who: Me, text: string) => void;
  setJoystick: (vx: number, vy: number) => void;
  pressAction: () => void;
}

const other = (m: Me): Me => (m === "gu" ? "li" : "gu");
const numColor = (value: string) => Number(value);

export async function createCozinhaGame(container: HTMLDivElement, hooks: EngineHooks): Promise<EngineHandle> {
  const Phaser = await import("phaser");
  let seq = 0;
  let localHeld: HeldItem = null;
  // Spawn points separados para a dupla começar dentro da cozinha, perto da área de serviço.
  let localX = (hooks.me === "gu" ? 5.5 : 9.5) * TILE;
  let localY = 6.5 * TILE;
  let localFacing: PosMsg["facing"] = "down";
  const solid = buildSolidGrid();
  const remoteBuf: PosMsg[] = [];
  let remoteDisplay = { x: (hooks.me === "gu" ? 9.5 : 5.5) * TILE, y: 6.5 * TILE, facing: "up" as PosMsg["facing"], holding: null as HeldItem };
  const joy = { vx: 0, vy: 0 };
  let actionPressed = false;
  let focusStation: string | null = null;
  let lastSeenWorldVersion = -1;
  const lastSeqByPlayer: Partial<Record<Me, number>> = {};

  class Scene extends Phaser.Scene {
    bubbles: Record<Me, { text: string; until: number } | null> = { gu: null, li: null };
    sprites: Partial<Record<Me, PhaserType.GameObjects.Container>> = {};
    stationGfx: Record<string, PhaserType.GameObjects.Container> = {};
    highlightGfx?: PhaserType.GameObjects.Rectangle;
    ordersGroup?: PhaserType.GameObjects.Container;
    scoreText?: PhaserType.GameObjects.Text;
    timerText?: PhaserType.GameObjects.Text;
    fpsText?: PhaserType.GameObjects.Text;
    lastHud = 0;
    lastSend = 0;
    walkT = 0;
    lastScore = 0;
    lastBurnt = new Set<string>();

    constructor() { super("kitchen"); }

    create() {
      this.cameras.main.setBackgroundColor(0x241c22);
      this.fitKitchenToScreen();
      this.scale.on("resize", this.fitKitchenToScreen, this);
      this.events.once("shutdown", () => this.scale.off("resize", this.fitKitchenToScreen, this));
      this.drawRoom();
      this.drawStations();
      this.highlightGfx = this.add.rectangle(0, 0, TILE - 6, TILE - 6, COLORS.accent, 0.12)
        .setStrokeStyle(4, COLORS.accent, 0.95).setVisible(false).setDepth(8);
      this.drawHudFrame();
      this.sprites.gu = this.makeAvatar(hooks.outfits.gu, "bb gu", 5.5 * TILE, 6.5 * TILE);
      this.sprites.li = this.makeAvatar(hooks.outfits.li, "bb li", 9.5 * TILE, 6.5 * TILE);
      const unsubPos = hooks.onPos((p) => {
        remoteBuf.push({ ...p, t: performance.now() });
        if (remoteBuf.length > 8) remoteBuf.shift();
      });
      this.events.once("shutdown", unsubPos);
    }

    fitKitchenToScreen() {
      const width = this.scale.width;
      const height = this.scale.height;
      const zoom = Math.min(width / (COLS * TILE), height / (ROWS * TILE));
      this.cameras.main.setZoom(zoom);
      this.cameras.main.centerOn((COLS * TILE) / 2, (ROWS * TILE) / 2);
    }

    drawRoom() {
      const g = this.add.graphics().setDepth(0);
      g.fillStyle(COLORS.shadow, 0.45).fillRoundedRect(5, 5, COLS * TILE - 10, ROWS * TILE - 6, 12);
      for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
          const px = x * TILE;
          const py = y * TILE;
          g.fillStyle((x + y) % 2 ? COLORS.floorA : COLORS.floorB, 1).fillRect(px, py, TILE, TILE);
          g.lineStyle(1, COLORS.grout, 0.45).strokeRect(px, py, TILE, TILE);
          if ((x * 7 + y * 3) % 9 === 0) g.fillStyle(COLORS.cream, 0.12).fillCircle(px + 12, py + 14, 3);
        }
      }
      // Decorative rug and plants make the room feel inhabited without affecting collisions.
      g.fillStyle(0xa94f5b, 0.26).fillRoundedRect(5.2 * TILE, 3.55 * TILE, 4.6 * TILE, 1.9 * TILE, 18);
      g.lineStyle(3, 0xf2b5a6, 0.35).strokeRoundedRect(5.3 * TILE, 3.65 * TILE, 4.4 * TILE, 1.7 * TILE, 15);
      this.drawPlant(TILE * 1.55, TILE * 1.55);
      this.drawPlant(TILE * 13.45, TILE * 7.45);
    }

    drawPlant(x: number, y: number) {
      const g = this.add.graphics().setDepth(1);
      g.fillStyle(0x9b5b43, 1).fillRoundedRect(x - 11, y + 4, 22, 17, 4);
      g.fillStyle(0x467a50, 1).fillEllipse(x - 8, y, 13, 25);
      g.fillStyle(0x5f9a65, 1).fillEllipse(x + 7, y - 4, 14, 28);
      g.fillStyle(0x75ad76, 1).fillEllipse(x, y - 12, 13, 26);
    }

    drawStations() {
      for (const def of STATIONS) {
        const cx = def.x * TILE + TILE / 2;
        const cy = def.y * TILE + TILE / 2;
        const c = this.add.container(cx, cy).setDepth(3 + def.y * 0.01);
        this.stationGfx[def.id] = c;
        const g = this.add.graphics();
        c.add(g);
        this.drawStationBody(g, def);
        if (def.type !== "parede") {
          const title = def.ingredient ? ITEM_LABEL[def.ingredient] : stationLabel(def.type);
          const label = this.add.text(0, 19, title.toUpperCase(), {
            fontFamily: "Arial, sans-serif", fontStyle: "bold", fontSize: "7px", color: "#39282d",
          }).setOrigin(0.5);
          c.add(label);
        }
        const itemLayer = this.add.container(0, -7);
        itemLayer.setName("item-layer");
        c.add(itemLayer);
      }
    }

    drawStationBody(g: PhaserType.GameObjects.Graphics, def: StationDef) {
      if (def.type === "parede") {
        g.fillStyle(COLORS.wall, 1).fillRect(-TILE / 2, -TILE / 2, TILE, TILE);
        g.fillStyle(COLORS.wallTop, 1).fillRect(-TILE / 2 + 2, -TILE / 2 + 2, TILE - 4, 12);
        g.lineStyle(2, COLORS.outline, 0.55).strokeRect(-TILE / 2, -TILE / 2, TILE, TILE);
        g.lineStyle(1, COLORS.cream, 0.12).lineBetween(-TILE / 2 + 7, -4, TILE / 2 - 7, -4);
        return;
      }
      g.fillStyle(COLORS.shadow, 0.3).fillRoundedRect(-TILE / 2 + 4, -TILE / 2 + 8, TILE - 4, TILE - 4, 7);
      g.fillStyle(COLORS.counterFront, 1).fillRoundedRect(-TILE / 2 + 2, -TILE / 2 + 5, TILE - 4, TILE - 8, 6);
      g.fillStyle(stationColor(def.type), 1).fillRoundedRect(-TILE / 2 + 3, -TILE / 2 + 2, TILE - 6, TILE - 18, 7);
      g.lineStyle(2, COLORS.outline, 0.75).strokeRoundedRect(-TILE / 2 + 3, -TILE / 2 + 2, TILE - 6, TILE - 18, 7);
      g.fillStyle(COLORS.cream, 0.35).fillRoundedRect(-TILE / 2 + 7, -TILE / 2 + 6, TILE - 14, 5, 2);
      if (def.type === "fogao") {
        g.lineStyle(3, 0x322b30, 1).strokeCircle(0, -8, 13);
        g.lineStyle(2, 0xd86855, 0.8).strokeCircle(0, -8, 8);
      } else if (def.type === "forno") {
        g.fillStyle(0x352b31, 1).fillRoundedRect(-16, -18, 32, 24, 4);
        g.fillStyle(0xf29c52, 0.45).fillRoundedRect(-12, -14, 24, 13, 2);
        g.fillStyle(0xddd5ce, 1).fillCircle(12, 10, 3);
      } else if (def.type === "tabua") {
        g.fillStyle(0xb67a4f, 1).fillRoundedRect(-19, -19, 38, 24, 5);
        g.lineStyle(1, 0x714a36, 0.6).lineBetween(-13, -12, 11, -12);
        g.lineBetween(-10, -5, 14, -5);
      } else if (def.type === "liquidificador") {
        g.fillStyle(0x5e516e, 1).fillRoundedRect(-12, -2, 24, 11, 3);
        g.fillStyle(0xcbe9e2, 0.8).fillRoundedRect(-9, -24, 18, 23, 4);
        g.lineStyle(2, 0x5e516e, 1).strokeRoundedRect(-9, -24, 18, 23, 4);
      } else if (def.type === "entrega") {
        g.fillStyle(COLORS.success, 1).fillRoundedRect(-20, -20, 40, 28, 5);
        g.lineStyle(3, COLORS.cream, 0.85).lineBetween(-10, -7, -2, 1);
        g.lineBetween(-2, 1, 12, -13);
      } else if (def.type === "lixeira") {
        g.fillStyle(0x5b6468, 1).fillRoundedRect(-15, -18, 30, 29, 4);
        g.fillStyle(0x343c40, 1).fillRoundedRect(-18, -21, 36, 7, 3);
        g.lineStyle(2, 0x9da8aa, 0.6).lineBetween(-7, -12, -7, 5);
        g.lineBetween(0, -12, 0, 5); g.lineBetween(7, -12, 7, 5);
      } else if (def.ingredient) {
        drawItem(g, def.ingredient, 0, -9, 0.76);
      } else if (def.type === "montagem") {
        g.fillStyle(0xf2f0e9, 1).fillEllipse(0, -8, 35, 23);
        g.lineStyle(2, 0x9f9290, 1).strokeEllipse(0, -8, 35, 23);
      }
    }

    drawHudFrame() {
      const g = this.add.graphics().setDepth(20);
      g.fillStyle(0x251d23, 0.94).fillRoundedRect(10, 9, COLS * TILE - 20, 51, 8);
      g.lineStyle(1, 0xffffff, 0.12).strokeRoundedRect(10, 9, COLS * TILE - 20, 51, 8);
      this.scoreText = this.add.text(25, 25, "0 PTS", { fontFamily: "Arial", fontSize: "20px", fontStyle: "bold", color: "#fff1dc" }).setDepth(21);
      this.timerText = this.add.text(COLS * TILE - 25, 25, "3:00", { fontFamily: "Arial", fontSize: "20px", fontStyle: "bold", color: "#fff1dc" }).setOrigin(1, 0).setDepth(21);
      this.ordersGroup = this.add.container(100, 13).setDepth(21);
      this.fpsText = this.add.text(COLS * TILE - 55, 65, "", { fontSize: "10px", color: "#ffffffaa" }).setDepth(21);
      this.add.text(COLS * TILE / 2, 43, "PEDIDOS", { fontFamily: "Arial", fontSize: "8px", fontStyle: "bold", color: "#fff1dc99" }).setOrigin(0.5).setDepth(21);
    }

    makeAvatar(outfit: { outfit: string; hair: string }, name: string, x: number, y: number) {
      const c = this.add.container(x, y).setDepth(10);
      const shadow = this.add.ellipse(0, 16, 31, 12, COLORS.shadow, 0.3);
      const legs = this.add.graphics().setName("legs");
      const body = this.add.graphics();
      body.fillStyle(numColor(outfit.outfit), 1).fillRoundedRect(-14, -6, 28, 27, 9);
      body.lineStyle(2, COLORS.outline, 0.8).strokeRoundedRect(-14, -6, 28, 27, 9);
      body.fillStyle(COLORS.cream, 1).fillRoundedRect(-10, 3, 20, 18, 5);
      body.fillStyle(0xd5c4b3, 1).fillCircle(0, 12, 2.5);
      const head = this.add.graphics();
      head.fillStyle(0xf0bd96, 1).fillCircle(0, -15, 13);
      head.lineStyle(2, COLORS.outline, 0.75).strokeCircle(0, -15, 13);
      head.fillStyle(numColor(outfit.hair), 1).fillEllipse(0, -23, 23, 13);
      head.fillStyle(0x352930, 1).fillCircle(-4, -15, 1.6).fillCircle(4, -15, 1.6);
      head.lineStyle(1.5, 0xa65e63, 1).arc(0, -10, 4, 0.2, Math.PI - 0.2);
      const hat = this.add.graphics();
      hat.fillStyle(COLORS.cream, 1).fillEllipse(0, -33, 30, 15);
      hat.fillRoundedRect(-11, -32, 22, 12, 4);
      hat.lineStyle(1.5, 0xb9aaa0, 0.8).strokeEllipse(0, -33, 30, 15);
      const heldLayer = this.add.graphics().setName("held");
      const arms = this.add.graphics().setName("arms");
      arms.lineStyle(5, numColor(outfit.outfit), 1).lineBetween(-13, 3, -21, 10).lineBetween(13, 3, 21, 10);
      const nameTag = this.add.text(0, 25, name, { fontSize: "9px", fontStyle: "bold", color: "#fff8ef", backgroundColor: "#35282ecc", padding: { x: 4, y: 2 } }).setOrigin(0.5);
      const bubble = this.add.text(0, -46, "", { fontSize: "9px", color: "#382930", backgroundColor: "#fff8eff2", padding: { x: 5, y: 3 }, wordWrap: { width: 120 } }).setOrigin(0.5, 1).setVisible(false);
      c.add([shadow, legs, body, arms, head, hat, heldLayer, nameTag, bubble]);
      return c;
    }

    frontTile(x: number, y: number, facing: PosMsg["facing"]) {
      const tx = Math.floor(x / TILE); const ty = Math.floor(y / TILE);
      if (facing === "up") return { x: tx, y: ty - 1 };
      if (facing === "down") return { x: tx, y: ty + 1 };
      if (facing === "left") return { x: tx - 1, y: ty };
      return { x: tx + 1, y: ty };
    }

    moveLocal(dt: number) {
      if (hooks.getStage() !== "jogando") return;
      let dx = 0; let dy = 0;
      const kb = this.input.keyboard;
      if (kb) {
        const k = kb.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as Record<string, PhaserType.Input.Keyboard.Key>;
        if (k.W?.isDown || k.UP?.isDown) dy -= 1;
        if (k.S?.isDown || k.DOWN?.isDown) dy += 1;
        if (k.A?.isDown || k.LEFT?.isDown) dx -= 1;
        if (k.D?.isDown || k.RIGHT?.isDown) dx += 1;
      }
      dx += joy.vx; dy += joy.vy;
      const len = Math.hypot(dx, dy);
      if (len > 0.08) {
        dx /= len; dy /= len;
        if (Math.abs(dx) > Math.abs(dy)) localFacing = dx > 0 ? "right" : "left";
        else localFacing = dy > 0 ? "down" : "up";
      } else { dx = 0; dy = 0; }
      const speed = 180;
      const nx = localX + dx * speed * dt; const ny = localY + dy * speed * dt;
      const blocked = (px: number, py: number) => {
        const r = 13;
        return [[px-r,py-r],[px+r,py-r],[px-r,py+r],[px+r,py+r]].some(([x,y]) => {
          const tx = Math.floor(x / TILE); const ty = Math.floor(y / TILE);
          return tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS || Boolean(solid[ty]?.[tx]);
        });
      };
      if (!blocked(nx, localY)) localX = nx;
      if (!blocked(localX, ny)) localY = ny;
      const ft = this.frontTile(localX, localY, localFacing);
      const stDef = stationAt(ft.x, ft.y);
      const nextFocus = stDef && stDef.type !== "parede" ? stDef.id : null;
      if (nextFocus !== focusStation) { focusStation = nextFocus; hooks.onStationFocus(focusStation); }
      if (stDef && stDef.type !== "parede") {
        this.highlightGfx?.setVisible(true).setPosition(ft.x * TILE + TILE / 2, ft.y * TILE + TILE / 2);
        this.highlightGfx?.setScale(1 + Math.sin(this.walkT / 110) * 0.06);
      }
      else this.highlightGfx?.setVisible(false);
      return len > 0.08;
    }

    tryAction() {
      if (!focusStation) { this.cameras.main.shake(45, 0.001); return; }
      if (hooks.isHost) {
        const res = hooks.applyHostAction(focusStation, localHeld, hooks.me);
        if (res) { localHeld = res.held; hooks.onHeldChanged(localHeld); hooks.onWorldChanged(res.world); this.actionBurst(); }
        else this.invalidPulse();
      } else { seq += 1; hooks.sendAct({ seq, stationId: focusStation, held: localHeld }); }
    }

    actionBurst() {
      const avatar = this.sprites[hooks.me]; if (!avatar) return;
      const ring = this.add.circle(avatar.x, avatar.y, 8, COLORS.cream, 0).setStrokeStyle(3, COLORS.cream, 0.9).setDepth(14);
      this.tweens.add({ targets: ring, radius: 28, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    }

    invalidPulse() {
      const avatar = this.sprites[hooks.me]; if (!avatar) return;
      this.tweens.add({ targets: avatar, x: avatar.x + 3, duration: 35, yoyo: true, repeat: 2 });
    }

    update(_: number, deltaMs: number) {
      const dt = Math.min(deltaMs, 50) / 1000;
      const walking = this.moveLocal(dt);
      if (actionPressed) { actionPressed = false; this.tryAction(); }
      if (!hooks.isHost) {
        const w = hooks.getWorld();
        if (w.version !== lastSeenWorldVersion) {
          lastSeenWorldVersion = w.version;
          const mine = w.heldBy?.[hooks.me] ?? null;
          if (mine !== localHeld) { localHeld = mine; hooks.onHeldChanged(localHeld); }
        }
      }
      const now = performance.now();
      if (now - this.lastSend > 66) { this.lastSend = now; hooks.sendPos({ x: localX, y: localY, facing: localFacing, holding: localHeld, t: Date.now() }); }
      const renderT = now - 100;
      if (remoteBuf.length >= 2) {
        let a = remoteBuf[0]; let b = remoteBuf[1];
        for (let i = 0; i < remoteBuf.length - 1; i += 1) {
          const current = remoteBuf[i]; const next = remoteBuf[i + 1];
          if (current && next && current.t <= renderT && next.t >= renderT) { a = current; b = next; }
        }
        if (a && b) {
          const ratio = Phaser.Math.Clamp((renderT - a.t) / Math.max(1, b.t - a.t), 0, 1);
          remoteDisplay = { x: Phaser.Math.Linear(a.x,b.x,ratio), y: Phaser.Math.Linear(a.y,b.y,ratio), facing: b.facing, holding: b.holding };
        }
      } else if (remoteBuf[0]) remoteDisplay = { ...remoteBuf[0] };
      this.walkT += deltaMs;
      this.renderAvatar(this.sprites[hooks.me], localX, localY, localFacing, localHeld, Boolean(walking));
      this.renderAvatar(this.sprites[other(hooks.me)], remoteDisplay.x, remoteDisplay.y, remoteDisplay.facing, remoteDisplay.holding, remoteBuf.length > 0);
      this.renderBubbles();
      if (now - this.lastHud > 120) { this.lastHud = now; this.renderWorld(hooks.getWorld()); }
    }

    renderAvatar(c: PhaserType.GameObjects.Container | undefined, x: number, y: number, facing: PosMsg["facing"], held: HeldItem, walking: boolean) {
      if (!c) return;
      const bob = walking ? Math.abs(Math.sin(this.walkT / 95)) * 3 : 0;
      c.setPosition(x, y - bob).setDepth(10 + y * 0.01);
      c.setScale(facing === "left" ? -1 : 1, 1);
      const nameTag = c.list.find((child) => child.name === "") as PhaserType.GameObjects.Text | undefined;
      void nameTag;
      const legs = c.getByName("legs") as PhaserType.GameObjects.Graphics | null;
      if (legs) {
        legs.clear().lineStyle(5, COLORS.outline, 1);
        const step = walking ? Math.sin(this.walkT / 80) * 4 : 0;
        legs.lineBetween(-7, 15, -7 + step, 23).lineBetween(7, 15, 7 - step, 23);
      }
      const arms = c.getByName("arms") as PhaserType.GameObjects.Graphics | null;
      if (arms) {
        arms.clear();
        arms.lineStyle(5, hooks.outfits[c === this.sprites.gu ? "gu" : "li"].outfit ? numColor(hooks.outfits[c === this.sprites.gu ? "gu" : "li"].outfit) : COLORS.accent, 1);
        const reach = held ? 16 : 8;
        arms.lineBetween(-13, 3, -reach, 10).lineBetween(13, 3, reach, 10);
      }
      const heldLayer = c.getByName("held") as PhaserType.GameObjects.Graphics | null;
      if (heldLayer) { heldLayer.clear(); if (held) drawItem(heldLayer, held, 0, -42, 0.86); }
    }

    renderBubbles() {
      for (const m of ["gu", "li"] as Me[]) {
        const c = this.sprites[m]; if (!c) continue;
        const bubble = c.list[c.list.length - 1] as PhaserType.GameObjects.Text | undefined;
        const b = this.bubbles[m];
        if (bubble) { if (b && b.until > Date.now()) bubble.setVisible(true).setText(b.text); else bubble.setVisible(false); }
      }
    }

    renderWorld(w: WorldSnapshot) {
      const secs = Math.max(0, Math.ceil(w.timeLeft / 1000));
      this.scoreText?.setText(`${w.score} PTS`);
      this.timerText?.setText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`);
      if (w.score > this.lastScore) { this.scorePop(w.score - this.lastScore); this.lastScore = w.score; }
      this.renderOrders(w);
      for (const def of STATIONS) this.renderStationState(def, w);
      if (hooks.showFps) this.fpsText?.setVisible(true).setText(`${Math.round(this.game.loop.actualFps)} FPS`);
      else this.fpsText?.setVisible(false);
    }

    renderStationState(def: StationDef, w: WorldSnapshot) {
      const container = this.stationGfx[def.id]; const state = w.stations[def.id]; if (!container || !state) return;
      const layer = container.getByName("item-layer") as PhaserType.GameObjects.Container | null; if (!layer) return;
      layer.removeAll(true);
      const gfx = this.add.graphics(); layer.add(gfx);
      if (state.held) drawItem(gfx, state.held, 0, 0, 0.78);
      if (state.bench?.length) state.bench.forEach((item, i) => drawItem(gfx, item, (i - (state.bench?.length ?? 1) / 2) * 11 + 5, 0, 0.47));
      const process = state.process;
      if (process?.itemIn) {
        drawItem(gfx, process.itemIn, 0, 0, 0.62);
        const duration = COOK_DURATIONS[process.itemIn];
        if (duration && process.startedAt) {
          const ratio = Phaser.Math.Clamp((Date.now() - process.startedAt) / duration.ready, 0, 1);
          gfx.fillStyle(0x2b2528, 0.75).fillRoundedRect(-18, 14, 36, 5, 2);
          gfx.fillStyle(process.burnt ? COLORS.danger : process.ready ? COLORS.success : COLORS.warning, 1).fillRoundedRect(-18, 14, 36 * ratio, 5, 2);
        }
        if (process.burnt && !this.lastBurnt.has(def.id)) { this.lastBurnt.add(def.id); this.smokeAt(container.x, container.y); }
        if (!process.burnt) this.lastBurnt.delete(def.id);
      }
    }

    renderOrders(w: WorldSnapshot) {
      const group = this.ordersGroup; if (!group) return;
      group.removeAll(true);
      w.orders.slice(0, 4).forEach((o, i) => {
        const x = i * 150;
        const card = this.add.container(x, 0);
        const g = this.add.graphics();
        g.fillStyle(0xfff7ed, 1).fillRoundedRect(0, 0, 140, 43, 5);
        g.lineStyle(2, 0x9f7c71, 0.65).strokeRoundedRect(0, 0, 140, 43, 5);
        drawItem(g, o.dish, 20, 21, 0.7);
        const title = this.add.text(39, 5, DISH_LABEL[o.dish], { fontSize: "10px", fontStyle: "bold", color: "#3c2c31" });
        const steps = RECIPE_NEEDS[o.dish].map((n) => ITEM_LABEL[n]?.split(" ")[0]).join(" + ");
        const detail = this.add.text(39, 21, steps, { fontSize: "7px", color: "#6e565d" });
        const ratio = Phaser.Math.Clamp(1 - (Date.now() - o.bornAt) / o.patienceMs, 0, 1);
        const urgent = ratio < 0.25;
        g.fillStyle(urgent ? 0xffe1dc : 0xfff7ed, 1).fillRoundedRect(0, 0, 140, 43, 5);
        g.lineStyle(2, urgent ? COLORS.danger : 0x9f7c71, urgent ? 0.95 : 0.65).strokeRoundedRect(0, 0, 140, 43, 5);
        g.fillStyle(0xd6c8bd, 1).fillRoundedRect(39, 34, 91, 4, 2);
        g.fillStyle(ratio > 0.5 ? COLORS.success : ratio > 0.2 ? COLORS.warning : COLORS.danger, 1).fillRoundedRect(39, 34, 91 * ratio, 4, 2);
        card.add([g, title, detail]); group.add(card);
        if (urgent) card.setScale(1 + Math.sin(Date.now() / 120) * 0.025);
      });
    }

    scorePop(points: number) {
      const text = this.add.text(COLS * TILE / 2, 80, `+${points}`, { fontSize: "27px", fontStyle: "bold", color: "#fff1a8", stroke: "#563a34", strokeThickness: 5 }).setOrigin(0.5).setDepth(30);
      this.tweens.add({ targets: text, y: 55, alpha: 0, scale: 1.35, duration: 780, ease: "Cubic.easeOut", onComplete: () => text.destroy() });
      this.cameras.main.flash(100, 255, 238, 180, false);
    }

    smokeAt(x: number, y: number) {
      for (let i = 0; i < 5; i += 1) {
        const p = this.add.circle(x + (i - 2) * 5, y - 15, 5 + i, 0x4b4547, 0.65).setDepth(16);
        this.tweens.add({ targets: p, y: y - 70 - i * 4, x: p.x + (i % 2 ? 10 : -10), alpha: 0, scale: 1.7, duration: 1000 + i * 90, onComplete: () => p.destroy() });
      }
      this.cameras.main.shake(90, 0.002);
    }
  }

  function stationLabel(type: StationType) {
    const labels: Record<StationType, string> = { parede: "", balcao: "Bancada", geladeira: "Ingredientes", tabua: "Cortar", fogao: "Fogão", forno: "Forno", liquidificador: "Liquidificador", montagem: "Montar", entrega: "Entrega", lixeira: "Lixeira" };
    return labels[type];
  }

  function stationColor(type: StationType) {
    const colors: Record<StationType, number> = { parede: COLORS.wall, balcao: COLORS.counterTop, geladeira: 0xb7d9dc, tabua: 0xe8c18e, fogao: 0xa8a0a0, forno: 0xc66f63, liquidificador: 0xafa4cf, montagem: 0xf3dca7, entrega: 0x92c19b, lixeira: 0x879093 };
    return colors[type];
  }

  function drawItem(g: PhaserType.GameObjects.Graphics, item: Exclude<HeldItem, null>, x: number, y: number, scale: number) {
    const X = (n: number) => x + n * scale; const Y = (n: number) => y + n * scale;
    const ellipse = (color: number, px: number, py: number, w: number, h: number) => g.fillStyle(color, 1).fillEllipse(X(px), Y(py), w * scale, h * scale);
    const rect = (color: number, px: number, py: number, w: number, h: number, r = 2) => g.fillStyle(color, 1).fillRoundedRect(X(px), Y(py), w * scale, h * scale, r * scale);
    if (item === "pao") { rect(0xd9903d,-15,-8,30,16,6); rect(0xf1be68,-12,-6,24,10,4); }
    else if (item === "carne" || item === "carne_cozida") { ellipse(item === "carne" ? 0xc85155 : 0x7b4031,0,0,28,18); ellipse(0xf3b0a0,-5,-2,7,6); }
    else if (item === "queijo") { g.fillStyle(0xf4ce4e,1).fillTriangle(X(-14),Y(8),X(14),Y(8),X(9),Y(-12)); ellipse(0xd9a936,3,1,4,4); ellipse(0xd9a936,-6,5,3,3); }
    else if (item === "tomate" || item === "tomate_cortado") { ellipse(0xd94b43,0,0,25,item === "tomate" ? 23 : 13); g.fillStyle(0x4d8a51,1).fillTriangle(X(-5),Y(-9),X(0),Y(-15),X(5),Y(-9)); if(item === "tomate_cortado") g.lineStyle(1,0xffb2a0,1).lineBetween(X(-9),Y(0),X(9),Y(0)); }
    else if (item === "massa") { ellipse(0xe9c575,0,2,29,17); g.lineStyle(2,0xb68e52,0.8).arc(X(0),Y(3),9*scale,0,Math.PI); }
    else if (item === "molho") { rect(0xb23d3b,-10,-14,20,28,3); rect(0xe7d1b4,-7,-8,14,12,2); ellipse(0xd9564c,0,-2,8,8); }
    else if (item === "fruta") { ellipse(0xd64a5a,-5,1,15,19); ellipse(0xf08a4a,6,2,15,19); g.lineStyle(3,0x498451,1).lineBetween(X(0),Y(-8),X(3),Y(-14)); }
    else if (item === "massa_cupcake") { rect(0x8db8c7,-12,-9,24,19,4); ellipse(0xe4c383,0,-8,22,9); }
    else if (item === "cobertura") { ellipse(0xf3a9bb,0,2,25,16); ellipse(0xffdce5,-4,-4,11,8); }
    else if (item === "pizza_crua" || item === "pizza") { ellipse(item === "pizza" ? 0xdba340 : 0xe9ca8b,0,0,31,25); ellipse(0xc74343,-6,-2,5,5); ellipse(0xc74343,6,3,5,5); ellipse(0xf4d45b,3,-5,4,4); }
    else if (item === "cupcake_assado" || item === "cupcake") { rect(0xb66f50,-10,-1,20,14,3); ellipse(item === "cupcake" ? 0xef9bb1 : 0xc99061,0,-4,24,15); if(item === "cupcake") ellipse(0xf7d8df,0,-9,8,8); }
    else if (item === "hamburguer") { rect(0xd89037,-16,-10,32,8,6); rect(0x6f382a,-14,-2,28,7,2); rect(0x6da24c,-14,5,28,4,2); rect(0xd89037,-16,8,32,7,4); }
    else if (item === "sanduiche") { g.fillStyle(0xe5b85e,1).fillTriangle(X(-14),Y(10),X(14),Y(10),X(-14),Y(-11)); g.lineStyle(3,0x73a454,1).lineBetween(X(-9),Y(4),X(7),Y(4)); }
    else if (item === "suco") { rect(0xb9dce5,-9,-13,18,27,3); rect(0xdb5952,-6,-9,12,19,2); g.lineStyle(2,0xf2eee7,1).lineBetween(X(4),Y(-10),X(10),Y(-19)); }
  }

  const config: PhaserType.Types.Core.GameConfig = {
    type: Phaser.WEBGL,
    parent: container,
    width: container.clientWidth || COLS * TILE,
    height: container.clientHeight || ROWS * TILE,
    backgroundColor: "#241c22",
    transparent: false,
    antialias: true,
    render: { antialias: true, roundPixels: true, powerPreference: "high-performance" },
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    fps: { target: 120, min: 45, forceSetTimeOut: false },
    scene: Scene,
  };
  const game = new Phaser.Game(config);
  const unsubAct = hooks.isHost ? hooks.onAct((a, from) => {
    const lastSeq = lastSeqByPlayer[from]; if (lastSeq !== undefined && a.seq <= lastSeq) return;
    lastSeqByPlayer[from] = a.seq;
    const res = hooks.applyHostAction(a.stationId, a.held, from); if (res) hooks.onWorldChanged(res.world);
  }) : () => {};

  return {
    destroy: () => { unsubAct(); game.destroy(true); },
    showBubble: (who, text) => { const scene = game.scene.getScene("kitchen") as Scene | null; if (scene) scene.bubbles[who] = { text, until: Date.now() + 2600 }; },
    setJoystick: (vx, vy) => { joy.vx = vx; joy.vy = vy; },
    pressAction: () => { actionPressed = true; },
  };
}
