// Player list (tab), scoreboard objectives/scores and teams.
import { chatToLegacy } from '../gui/chat.js';

const TEAM_COLORS = ['black', 'dark_blue', 'dark_green', 'dark_aqua', 'dark_red', 'dark_purple', 'gold', 'gray',
  'dark_gray', 'blue', 'green', 'aqua', 'red', 'light_purple', 'yellow', 'white'];

export class Scoreboard {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.players = new Map(); // uuid -> { uuid, name, properties, gamemode, ping, displayName }
    this.objectives = new Map(); // name -> { displayName, type, scores: Map }
    this.teams = new Map(); // name -> { prefix, suffix, players:Set, color, nameTagVisibility, friendlyFire }
    this.playerTeam = new Map(); // player name -> team
    this.list = null; this.sidebar = null; this.belowName = null;
    this.header = ''; this.footer = '';
  }

  onPlayerInfo(p) {
    for (const d of p.data) {
      if (p.action === 0) {
        this.players.set(d.uuid, { uuid: d.uuid, name: d.name, properties: d.properties, gamemode: d.gamemode, ping: d.ping, displayName: d.displayName != null ? chatToLegacy(d.displayName) : null });
        // Update name of an already spawned player entity
        for (const e of this.game.entities.all()) if (e.uuid === d.uuid) e.name = d.name;
      } else {
        const pl = this.players.get(d.uuid);
        if (!pl) continue;
        if (p.action === 1) pl.gamemode = d.gamemode;
        else if (p.action === 2) pl.ping = d.ping;
        else if (p.action === 3) pl.displayName = d.displayName != null ? chatToLegacy(d.displayName) : null;
        else if (p.action === 4) this.players.delete(d.uuid);
      }
    }
  }

  onObjective(p) {
    if (p.action === 0) this.objectives.set(p.objective, { displayName: chatToLegacy(p.displayText), type: p.type, scores: new Map() });
    else if (p.action === 1) {
      this.objectives.delete(p.objective);
      if (this.sidebar === p.objective) this.sidebar = null;
      if (this.list === p.objective) this.list = null;
      if (this.belowName === p.objective) this.belowName = null;
    } else if (p.action === 2) {
      const o = this.objectives.get(p.objective);
      if (o) { o.displayName = chatToLegacy(p.displayText); o.type = p.type; }
    }
  }

  onScore(p) {
    if (p.action === 1) {
      if (p.scoreName) { const o = this.objectives.get(p.scoreName); if (o) o.scores.delete(p.itemName); }
      else for (const o of this.objectives.values()) o.scores.delete(p.itemName);
      return;
    }
    const o = this.objectives.get(p.scoreName);
    if (o) o.scores.set(p.itemName, p.value);
  }

  onDisplay(p) {
    const name = p.objective || null;
    if (p.position === 0) this.list = name;
    else if (p.position === 1) this.sidebar = name;
    else if (p.position === 2) this.belowName = name;
    else if (p.position >= 3) { if (p.position - 3 === this._myTeamColor()) this.sidebar = name; }
  }

  _myTeamColor() {
    const t = this.playerTeam.get(this.game.username);
    return t ? t.color : -1;
  }

  onTeam(p) {
    let t = this.teams.get(p.team);
    if (p.mode === 0) {
      t = { name: p.team, players: new Set() };
      this.teams.set(p.team, t);
    }
    if (!t) return;
    if (p.mode === 0 || p.mode === 2) {
      // 1.13 sends components here. The team color is the parent of the prefix,
      // profile name and suffix; an explicit prefix style must not color the name.
      const style = { color: TEAM_COLORS[p.color] };
      t.displayName = chatToLegacy(p.displayName);
      t.prefix = chatToLegacy(p.prefix, { style }); t.suffix = chatToLegacy(p.suffix, { style });
      t.friendlyFire = p.friendlyFire; t.nameTagVisibility = p.nameTagVisibility; t.color = p.color;
    }
    if (p.mode === 0 || p.mode === 3) for (const n of p.players) { t.players.add(n); this.playerTeam.set(n, t); }
    if (p.mode === 4) for (const n of p.players) { t.players.delete(n); if (this.playerTeam.get(n) === t) this.playerTeam.delete(n); }
    if (p.mode === 1) {
      for (const n of t.players) if (this.playerTeam.get(n) === t) this.playerTeam.delete(n);
      this.teams.delete(p.team);
    }
  }

  formatName(name) {
    const t = this.playerTeam.get(name);
    if (!t) return name;
    const color = TEAM_COLORS[t.color] ? '§' + t.color.toString(16) : '';
    // Profile/score-entry names are plain strings, never JSON components.
    return (t.prefix || '') + '§r' + color + name + '§r' + (t.suffix || '') + '§r';
  }

  tabName(p) {
    if (p.displayName != null) return p.displayName;
    return this.formatName(p.name);
  }

  displayName(uuid, fallback) {
    const p = this.players.get(uuid);
    const name = p ? p.name : fallback;
    if (!name) return null;
    // RendererLivingEntity.canRenderName: the team's nametag visibility, relative to the viewer's own team
    const t = this.playerTeam.get(name);
    if (t) {
      const mine = this.playerTeam.get(this.game.username);
      const v = t.nameTagVisibility;
      if (v === 'never') return null;
      if (v === 'hideForOtherTeams' && mine && mine !== t) return null;
      if (v === 'hideForOwnTeam' && mine && mine === t) return null;
    }
    return this.formatName(name);
  }

  // GuiPlayerTabOverlay ordering: spectators last, then by team, then by name
  sortedPlayers() {
    const arr = [...this.players.values()];
    arr.sort((a, b) => {
      const sa = a.gamemode === 3 ? 1 : 0, sb = b.gamemode === 3 ? 1 : 0;
      if (sa !== sb) return sa - sb;
      const ta = this.playerTeam.get(a.name), tb = this.playerTeam.get(b.name);
      const na = ta ? ta.name : '', nb = tb ? tb.name : '';
      if (na !== nb) return na < nb ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return arr.slice(0, 80);
  }
}
