// The city view: a plain placeholder plan of Rome drawn with PixiJS. Districts are clickable.

import { Application, Container, Graphics, Text } from 'pixi.js';
import { useEffect, useRef } from 'react';
import { PLACES, TIBER } from '../content/places';
import { getAction, placeOf } from '../sim/core';
import type { GameState, PlaceId } from '../sim/types';

const W = 1000;
const H = 700;
const COL = { plaster: 0xf3ece0, ground: 0xe9dfcd, river: 0x8fb3ad, line: 0x6e1d14, fill: 0xd9ccb4, hover: 0xe6c77f, sel: 0xc8902f, ink: 0x2a241e, you: 0x9b2d20 };

interface Props {
  s: GameState;
  selected: PlaceId;
  onSelect: (p: PlaceId) => void;
  version: number;
}

export function CityMap({ s, selected, onSelect, version }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const appRef = useRef<{ app: Application; draw: (s: GameState, sel: PlaceId) => void } | null>(null);
  const onSel = useRef(onSelect);
  onSel.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    let hovered: PlaceId | null = null;
    (async () => {
      await app.init({ width: W, height: H, background: COL.ground, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
      if (cancelled) {
        app.destroy(true);
        return;
      }
      host.current?.appendChild(app.canvas);
      app.canvas.style.height = '46vh';
      app.canvas.style.width = 'auto';
      app.canvas.style.maxWidth = '100%';
      app.canvas.style.margin = '0 auto';
      const river = new Graphics();
      river.moveTo(TIBER[0], TIBER[1]);
      for (let i = 2; i < TIBER.length; i += 2) river.lineTo(TIBER[i], TIBER[i + 1]);
      river.stroke({ width: 26, color: COL.river, cap: 'round', join: 'round' });
      app.stage.addChild(river);
      const tiberLabel = new Text({ text: 'TIBERIS', style: { fontFamily: 'Cinzel', fontSize: 16, fill: 0x2c6a5e, letterSpacing: 4 } });
      tiberLabel.position.set(150, 360);
      tiberLabel.rotation = -1.2;
      app.stage.addChild(tiberLabel);
      const wall = new Graphics();
      wall.circle(560, 420, 300).stroke({ width: 2, color: 0xb9ab95, alpha: 0.6 });
      app.stage.addChild(wall);

      const layer = new Container();
      app.stage.addChild(layer);
      const shapes = new Map<PlaceId, Graphics>();
      const labels = new Map<PlaceId, Text>();
      const badges = new Map<PlaceId, Text>();
      for (const p of PLACES) {
        const g = new Graphics();
        g.eventMode = 'static';
        g.cursor = 'pointer';
        g.on('pointerover', () => {
          hovered = p.id;
          draw(lastS!, lastSel!);
        });
        g.on('pointerout', () => {
          hovered = null;
          draw(lastS!, lastSel!);
        });
        g.on('pointertap', () => onSel.current(p.id));
        layer.addChild(g);
        shapes.set(p.id, g);
        const t = new Text({ text: p.label.toUpperCase(), style: { fontFamily: 'Cinzel', fontSize: 17, fill: COL.ink, fontWeight: '600', letterSpacing: 2, align: 'center' } });
        t.anchor.set(0.5);
        t.position.set(p.labelAt[0], p.labelAt[1]);
        t.eventMode = 'none';
        layer.addChild(t);
        labels.set(p.id, t);
        const b = new Text({ text: '', style: { fontFamily: 'EB Garamond', fontSize: 15, fill: 0x6f6355 } });
        b.anchor.set(0.5);
        b.position.set(p.labelAt[0], p.labelAt[1] + 20);
        b.eventMode = 'none';
        layer.addChild(b);
        badges.set(p.id, b);
      }
      const you = new Graphics();
      you.eventMode = 'none';
      app.stage.addChild(you);
      const youLabel = new Text({ text: 'YOU', style: { fontFamily: 'Cinzel', fontSize: 12, fill: COL.you, fontWeight: '700' } });
      youLabel.anchor.set(0.5);
      youLabel.eventMode = 'none';
      app.stage.addChild(youLabel);

      let lastS: GameState | null = null;
      let lastSel: PlaceId | null = null;
      const draw = (st: GameState, sel: PlaceId) => {
        lastS = st;
        lastSel = sel;
        const counts = new Map<PlaceId, number>();
        for (const c of Object.values(st.chars)) if (c.alive && c.location === 'rome' && !c.female && c.id !== st.playerId) counts.set(c.home, (counts.get(c.home) ?? 0) + 1);
        for (const p of PLACES) {
          const g = shapes.get(p.id)!;
          g.clear();
          g.poly(p.poly).fill({ color: p.id === sel ? COL.sel : p.id === hovered ? COL.hover : COL.fill, alpha: p.id === sel ? 0.75 : 0.6 }).stroke({ width: p.id === sel ? 3 : 1.5, color: COL.line, alpha: 0.8 });
          const n = counts.get(p.id) ?? 0;
          badges.get(p.id)!.text = n ? `${n} ${n === 1 ? 'house' : 'houses'}` : '';
        }
        const pl = st.chars[st.playerId];
        let at: PlaceId | null = null;
        if (pl.location === 'rome') {
          const a = pl.action ? getAction(pl.action.id) : undefined;
          at = a ? placeOf(a, st, pl, pl.action!.params) : pl.home;
        }
        you.clear();
        if (at) {
          const p = PLACES.find((x) => x.id === at)!;
          you.circle(p.labelAt[0], p.labelAt[1] - 30, 9).fill(COL.you).stroke({ width: 2, color: COL.plaster });
          youLabel.visible = true;
          youLabel.position.set(p.labelAt[0], p.labelAt[1] - 48);
        } else youLabel.visible = false;
      };
      appRef.current = { app, draw };
      draw(s, selected);
    })();
    return () => {
      cancelled = true;
      if (appRef.current) {
        appRef.current.app.destroy(true);
        appRef.current = null;
      }
    };
    // Mount once; redraws happen below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    appRef.current?.draw(s, selected);
  }, [s, selected, version]);

  return <div ref={host} />;
}
