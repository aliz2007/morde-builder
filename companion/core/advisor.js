// Live situational item advisor — rebuilt around the author's own itemization
// guide (guides.json "itemguide"), not generic stat buckets.
//
// Inputs are fully resolved trait entries (see itemdb.js): champion kits are
// captured in a curated trait table, items in a curated trait database, with
// description-parsing as a fallback for unknown exotics. Everything below is
// deterministic: same game state -> same advice, which is what makes it
// testable and bug-auditable.
//
// Rule sources, by section of the guide:
//   Anti-kite:    Rocketbelt / Rylai's+AV (runaways only) / Cosmic Drive
//   Damage:       Riftmaker (long fights) vs Dusk & Dawn (short fights,
//                 mobile melee, squishies); Liandry's only vs HP stackers;
//                 Bloodletter's rush only vs tank-ratio abusers (K'Sante)
//   Anti-burst:   Kaenic (magic) / Death's Dance (physical) / Sterak's (mixed,
//                 never into Serpent's Fang) / Zhonya's (focused, Olaf)
//   Tank:         Randuin's (crit) / Frozen Heart (attack speed) / FoN (magic
//                 DoT, only when other magic damage exists) / Spirit Visage
//                 (healing sources, enchanter ally) / Abyssal (both teams AP)
//                 / Jak'Sho (already tanky, mixed sustained, NOT vs burst)
//                 / Unending Despair (amp owned, physical dealers, not burst)
//                 / Dead Man's Plate (slow comps) / Thornmail only vs AA
//                 healers as ult target, else Oblivion Orb -> Morello
//   Outliers:     Dark Seal (always fine) / Mejai's (three danger checks)
//   Situational:  Serpent's Fang (shield teams, reluctantly) / GA (stall)

const { lookup } = require('./itemdb');

// --------------------------------------------------------------------------
// Champion kit traits. Curated; kit identities are stable across patches.
const CH = {
  dot: new Set(['Cassiopeia', 'Singed', 'Malzahar', 'Brand', 'Teemo', 'Lillia', 'Swain', 'Aurelion Sol']),
  runaway: new Set(['Dr. Mundo', 'Vladimir', 'Ryze', 'Singed', 'Kayle', 'Zilean']),
  mobileMelee: new Set(['Yasuo', 'Yone', 'Irelia', 'Sylas', 'Ambessa', 'Akali', 'Katarina', 'Fiora',
    'Camille', 'Riven', 'Jax', 'Tryndamere', 'Master Yi', "Bel'Veth", 'Viego', 'Gwen', 'Nilah', 'Briar']),
  healers: new Set(['Soraka', 'Sona', 'Yuumi', 'Nami', 'Milio', 'Aatrox', 'Dr. Mundo', 'Vladimir',
    'Warwick', 'Briar', 'Fiora', 'Illaoi', 'Olaf', 'Swain', 'Sylas', 'Renekton', 'Nasus', 'Kayn',
    'Gwen', 'Trundle', 'Senna', 'Seraphine', 'Volibear', 'Samira', 'Nilah']),
  shielders: new Set(['Janna', 'Lulu', 'Karma', 'Seraphine', 'Sona', 'Milio', 'Yuumi', 'Lux', 'Orianna',
    'Rakan', 'Sett', 'Riven', 'Ambessa', 'Tahm Kench', 'Shen', 'Mordekaiser', 'Camille', 'Vi', 'Blitzcrank']),
  cc: new Set(['Nautilus', 'Leona', 'Morgana', 'Lux', 'Zyra', 'Sejuani', 'Maokai', 'Rammus', 'Lissandra',
    'Veigar', 'Neeko', 'Rell', 'Alistar', 'Thresh', 'Blitzcrank', 'Amumu', 'Galio', 'Twisted Fate',
    'Pantheon', 'Annie', 'Ashe', 'Varus', 'Nami', 'Rakan', 'Leona', 'Braum', 'Seraphine']),
  slows: new Set(['Ashe', 'Anivia', 'Singed', 'Olaf', 'Nasus', 'Zilean', 'Sejuani', 'Maokai',
    'Aurelion Sol', 'Taliyah', 'Janna', 'Senna', 'Gragas', 'Trundle']),
  assassins: new Set(['Zed', 'Talon', 'Katarina', 'Akali', 'Fizz', 'LeBlanc', 'Qiyana', 'Rengar',
    "Kha'Zix", 'Evelynn', 'Shaco', 'Naafiri', 'Briar', 'Nocturne', 'Diana']),
  enchanters: new Set(['Janna', 'Lulu', 'Soraka', 'Sona', 'Yuumi', 'Milio', 'Nami', 'Karma',
    'Seraphine', 'Renata Glasc', 'Taric', 'Senna']),
  tankRatio: new Set(["K'Sante", 'Ornn', 'Sion', 'Cho\'Gath', 'Malphite', 'Rammus']),
  // Tank by KIT, regardless of items — a one-item K'Sante is not "squishy".
  tanks: new Set(["K'Sante", 'Ornn', 'Sion', "Cho'Gath", 'Malphite', 'Maokai', 'Sejuani', 'Nautilus',
    'Leona', 'Alistar', 'Braum', 'Tahm Kench', 'Rammus', 'Zac', 'Dr. Mundo', 'Shen', 'Poppy',
    'Galio', 'Amumu', 'Rell', 'Skarner', 'Gragas']),
  // Bruisers/juggernauts itemize HP and sustain — never count them as squishy either.
  juggernauts: new Set(['Warwick', 'Darius', 'Garen', 'Sett', 'Urgot', 'Mordekaiser', 'Volibear',
    'Trundle', 'Illaoi', 'Nasus', 'Yorick', 'Olaf', 'Aatrox', 'Renekton', 'Wukong', 'Vi', 'Hecarim',
    'Shyvana', 'Udyr', 'Viego', 'Nocturne', 'Xin Zhao', 'Jarvan IV', "Rek'Sai", 'Gnar', 'Kled',
    'Camille', 'Diana', 'Kayn', 'Briar', 'Swain']),
};

