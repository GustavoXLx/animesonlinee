import type Phaser from "phaser";
import { COLS, ROWS, STATIONS, TILE, buildSolidGrid, stationAt } from "./layout";
import { DISH_LABEL, ITEM_LABEL, RECIPE_NEEDS } from "./recipes";
import type { ActMsg, HeldItem, Me, PosMsg, StationType, WorldSnapshot } from "./types";

const PALETTE = {
  floor1: 0xfff3e9,
  floor2: 0xffe9f2,
  wall: 0xd8a7c0,
  counter: 0xf6c6d8,
  counterTop: 0xffffff,
  fridge: 0xcdeef5,
  board: 0xe9d4a6,
  stove: 0xf29b9b,
  oven: 0xe08585,
  blender: 0xc9b6ec,
  bench: 0xfff6c9,
  delivery: 0xb7e4c7,
  trash: 0xbdbdbd,
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

export async function createCozinhaGame(container: HTMLDivElement, hooks: EngineHooks): Promise<EngineHandle> {
  const Phaser = await import("phaser");

  let seq = 0;
  let localHeld: HeldItem = null;
  let localX = 6 * TILE + TILE / 2;
  let localY = 4 * TILE + TILE / 2;
  let localFacing: PosMsg["facing"] = "down";
  const solid = buildSolidGrid();

  const remoteBuf: PosMsg[] = [];
  let remoteDisplay = { x: localX, y: localY, facing: "down" as PosMsg["facing"], holding: null as HeldItem };

  const joy = { vx: 0, vy: 0 };
  let actionPressed = false;
  let focusStation: string | null = null;
  let lastSeenWorldVersion = -1;
  const lastSeqByPlayer: Partial<Record<Me, number>> = {};

  class Scene extends Phaser.Scene {
    bubbles: Record<Me, { text: string; until: number } | null> = { gu: null, li: null };
    sprites: Record<Me, Phaser.GameObjects.Container> = {} as any;
    heldIcons: Record<Me, Phaser.GameObjects.Text> = {} as any;
    stationGfx: Record<string, Phaser.GameObjects.Container> = {};
    highlightGfx!: Phaser.GameObjects.Rectangle;
    hudText!: Phaser.GameObjects.Text;
    ordersGroup!: Phaser.GameObjects.Container;
    fpsText!: Phaser.GameObjects.Text;
    lastHud = 0;
    lastSend = 0;
    walkT = 0;

    constructor() {
      super("kitchen");
    }

    preload() {}

    create() {
      this.genTextures();
      this.drawFloor();
      this.drawStations();
      this.highlightGfx = this.add.rectangle(0, 0, TILE, TILE, 0xffffff, 0).setStrokeStyle(3, 0xffffff, 0.9).setVisible(false);
      this.hudText = this.add.text(8, ROWS * TILE + 4, "", { fontFamily: "sans-serif", fontSize: "14px", color: "#4a2545" });
      this.ordersGroup = this.add.container(0, 0);
      this.fpsText = this.add.text(COLS * TILE - 56, 2, "", { fontSize: "11px", color: "#00000066" });

      this.sprites.gu = this.makeAvatar(hooks.outfits.gu);
      this.sprites.li = this.makeAvatar(hooks.outfits.li);

      const unsubPos = hooks.onPos((p) => {
        remoteBuf.push({ ...p, t: performance.now() });
        if (remoteBuf.length > 8) remoteBuf.shift();
      });
      (this as any)._unsubPos = unsubPos;
    }

    genTextures() {
      const g = this.add.graphics();
      const mk = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
        g.clear();
        draw(g);
        g.generateTexture(key, w, h);
      };
      mk("floor1", TILE, TILE, (gg) => {
        gg.fillStyle(PALETTE.floor1, 1).fillRect(0, 0, TILE, TILE);
        gg.fillStyle(0xffffff, 0.25).fillRect(2, 2, TILE - 4, TILE - 4);
      });
      mk("floor2", TILE, TILE, (gg) => {
        gg.fillStyle(PALETTE.floor2, 1).fillRect(0, 0, TILE, TILE);
        gg.fillStyle(0xffffff, 0.2).fillRect(2, 2, TILE - 4, TILE - 4);
      });
      mk("wall", TILE, TILE, (gg) => {
        gg.fillStyle(PALETTE.wall, 1).fillRect(0, 0, TILE, TILE);
        gg.fillStyle(0xffffff, 0.15).fillRect(4, 4, TILE - 8, TILE - 8);
      });
      const station = (key: string, color: number, emoji?: string) => {
        mk(key, TILE, TILE, (gg) => {
          gg.fillStyle(PALETTE.counter, 1).fillRoundedRect(2, 10, TILE - 4, TILE - 12, 8);
          gg.fillStyle(color, 1).fillRoundedRect(4, 2, TILE - 8, TILE - 16, 10);
          gg.fillStyle(0xffffff, 0.35).fillRoundedRect(6, 4, TILE - 12, 6, 4);
        });
      };
      station("st_geladeira", PALETTE.fridge);
      station("st_tabua", PALETTE.board);
      station("st_fogao", PALETTE.stove);
      station("st_forno", PALETTE.oven);
      station("st_liquidificador", PALETTE.blender);
      station("st_montagem", PALETTE.bench);
      station("st_entrega", PALETTE.delivery);
      station("st_lixeira", PALETTE.trash);
      station("st_balcao", PALETTE.counterTop);

      mk("body", 30, 30, (gg) => {
        gg.fillStyle(0xffffff, 1).fillCircle(15, 17, 12);
      });
      g.destroy();
    }

    drawFloor() {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const key = (x + y) % 2 === 0 ? "floor1" : "floor2";
          this.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, key);
        }
      }
    }

    drawStations() {
      for (const s of STATIONS) {
        const cx = s.x * TILE + TILE / 2;
        const cy = s.y * TILE + TILE / 2;
        if (s.type === "parede") {
          this.add.image(cx, cy, "wall");
          continue;
        }
        const keyMap: Record<StationType, string> = {
          parede: "wall",
          balcao: "st_balcao",
          geladeira: "st_geladeira",
          tabua: "st_tabua",
          fogao: "st_fogao",
          forno: "st_forno",
          liquidificador: "st_liquidificador",
          montagem: "st_montagem",
          entrega: "st_entrega",
          lixeira: "st_lixeira",
        };
        this.add.image(cx, cy, keyMap[s.type]);
        const cont = this.add.container(cx, cy);
        this.stationGfx[s.id] = cont;
        const label = s.ingredient ? ITEM_LABEL[s.ingredient] : labelFor(s.type);
        this.add.text(cx, cy + TILE / 2 - 10, label, { fontSize: "9px", color: "#5a3350" }).setOrigin(0.5);
      }
    }

    makeAvatar(outfit: { outfit: string; hair: string }) {
      const c = this.add.container(localX, localY);
      const body = this.add.ellipse(0, 6, 22, 24, Number(outfit.outfit));
      const head = this.add.circle(0, -12, 11, 0xffe0c4);
      const hair = this.add.ellipse(0, -18, 16, 10, Number(outfit.hair));
      const eyes = this.add.text(-5, -14, "••", { fontSize: "8px", color: "#000" });
      c.add([body, head, hair, eyes]);
      (c as any).heldIcon = this.add.text(0, -34, "", { fontSize: "16px" }).setOrigin(0.5);
      c.add((c as any).heldIcon);
      (c as any).nameTag = this.add.text(0, 22, "", { fontSize: "9px", color: "#5a3350" }).setOrigin(0.5);
      c.add((c as any).nameTag);
      (c as any).bubble = this.add.text(0, -46, "", {
        fontSize: "10px",
        color: "#4a2545",
        backgroundColor: "#ffffffdd",
        padding: { x: 5, y: 2 },
      }).setOrigin(0.5, 1).setVisible(false);
      c.add((c as any).bubble);
      return c;
    }

    frontTile(x: number, y: number, facing: PosMsg["facing"]) {
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      if (facing === "up") return { x: tx, y: ty - 1 };
      if (facing === "down") return { x: tx, y: ty + 1 };
      if (facing === "left") return { x: tx - 1, y: ty };
      return { x: tx + 1, y: ty };
    }

    moveLocal(dt: number) {
      const stage = hooks.getStage();
      if (stage !== "jogando") return;
      let dx = 0;
      let dy = 0;
      const kb = this.input.keyboard;
      if (kb) {
        const k = kb.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as any;
        if (k.W.isDown || k.UP.isDown) dy -= 1;
        if (k.S.isDown || k.DOWN.isDown) dy += 1;
        if (k.A.isDown || k.LEFT.isDown) dx -= 1;
        if (k.D.isDown || k.RIGHT.isDown) dx += 1;
      }
      dx += joy.vx;
      dy += joy.vy;
      const len = Math.hypot(dx, dy) || 1;
      if (dx || dy) {
        dx /= len;
        dy /= len;
        if (Math.abs(dx) > Math.abs(dy)) localFacing = dx > 0 ? "right" : "left";
        else if (dy !== 0) localFacing = dy > 0 ? "down" : "up";
      }
      const speed = 150;
      const nx = localX + dx * speed * dt;
      const ny = localY + dy * speed * dt;
      const r = 14;
      if (!tileSolid(nx, localY, r)) localX = nx;
      if (!tileSolid(localX, ny, r)) localY = ny;
      localX = Phaser.Math.Clamp(localX, TILE * 0.6, COLS * TILE - TILE * 0.6);
      localY = Phaser.Math.Clamp(localY, TILE * 0.6, ROWS * TILE - TILE * 0.6);

      function tileSolid(px: number, py: number, rad: number) {
        const pts = [
          [px - rad, py - rad],
          [px + rad, py - rad],
          [px - rad, py + rad],
          [px + rad, py + rad],
        ];
        for (const [x, y] of pts) {
          const tx = Math.floor(x / TILE);
          const ty = Math.floor(y / TILE);
          if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
          if (solid[ty]?.[tx]) return true;
        }
        return false;
      }

      const ft = this.frontTile(localX, localY, localFacing);
      const stDef = stationAt(ft.x, ft.y);
      focusStation = stDef && stDef.type !== "parede" ? stDef.id : null;
      hooks.onStationFocus(focusStation);
      if (stDef && stDef.type !== "parede") {
        this.highlightGfx.setVisible(true).setPosition(ft.x * TILE + TILE / 2, ft.y * TILE + TILE / 2);
      } else {
        this.highlightGfx.setVisible(false);
      }
    }

    tryAction() {
      if (!focusStation) return;
      if (hooks.isHost) {
        const res = hooks.applyHostAction(focusStation, localHeld, hooks.me);
        if (res) {
          localHeld = res.held;
          hooks.onHeldChanged(localHeld);
          hooks.onWorldChanged(res.world);
        }
      } else {
        seq += 1;
        hooks.sendAct({ seq, stationId: focusStation, held: localHeld });
        // sem predição local: aguarda o host validar e devolver via snapshot (world.heldBy[me])
      }
    }

    update(_: number, deltaMs: number) {
      const dt = Math.min(deltaMs, 50) / 1000;
      this.moveLocal(dt);
      if (actionPressed) {
        actionPressed = false;
        this.tryAction();
      }

      // reconciliação: não-host sincroniza o item em mãos a partir do snapshot do host
      if (!hooks.isHost) {
        const w = hooks.getWorld();
        if (w.version !== lastSeenWorldVersion) {
          lastSeenWorldVersion = w.version;
          const mine = w.heldBy?.[hooks.me] ?? null;
          if (mine !== localHeld) {
            localHeld = mine;
            hooks.onHeldChanged(localHeld);
          }
        }
      }

      const now = performance.now();
      if (now - this.lastSend > 66) {
        this.lastSend = now;
        hooks.sendPos({ x: localX, y: localY, facing: localFacing, holding: localHeld, t: Date.now() });
      }

      // interpola remoto com buffer de ~100ms
      const renderT = now - 100;
      if (remoteBuf.length >= 2) {
        let a = remoteBuf[0];
        let b = remoteBuf[1];
        for (let i = 0; i < remoteBuf.length - 1; i++) {
          if (remoteBuf[i].t <= renderT && remoteBuf[i + 1].t >= renderT) {
            a = remoteBuf[i];
            b = remoteBuf[i + 1];
          }
        }
        const span = Math.max(1, b.t - a.t);
        const ratio = Phaser.Math.Clamp((renderT - a.t) / span, 0, 1);
        remoteDisplay = {
          x: Phaser.Math.Linear(a.x, b.x, ratio),
          y: Phaser.Math.Linear(a.y, b.y, ratio),
          facing: b.facing,
          holding: b.holding,
        };
      } else if (remoteBuf.length === 1) {
        remoteDisplay = { ...remoteBuf[0] };
      }

      const meC = this.sprites[hooks.me];
      const otherC = this.sprites[other(hooks.me)];
      this.walkT += deltaMs;
      const bob = Math.sin(this.walkT / 90) * 2;
      meC.setPosition(localX, localY + bob);
      (meC as any).heldIcon.setText(iconFor(localHeld));
      (meC as any).nameTag.setText(hooks.me === "gu" ? "bb gu" : "bb li");
      otherC.setPosition(remoteDisplay.x, remoteDisplay.y);
      (otherC as any).heldIcon.setText(iconFor(remoteDisplay.holding));
      (otherC as any).nameTag.setText(other(hooks.me) === "gu" ? "bb gu" : "bb li");

      for (const m of ["gu", "li"] as Me[]) {
        const c = this.sprites[m];
        const bub = (c as any).bubble as Phaser.GameObjects.Text;
        const b = this.bubbles[m];
        if (b && b.until > Date.now()) {
          bub.setVisible(true).setText(b.text);
        } else {
          bub.setVisible(false);
        }
      }

      if (now - this.lastHud > 150) {
        this.lastHud = now;
        const w = hooks.getWorld();
        const secs = Math.max(0, Math.ceil(w.timeLeft / 1000));
        this.hudText.setText(`⏱ ${secs}s   ⭐ ${w.score}`);
        this.renderOrders(w);
        if (hooks.showFps) {
          this.fpsText.setText(`${Math.round(this.game.loop.actualFps)} fps`);
          this.fpsText.setVisible(true);
        } else {
          this.fpsText.setVisible(false);
        }
      }
    }

    renderOrders(w: WorldSnapshot) {
      this.ordersGroup.removeAll(true);
      w.orders.forEach((o, i) => {
        const x = 90 + i * 150;
        const y = ROWS * TILE + 4;
        const need = RECIPE_NEEDS[o.dish];
        const icons = need.map((n) => iconFor(n)).join(" ");
        const box = this.add.rectangle(x, y + 16, 140, 40, 0xffffff, 0.9).setStrokeStyle(1, 0xd8a7c0);
        const txt = this.add.text(x, y + 6, `${iconForDish(o.dish)} ${DISH_LABEL[o.dish]}`, {
          fontSize: "11px",
          color: "#4a2545",
        }).setOrigin(0.5, 0);
        const txt2 = this.add.text(x, y + 20, icons, { fontSize: "10px" }).setOrigin(0.5, 0);
        const ratio = Phaser.Math.Clamp(1 - (Date.now() - o.bornAt) / o.patienceMs, 0, 1);
        const barBg = this.add.rectangle(x, y + 34, 120, 5, 0xeeeeee);
        const barColor = ratio > 0.5 ? 0x8fd19e : ratio > 0.2 ? 0xf0c75e : 0xe06666;
        const bar = this.add.rectangle(x - 60, y + 34, 120 * ratio, 5, barColor).setOrigin(0, 0.5);
        this.ordersGroup.add([box, txt, txt2, barBg, bar]);
      });
    }
  }

  function labelFor(t: StationType) {
    const m: Record<StationType, string> = {
      parede: "",
      balcao: "balcão",
      geladeira: "",
      tabua: "tábua",
      fogao: "fogão",
      forno: "forno",
      liquidificador: "liquidif.",
      montagem: "montagem",
      entrega: "entrega",
      lixeira: "lixo",
    };
    return m[t];
  }
  function iconFor(h: HeldItem): string {
    const m: Record<string, string> = {
      pao: "🍞",
      carne: "🥩",
      carne_cozida: "🍖",
      queijo: "🧀",
      tomate: "🍅",
      tomate_cortado: "🔪🍅",
      massa: "🥟",
      molho: "🥫",
      fruta: "🍓",
      massa_cupcake: "🧁",
      cobertura: "🍦",
      pizza_crua: "🍕",
      cupcake_assado: "🧁",
      hamburguer: "🍔",
      pizza: "🍕",
      sanduiche: "🥪",
      cupcake: "🧁",
      suco: "🥤",
    };
    return h ? m[h] ?? "❔" : "";
  }
  function iconForDish(d: string) {
    return iconFor(d as HeldItem);
  }

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.WEBGL,
    parent: container,
    width: COLS * TILE,
    height: ROWS * TILE + 60,
    backgroundColor: "#fff0f6",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    fps: { target: 120, forceSetTimeOut: false },
    scene: Scene,
  };

  const game = new (Phaser as any).Game(config);

  const unsubAct = hooks.isHost
    ? hooks.onAct((a, from) => {
        // dedupe por seq por jogador: ignora ações antigas/repetidas
        const lastSeq = lastSeqByPlayer[from];
        if (lastSeq !== undefined && a.seq <= lastSeq) return;
        lastSeqByPlayer[from] = a.seq;
        const res = hooks.applyHostAction(a.stationId, a.held, from);
        if (res) hooks.onWorldChanged(res.world);
      })
    : () => {};

  return {
    destroy: () => {
      unsubAct();
      game.destroy(true);
    },
    showBubble: (who: Me, text: string) => {
      const scene = game.scene.getScene("kitchen") as Scene | null;
      if (scene) scene.bubbles[who] = { text, until: Date.now() + 2600 };
    },
    setJoystick: (vx: number, vy: number) => {
      joy.vx = vx;
      joy.vy = vy;
    },
    pressAction: () => {
      actionPressed = true;
    },
  };
}
