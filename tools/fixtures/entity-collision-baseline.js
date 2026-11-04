// Previous MinecraftJS collision callback, retained as a differential/performance oracle.
import {shulkerBox} from '../../client/js/game/entities.js';
export function baselineCollider(bb,mover){
      const out = [];
      const self = mover.entity || null; // the vehicle being steered, or null for the player
      const g = [bb[0] - 0.25, bb[1] - 0.25, bb[2] - 0.25, bb[3] + 0.25, bb[4] + 0.25, bb[5] + 0.25];
      for (const e of this.entities.map.values()) {
        if (e === self || e.dead) continue;
        if (self ? e.riding === self.id : e.id === this.ridingEntityId) continue;
        const hw = (e.width || 0) / 2;
        const eb = e.kind === 'mob' && e.type === 69 ? shulkerBox(e) : [e.x - hw, e.y, e.z - hw, e.x + hw, e.y + (e.height || 0), e.z + hw];
        if (!(eb[3] > g[0] && eb[0] < g[3] && eb[4] > g[1] && eb[1] < g[4] && eb[5] > g[2] && eb[2] < g[5])) continue;
        const solid = e.kind === 'boat' || (e.kind === 'mob' && e.type === 69);
        const pushable = self && self.kind === 'boat' && (e.kind === 'player' || e.kind === 'mob' || e.kind === 'boat' || e.kind === 'minecart') && e.riding < 0;
        if (!solid && !pushable) continue;
        if (eb[3] > bb[0] && eb[0] < bb[3] && eb[4] > bb[1] && eb[1] < bb[4] && eb[5] > bb[2] && eb[2] < bb[5]) out.push(eb);
      }
      return out;
    }