const has = (it, f) => (it.flags || []).includes(f);

// Resolve a raw catalog entry ({id, name, price|priceTotal, description?})
// into a trait entry. Curated DB first; description parse as a fallback so
// unknown items still contribute basic stats.
function resolveItem(item) {
  const t = lookup(item.name);
  const price = item.priceTotal ?? item.price ?? 0;
  if (t) return { ...t, id: Number(item.id), price, name: t.name };
  const d = String(item.description || '').replace(/<[^>]*>/g, ' ');
  const num = re => { const m = re.exec(d); return m ? Number(m[1]) : 0; };
  const flags = [];
  if (/grievous wounds/i.test(d)) flags.push('grievous');
  if (/magic penetration/i.test(d)) flags.push('penM');
  if (/critical strike damage.*(reduc|less)/i.test(d)) flags.push('antiCrit');
  return {
    id: Number(item.id), name: item.name, price,
    ad: num(/(\d+)(?:%|\s)*(?:bonus\s+)?Attack Damage/i),
    ap: num(/(\d+)(?:%|\s)*Ability Power/i),
    hp: num(/(\d+)\s*(?:bonus\s+)?Health(?!\s*Regen)/i),
    armor: num(/(\d+)\s*(?:bonus\s+)?Armor(?!\s*Penetration)/i),
    mr: num(/(\d+)\s*(?:bonus\s+)?Magic Resist/i),
    crit: num(/(\d+)%\s*Critical Strike/i),
    as: num(/(\d+)%\s*Attack Speed/i),
    flags,
  };
}

// --------------------------------------------------------------------------
function modelTeam(players) {
  const per = players.map(p => {
    const m = {
      ...p,
      phys: 0, magic: 0, crit: 0, as: 0, burst: 0, dot: 0,
      mr: 0, armor: 0, hp: 0, heal: 0, shield: 0, slow: 0,
      gold: 0,
    };
    for (const it of p.items) {
      m.phys += (it.ad || 0) + (it.crit || 0) * 3 + (it.as || 0) * 1.2;
      m.magic += it.ap || 0;
      m.crit += it.crit || 0;
      m.as += it.as || 0;
      if (has(it, 'burst') || has(it, 'penFlat') || has(it, 'sheen')) m.burst += 1;
      if (has(it, 'dot')) m.dot += 1;
      if (has(it, 'lifesteal') || has(it, 'omnivamp') || has(it, 'enchanter')) m.heal += 1;
      if (has(it, 'shield') || has(it, 'magicShield') || has(it, 'enchanter')) m.shield += 1;
      if (has(it, 'slowApply')) m.slow += 1;
      m.mr += it.mr || 0;
      m.armor += it.armor || 0;
      m.hp += it.hp || 0;
      m.gold += it.price || 0;
    }
    // kit traits
    if (CH.dot.has(p.championName)) m.dot += 2;
    if (CH.healers.has(p.championName)) m.heal += 2;
    if (CH.shielders.has(p.championName)) m.shield += 2;
    if (CH.slows.has(p.championName)) m.slow += 2;
    if (CH.assassins.has(p.championName)) m.burst += 2;
    // power estimate: sunk gold plus kill participation
    m.power = m.gold + (p.kills * 300 + p.assists * 150) / Math.max(1, p.deaths);
    return m;
  });

  const sum = f => per.reduce((s, e) => s + e[f], 0);
  const phys = sum('phys'), magic = sum('magic');
  const total = phys + magic;
  return {
    per,
    phys, magic,
    physShare: total ? phys / total : 0.5,
    burst: sum('burst'),
    sustained: per.reduce((s, e) => s + e.crit + e.as, 0),
    critUsers: per.filter(e => e.crit >= 40).length,
    asUsers: per.filter(e => e.as >= 60 || (e.as >= 35 && e.crit >= 25)).length,
    dotUsers: per.filter(e => e.dot >= 2).length,
    magicUsers: per.filter(e => e.magic >= 60 || CH.dot.has(e.championName)).length,
    healUsers: per.filter(e => e.heal >= 2).length,
    shieldScore: sum('shield'),
    slowUsers: per.filter(e => e.slow >= 2).length,
    ccCount: per.filter(e => CH.cc.has(e.championName)).length,
    mobileMelee: per.filter(e => CH.mobileMelee.has(e.championName)).length,
    runaway: per.filter(e => CH.runaway.has(e.championName)).length,
    mrStackers: per.filter(e => e.mr >= 60).length,
    hpStackers: per.filter(e => e.hp >= 1400).length,
    squishies: per.filter(e => !CH.tanks.has(e.championName) && !CH.juggernauts.has(e.championName)
      && e.hp < 700 && e.mr < 55 && e.armor < 55 && e.items.length >= 2).length,
    kills: per.reduce((s, e) => s + e.kills, 0),
  };
}

const fmt = t => `${t.championName} (${t.kills}/${t.deaths}/${t.assists})`;

// --------------------------------------------------------------------------
function advise({ me, enemies, allies = [], core, pool, gameMinutes = 20 }) {
  const myIds = new Set(me.items.map(i => Number(i.id)));
  const out = { coreDone: true, missingCore: [], recommendations: [], boots: null, notes: [], goldDiff: null, goldVs: null };

  // 0. gold diff vs your lane opponent: your items + pocket gold vs their
  // items (the API only exposes pocket gold for you). Falls back to the
  // strongest enemy when positions aren't assigned (ARAM etc.).
  {
    const priceOf = i => i.priceTotal ?? i.price ?? 0;
    const opp = enemies.find(e => e.position && me.position && e.position === me.position) || enemies[0];
    if (opp) {
      const myWorth = me.items.reduce((s, i) => s + priceOf(i), 0) + (me.currentGold || 0);
      const oppWorth = opp.items.reduce((s, i) => s + priceOf(i), 0);
      out.goldDiff = Math.round(myWorth - oppWorth);
      out.goldVs = opp.championName;
    }
  }

  // 1. core gate
  const completed = me.items.filter(i => (i.price ?? 0) >= 2000).length;
  const missing = core.filter(c => !myIds.has(c.id));
  if (missing.length && completed < 3) {
    out.coreDone = false;
    out.missingCore = missing.map(c => c.name);
    return out;
  }

  const E = modelTeam(enemies);
  const A = modelTeam(allies);
  const score = new Map(), why = new Map();
  const bump = (item, pts, reason) => {
    if (!item || myIds.has(item.id) || has(item, 'boots')) return;
    score.set(item.id, (score.get(item.id) || 0) + pts);
    if (reason) {
      const list = why.get(item.id) || [];
      list.push(reason);
      why.set(item.id, list);
    }
  };
  const pick = (...names) => names.map(n => pool.candidates.find(c => c.name === n)).find(Boolean);
  const picks = (...names) => names.map(n => pool.candidates.find(c => c.name === n)).filter(Boolean);

  const ranked = [...E.per].sort((a, b) => b.power - a.power);
  const avgPower = ranked.reduce((s, e) => s + e.power, 0) / Math.max(1, ranked.length);
  const fed = ranked.filter(e => e.power > avgPower * 1.25 && e.power > 4000);
  const threat = fed[0] || null;
  const enemyHasSerpents = E.per.some(e => e.items.some(i => has(i, 'antiShield')));
  const myFlags = f => me.items.some(i => has(i, f));
  const myTankItems = me.items.filter(i => ((i.armor || 0) + (i.mr || 0)) >= 40 || (i.hp || 0) >= 350).length;
  const iAmFocused = me.deaths >= 5 && me.deaths > me.kills;
  const iAmSnowballing = me.kills >= 6 && me.kills >= me.deaths * 2;
  const teamBehind = E.kills > (A.kills + me.kills) * 1.25;
  const enchanterAlly = allies.some(a => CH.enchanters.has(a.championName)) || A.shieldScore >= 2;

  // ---------------------------------------------------------------- anti-burst
  const burstShare = E.burst / Math.max(1, E.burst + E.sustained / 40);
  const magicBurst = E.per.filter(e => e.burst >= 2 && e.magic >= e.phys).length;
  const physBurst = E.per.filter(e => e.burst >= 2 && e.phys > e.magic).length;
  if (magicBurst >= 2 || (threat && threat.burst >= 3 && threat.magic >= threat.phys)) {
    bump(pick('Kaenic Rookern'), 50, 'absurd magic burst — Kaenic\'s shield eats their rotation (pair with Spirit Visage later)');
  }
  if (physBurst >= 2 || (threat && threat.burst >= 3 && threat.phys > threat.magic)) {
    bump(pick("Death's Dance"), 50, 'absurd physical burst — Ignore Pain bleeds it out (and Serpent\'s Fang can\'t touch it)');
    bump(pick("Zhonya's Hourglass"), 30, 'stasis wastes a burst rotation');
  }
  if (magicBurst >= 1 && physBurst >= 1 && !enemyHasSerpents) {
    bump(pick("Sterak's Gage"), 35, 'mixed burst from both sides — Sterak\'s covers everything (and they have no Serpent\'s Fang)');
  }
  if (iAmFocused) {
    bump(pick("Zhonya's Hourglass"), 40, `you're getting jumped every fight (${me.kills}/${me.deaths}/${me.assists}) — buy time in stasis`);
  }

  // ------------------------------------------------------------- fed threat
  // Order matters: HOW the fed enemy kills you decides the counter, per the
  // guide (AA healers -> Thornmail, crit -> Randuin's, AS -> Frozen Heart,
  // burst -> the anti-burst trio, fed tank -> percent pen and burn).
  if (threat) {
    const label = `${fmt(threat)} is the fed threat — itemize for ${threat.championName}`;
    const aaHealerThreat = threat.heal >= 2 && threat.phys >= threat.magic;
    if (aaHealerThreat) {
      // guide: "if I'm ulting one target and they heal via auto attacks -> Thornmail"
      bump(pick('Thornmail'), 55, `${label} — they heal off every auto; Thornmail turns their sustain against them`);
      bump(pick('Oblivion Orb'), 25, `cheap Grievous until you finish Thornmail for ${threat.championName}`);
    } else if (CH.tankRatio.has(threat.championName) || (threat.hp >= 1400 && threat.phys < 60 && threat.magic < 60)) {
      for (const c of picks("Bloodletter's Curse", 'Void Staff', "Liandry's Torment")) {
        bump(c, 45, `${label} — but a fed tank dies to percent pen and burn, not to resistances`);
      }
    } else if (threat.crit >= 40) bump(pick("Randuin's Omen"), 50, label);
    else if (threat.as >= 60) bump(pick('Frozen Heart'), 50, label);
    else if (threat.magic > threat.phys && threat.burst >= 2) bump(pick('Kaenic Rookern'), 50, label);
    else if (threat.magic > threat.phys) for (const c of picks('Force of Nature', 'Spirit Visage')) bump(c, 45, label);
    else if (threat.burst >= 2) for (const c of picks("Death's Dance", "Zhonya's Hourglass")) bump(c, 45, label);
    else bump(pick('Plated Steelcaps') || pick("Randuin's Omen"), 25, label);
    if (threat.deaths === 0) bump(pick("Zhonya's Hourglass"), 15, `${threat.championName} hasn't died — stasis can waste their all-in`);
    if (teamBehind) bump(pick("Guardian's Angel"), 10, `stall ${threat.championName} in the death realm even after dying`);
  }

  // ------------------------------------------------------- threat patterns
  if (E.critUsers >= 2) bump(pick("Randuin's Omen"), 45, `${E.critUsers} enemies are stacking crit — Randuin's blunts all of it`);
  else if (E.critUsers === 1) bump(pick("Randuin's Omen"), 20, 'one enemy is building heavy crit');

  if (E.asUsers >= 2) bump(pick('Frozen Heart'), 40, `${E.asUsers} attack-speed champions — Frozen Heart slows their whole game down`);

  // magic DoT: Force of Nature only when other magic damage exists too (guide)
  if (E.dotUsers >= 1 && E.magicUsers >= 2) {
    const dotter = E.per.find(e => e.dot >= 2);
    bump(pick('Force of Nature'), 40, `${dotter?.championName || 'their mage'} grinds you down with damage-over-time — FoN stacks against it`);
  }

  // MR need + healing sources or an enchanter -> greedy Visage (guide)
  const mrNeeded = E.magicUsers >= 2 || E.physShare <= 0.4;
  if (mrNeeded && (enchanterAlly || myFlags('omnivamp'))) {
    bump(pick('Spirit Visage'), 35, enchanterAlly
      ? 'your enchanter keeps you alive — Visage amps their healing AND your own'
      : 'you already heal a lot — Visage amps every source of it');
  } else if (mrNeeded && E.physShare <= 0.4) {
    for (const c of picks('Kaenic Rookern', 'Force of Nature', 'Spirit Visage')) bump(c, 25, 'their damage is mostly magic — MR is worth a slot');
  }

  // both teams fling magic -> Abyssal (guide)
  const allyMagic = A.magic >= A.phys && A.magicUsers >= 2;
  if (E.magicUsers >= 2 && allyMagic) {
    bump(pick('Abyssal Mask'), 30, 'both teams are magic-heavy — Abyssal shreds their MR for your whole team');
  }

  // phys-heavy general
  if (E.physShare >= 0.65) {
    for (const c of picks("Randuin's Omen", "Dead Man's Plate", 'Thornmail', 'Frozen Heart')) {
      bump(c, 20, `${Math.round(E.physShare * 100)}% of their damage is physical — armor pulls weight`);
    }
  }

  // ---------------------------------------------------------------- healing
  // Kit healers (Warwick, Aatrox, Volibear...) count even before they buy AS —
  // phys-dominant sustain means they heal off hitting you, per the guide.
  const aaHealer = E.per.find(e => e.heal >= 2 && e.phys >= e.magic && !CH.enchanters.has(e.championName));
  if (aaHealer && (!threat || aaHealer === threat)) {
    bump(pick('Thornmail'), 35, `${aaHealer.championName} heals off hitting you — Thornmail punishes every hit they land`);
  }
  if (E.healUsers >= 2) {
    bump(pick('Morellonomicon'), 40, `${E.healUsers} enemies have serious sustain — spread Grievous Wounds with your AoE`);
    if (gameMinutes < 18) bump(pick('Oblivion Orb'), 25, 'cheap Grievous now, finish Morello later');
  }

  // ---------------------------------------------------------------- shields
  if (E.shieldScore >= 5) {
    bump(pick("Serpent's Fang"), 20, 'they shield EVERYTHING and your team refuses to buy anti-shield — fine, you do it');
  }

  // ------------------------------------------------------------------ slows
  if (E.slowUsers >= 2) {
    bump(pick("Dead Man's Plate"), 35, 'their comp is built on slows — DMP keeps you moving');
  }

  // ------------------------------------------------------------- their build
  if (E.mrStackers >= 2) {
    bump(pick('Void Staff'), 45, `${E.mrStackers} enemies are stacking MR — you need percent penetration`);
    bump(pick("Bloodletter's Curse"), 35, `${E.mrStackers} enemies are stacking MR — shred it for your whole rotation`);
  }
  const tankRatio = E.per.find(e => CH.tankRatio.has(e.championName));
  if (tankRatio) {
    bump(pick("Bloodletter's Curse"), 40, `${tankRatio.championName} scales off tank stats — Bloodletter's guts that`);
  }
  if (E.hpStackers >= 2) {
    bump(pick("Liandry's Torment"), 40, `${E.hpStackers} enemies are stacking health — burn them down by percent`);
    bump(pick('Riftmaker'), 30, 'long fights against a tanky team — Riftmaker ramps and keeps you healed');
  }

  // ------------------------------------------------------- fight length read
  if (E.mobileMelee >= 2) {
    bump(pick('Dusk and Dawn'), 40, `${E.per.filter(e => CH.mobileMelee.has(e.championName)).map(e => e.championName).slice(0, 2).join(' and ')} live on top of you — Dusk & Dawn only needs autos to procc`);
  }
  if (E.squishies >= 4) {
    bump(pick('Dusk and Dawn'), 50, 'nobody on their team builds defense — burst them before fights get long');
    for (const c of picks('Shadowflame', "Nashor's Tooth", 'Hextech Gunblade', "Rabadon's Deathcap")) {
      bump(c, 40, 'all squishy — raw damage ends the game');
    }
  }

  // --------------------------------------------------------------- anti-kite
  if (E.runaway >= 1) {
    const runner = E.per.find(e => CH.runaway.has(e.championName));
    bump(pick("Rylai's Crystal Scepter"), 30, `${runner.championName}'s only win condition is running away — slow them and keep up`);
  }
  if (E.mobileMelee >= 2 || E.runaway >= 1) {
    bump(pick('Hextech Rocketbelt'), 25, 'too much mobility to walk at — the dash closes the gap (and it\'s an auto reset)');
    bump(pick('Cosmic Drive'), 20, 'stay in range without sacking damage');
  }

  // --------------------------------------------------------- late tank logic
  const mixed = E.physShare > 0.35 && E.physShare < 0.65;
  if (myTankItems >= 2 && mixed && burstShare < 0.6) {
    bump(pick("Jak'Sho, The Protean"), 30, 'you\'re already tanky and their damage is mixed AND sustained — Jak\'Sho stacks forever');
  }
  if (!iAmFocused && E.burst < 4 && E.per.filter(e => e.phys > e.magic).length >= 2 && (myFlags('ramping') || myFlags('dot'))) {
    bump(pick('Unending Despair'), 20, 'they can\'t one-shot you after your ult — Despair drains the whole pit');
  }

  // ---------------------------------------------------------------- snowball
  if (iAmSnowballing) {
    const dangerFed = threat && (threat.burst >= 3 || CH.assassins.has(threat.championName));
    const noProtection = !myFlags('stasis');
    const dangerCount = [dangerFed, noProtection, teamBehind].filter(Boolean).length;
    if (dangerCount >= 2) {
      out.notes.push(`Mejai's is tempting at ${me.kills} kills, but skip it: ${[
        dangerFed ? `${threat.championName} can actually kill you` : null,
        noProtection ? 'no Zhonya\'s to protect stacks' : null,
        teamBehind ? 'your team is behind and you\'re the frontline' : null,
      ].filter(Boolean).join(' + ')}`);
    } else {
      bump(pick("Mejai's Soulstealer"), 35, `you're ${me.kills}/${me.deaths} — stack Mejai's and bury them`);
    }
    bump(pick('Dark Seal'), 15, 'gold-efficient while you\'re ahead');
  } else {
    bump(pick('Dark Seal'), 8, 'cheap, efficient, stacks off teamfight AoE');
  }

  // -------------------------------------------------------------------- boots
  const myBoots = me.items.find(i => has(i, 'boots'));
  const boot = (name, reason) => {
    if (!myBoots || myBoots.name !== name) out.boots = { name, why: reason };
  };
  const aaHeavy = E.asUsers >= 2 || E.critUsers >= 2 || (threat && threat.as >= 40);
  if (aaHeavy) boot('Plated Steelcaps', 'heavy auto-attack damage on their team');
  else if (E.ccCount >= 3) boot("Mercury's Treads", `${E.ccCount} enemies with roots/stuns`);
  else if (E.slowUsers >= 2) boot('Boots of Swiftness', 'their comp is built on slows');
  else if (iAmSnowballing) boot('Gluttonous Greaves', 'you\'re snowballing and don\'t need defensive boots');

  // ------------------------------------------------------------------- rank
  out.recommendations = [...score.entries()]
    .map(([id, s]) => {
      const c = pool.candidates.find(x => x.id === id);
      return { id, name: c?.name || `#${id}`, score: s, reasons: [...new Set(why.get(id) || [])].slice(0, 2) };
    })
    .filter(r => r.name && !r.name.startsWith('#'))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 3);
  return out;
}

module.exports = { advise, resolveItem, modelTeam, CH };
