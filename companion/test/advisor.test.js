const { test } = require('node:test');
const assert = require('node:assert');
const { advise, resolveItem } = require('../core/advisor');

// Build a trait entry straight from the curated DB (ids are stable per name,
// so "already built" exclusions compare correctly).
const idByName = new Map();
const I = name => {
  const t = resolveItem({ id: 0, name, priceTotal: 3000 });
  assert.ok(t, `${name} missing from the item DB`);
  if (!idByName.has(name)) idByName.set(name, idByName.size + 1);
  return { ...t, id: idByName.get(name), price: 3000 };
};

// The candidate pool = the author's whole universe.
const POOL_NAMES = [
  'Hextech Rocketbelt', "Rylai's Crystal Scepter", 'Cosmic Drive',
  'Riftmaker', 'Dusk and Dawn', "Liandry's Torment", "Bloodletter's Curse",
  "Nashor's Tooth", 'Hextech Gunblade', "Rabadon's Deathcap", 'Shadowflame', 'Void Staff',
  "Zhonya's Hourglass", "Banshee's Veil", 'Kaenic Rookern', "Sterak's Gage", "Death's Dance",
  "Randuin's Omen", 'Frozen Heart', 'Thornmail', 'Spirit Visage', 'Force of Nature',
  'Abyssal Mask', "Jak'Sho, The Protean", 'Unending Despair', "Dead Man's Plate",
  "Warmog's Armor", "Guardian's Angel", 'Oblivion Orb', 'Morellonomicon', "Serpent's Fang",
  'Dark Seal', "Mejai's Soulstealer", 'Experimental Hexplate',
  'Plated Steelcaps', "Mercury's Treads", 'Boots of Swiftness', 'Gluttonous Greaves',
];
const POOL = { candidates: POOL_NAMES.map(I) };

const CORE = [{ id: I('Riftmaker').id, name: 'Riftmaker' }, { id: I('Cosmic Drive').id, name: 'Cosmic Drive' }];

const P = (championName, items, k = 1, d = 2, a = 2, position = 'MIDDLE') => ({
  championName, position, level: 14,
  kills: k, deaths: d, assists: a, cs: 150,
  items: items.map(I),
});
const ME = (items = ['Riftmaker', 'Cosmic Drive', "Jak'Sho, The Protean"], k = 3, d = 2, a = 5) => ({
  position: 'TOP', level: 15, kills: k, deaths: d, assists: a, items: items.map(I),
});
const run = (enemies, me = ME(), allies = []) =>
  advise({ me, enemies, allies, core: CORE, pool: POOL, gameMinutes: 22 });
const names = out => out.recommendations.map(r => r.name);

const five = p => p; // readability

test('unfinished core just tells you to finish it', () => {
  const out = run([P('Aatrox', [])], ME([], 0, 0, 0));
  assert.equal(out.coreDone, false);
  assert.deepEqual(out.missingCore, ['Riftmaker', 'Cosmic Drive']);
});

test('guide rule: lots of crit -> Randuin\'s', () => {
  const out = run(five([
    P('Ashe', ['Infinity Edge', 'The Collector']),
    P('Yasuo', ['Infinity Edge', 'Yun Tal Wildarrows']),
    P('Ahri', ["Luden's Companion"]), P('Lux', ["Luden's Companion"]), P('Jhin', ['Hubris']),
  ]));
  assert.ok(names(out).includes("Randuin's Omen"), `got ${names(out)}`);
});

test('guide rule: attack speed champions -> Frozen Heart', () => {
  const out = run(five([
    P('Master Yi', ['Kraken Slayer', "Guinsoo's Rageblade"], 2, 2, 1),
    P('Kog\'Maw', ['Kraken Slayer', "Guinsoo's Rageblade"], 2, 2, 1),
    P('Ahri', ["Luden's Companion"]), P('Lux', ["Luden's Companion"]), P('Nautilus', ['Heartsteel']),
  ]));
  assert.ok(names(out).includes('Frozen Heart'), `got ${names(out)}`);
});

test('guide rule: absurd magic burst -> Kaenic Rookern', () => {
  const out = run(five([
    P('LeBlanc', ["Luden's Companion", 'Stormsurge', 'Shadowflame'], 6, 1, 3),
    P('Syndra', ["Luden's Companion", 'Stormsurge'], 3, 1, 2),
    P('Jinx', ['Kraken Slayer']), P('Nautilus', ['Heartsteel']), P('Lee Sin', ['Eclipse']),
  ]));
  assert.ok(names(out).includes('Kaenic Rookern'), `got ${names(out)}`);
});

test('guide rule: absurd physical burst -> Death\'s Dance', () => {
  const out = run(five([
    P('Zed', ['Eclipse', "Youmuu's Ghostblade", 'Hubris'], 6, 1, 2),
    P('Talon', ['Eclipse', 'Opportunity'], 3, 1, 1),
    P('Ahri', ["Luden's Companion"]), P('Jinx', ['Kraken Slayer']), P('Nautilus', ['Heartsteel']),
  ]));
  assert.ok(names(out).includes("Death's Dance"), `got ${names(out)}`);
});

test('guide rule: Sterak\'s for mixed burst, but never into Serpent\'s Fang', () => {
  const mixed = [
    P('Zed', ['Eclipse', "Youmuu's Ghostblade"], 2, 2, 2),
    P('LeBlanc', ["Luden's Companion", 'Stormsurge'], 2, 2, 2),
    P('Jinx', ['Kraken Slayer', 'Phantom Dancer'], 2, 2, 2),
    P('Nautilus', ['Heartsteel', "Warmog's Armor"], 2, 2, 2, 'UTILITY'),
    P('Orianna', ['Rod of Ages', "Seraph's Embrace"], 2, 2, 2),
  ];
  const out = run(mixed.map(p => ({ ...p })));
  assert.ok(names(out).includes("Sterak's Gage"), `got ${names(out)}`);

  const withFang = mixed.map(p => ({ ...p }));
  withFang[2] = P('Jinx', ["Serpent's Fang", 'Kraken Slayer'], 2, 2, 2);
  const out2 = run(withFang);
  assert.ok(!names(out2).includes("Sterak's Gage"), `Sterak's offered into Serpent's: ${names(out2)}`);
});

test('guide rule: magic DoT with other magic present -> Force of Nature', () => {
  const out = run(five([
    P('Cassiopeia', ["Liandry's Torment", 'Rod of Ages'], 2, 1, 2, 'TOP'),
    P('Syndra', ["Luden's Companion", 'Shadowflame']),
    P('Jinx', ['Kraken Slayer', 'Phantom Dancer']), P('Nautilus', ['Heartsteel']), P('Lee Sin', ['Eclipse']),
  ]));
  assert.ok(names(out).includes('Force of Nature'), `got ${names(out)}`);
});

test('guide rule: enchanter ally makes Spirit Visage greedy-good', () => {
  const enemies = [
    P('Ahri', ["Luden's Companion", 'Shadowflame']),
    P('Lux', ["Luden's Companion", 'Shadowflame']),
    P('Jinx', ['Kraken Slayer']), P('Nautilus', ['Heartsteel']), P('Lee Sin', ['Eclipse']),
  ];
  const out = run(enemies, ME(), [P('Soraka', ['Moonstone Renewer', 'Redemption'], 0, 1, 8, 'UTILITY')]);
  assert.ok(names(out).includes('Spirit Visage'), `got ${names(out)}`);
});

test('guide rule: both teams magic-heavy -> Abyssal Mask', () => {
  const out = run(
    [P('Ahri', ["Luden's Companion", 'Shadowflame']), P('Lux', ["Luden's Companion", 'Shadowflame']),
     P('Jinx', ['Kraken Slayer']), P('Nautilus', ['Heartsteel']), P('Lee Sin', ['Eclipse'])],
    ME(),
    [P('Syndra', ["Luden's Companion", 'Shadowflame']), P('Brand', ["Liandry's Torment", 'Rylai\'s Crystal Scepter'])],
  );
  assert.ok(names(out).includes('Abyssal Mask'), `got ${names(out)}`);
});

test('guide rule: widespread healing -> Morellonomicon, AA healer -> Thornmail', () => {
  const out = run(five([
    P('Soraka', ['Moonstone Renewer', 'Redemption'], 0, 1, 9, 'UTILITY'),
    P('Aatrox', ['Sundered Sky', 'Death\'s Dance'], 3, 1, 2, 'TOP'),
    P('Jinx', ['Bloodthirster', 'Kraken Slayer']), P('Ahri', ["Luden's Companion"]), P('Lee Sin', ['Eclipse']),
  ]));
  assert.ok(names(out).includes('Morellonomicon') || names(out).includes('Thornmail'), `got ${names(out)}`);
});

test('guide rule: MR stackers -> Void Staff / Bloodletter\'s', () => {
  const out = run(five([
    P('Galio', ['Kaenic Rookern', 'Force of Nature'], 1, 2, 5, 'TOP'),
    P('Leona', ['Kaenic Rookern', 'Locket of the Iron Solari'], 0, 2, 6, 'UTILITY'),
    P('Jinx', ['Kraken Slayer', 'Phantom Dancer']), P('Ahri', ["Luden's Companion"]), P('Lee Sin', ['Eclipse']),
  ]));
  assert.ok(names(out).includes('Void Staff') || names(out).includes("Bloodletter's Curse"), `got ${names(out)}`);
});

test('guide rule: K\'Sante -> Bloodletter\'s Curse', () => {
  const out = run(five([
    P("K'Sante", ['Heartsteel', "Jak'Sho, The Protean"], 2, 1, 3, 'TOP'),
    P('Jinx', ['Kraken Slayer']), P('Ahri', ["Luden's Companion"]), P('Nautilus', ['Heartsteel']), P('Lee Sin', ['Eclipse']),
  ]));
  assert.ok(names(out).includes("Bloodletter's Curse"), `got ${names(out)}`);
});

test('guide rule: HP stackers -> Liandry\'s and Riftmaker', () => {
  const out = run(five([
    P('Sion', ['Heartsteel', "Warmog's Armor"], 1, 3, 2, 'TOP'),
    P('Dr. Mundo', ['Heartsteel', "Warmog's Armor"], 1, 2, 2, 'JUNGLE'),
    P('Jinx', ['Kraken Slayer', 'Phantom Dancer']), P('Ahri', ["Luden's Companion"]), P('Nautilus', ['Heartsteel']),
  ]));
  assert.ok(names(out).includes("Liandry's Torment"), `got ${names(out)}`);
});

test('guide rule: in-your-face mobile melee -> Dusk & Dawn', () => {
  const out = run(five([
    P('Yasuo', ['Blade of the Ruined King', 'Immortal Shieldbow'], 3, 2, 1, 'TOP'),
    P('Irelia', ['Blade of the Ruined King', 'Trinity Force'], 2, 2, 2),
    P('Yone', ['Blade of the Ruined King', 'Immortal Shieldbow'], 2, 2, 1, 'JUNGLE'),
    P('Jinx', ['Kraken Slayer']), P('Nautilus', ['Heartsteel']),
  ]));
  assert.ok(names(out).includes('Dusk and Dawn'), `got ${names(out)}`);
});

test('guide rule: runaway champ -> Rylai\'s', () => {
  const out = run(five([
    P('Dr. Mundo', ['Heartsteel', 'Spirit Visage'], 2, 1, 3, 'TOP'),
    P('Vladimir', ['Riftmaker', "Zhonya's Hourglass"]),
    P('Jinx', ['Kraken Slayer', 'Phantom Dancer']), P('Nautilus', ['Heartsteel']), P('Lee Sin', ['Eclipse']),
  ]));
  assert.ok(names(out).includes("Rylai's Crystal Scepter"), `got ${names(out)}`);
});

test('guide rule: squishy team -> burst damage, not tank items', () => {
  const out = run(five([
    P('Jinx', ['Infinity Edge', 'The Collector'], 1, 3, 1),
    P('Yasuo', ['Infinity Edge', 'Yun Tal Wildarrows'], 1, 3, 1, 'TOP'),
    P('Ahri', ["Luden's Companion", 'Shadowflame'], 1, 3, 1),
    P('Lux', ["Luden's Companion", 'Shadowflame'], 1, 3, 1),
    P('Brand', ["Liandry's Torment", 'Rylai\'s Crystal Scepter'], 1, 3, 1, 'UTILITY'),
  ]));
  const dmg = new Set(['Dusk and Dawn', "Nashor's Tooth", 'Hextech Gunblade', "Rabadon's Deathcap", 'Shadowflame']);
  assert.ok(dmg.has(out.recommendations[0].name), `top pick was ${out.recommendations[0].name}`);
});

test('guide rule: fed assassin draws Zhonya\'s / Death\'s Dance by name', () => {
  const out = run(five([
    P('Zed', ['Eclipse', "Youmuu's Ghostblade", 'Hubris', 'Opportunity'], 11, 0, 2),
    P('Ahri', ["Luden's Companion"]), P('Jinx', ['Kraken Slayer']), P('Nautilus', ['Heartsteel']), P('Lux', ["Luden's Companion"]),
  ]));
  const top = out.recommendations[0];
  assert.ok(["Zhonya's Hourglass", "Death's Dance"].includes(top.name), `got ${top.name}`);
  assert.ok(top.reasons.join(' ').includes('Zed'), `reason missing threat: ${top.reasons}`);
});

test('guide rule: Mejai\'s when snowballing safely, warning when not', () => {
  const safe = run(
    [P('Jinx', ['Kraken Slayer', 'Phantom Dancer']), P('Ahri', ["Luden's Companion"]),
     P('Lux', ["Luden's Companion"]), P('Nautilus', ['Heartsteel']), P('Lee Sin', ['Eclipse'])],
    ME(['Riftmaker', 'Cosmic Drive', "Zhonya's Hourglass"], 8, 1, 4),
    [P('Jinx', ['Infinity Edge'], 7, 1, 2), P('Soraka', ['Moonstone Renewer'], 0, 1, 12)],
  );
  assert.ok(names(safe).includes("Mejai's Soulstealer"), `no Mejai's in ${names(safe)}`);

  const danger = run(
    [P('Zed', ['Eclipse', "Youmuu's Ghostblade", 'Hubris', 'Opportunity'], 12, 0, 1),
     P('Ahri', ["Luden's Companion"]), P('Jinx', ['Kraken Slayer']), P('Nautilus', ['Heartsteel']), P('Lux', ["Luden's Companion"])],
    ME(['Riftmaker', 'Cosmic Drive', 'Dark Seal'], 7, 2, 2),
  );
  assert.ok(!names(danger).includes("Mejai's Soulstealer"), `Mejai's offered into fed Zed`);
  assert.ok(danger.notes.some(n => n.includes("Mejai's")), 'expected a Mejai warning note');
});

test('guide rule: Jak\'Sho only when already tanky vs mixed sustained', () => {
  const enemies = [
    P('Jinx', ['Kraken Slayer', 'Infinity Edge'], 2, 2, 2),
    P('Ahri', ["Liandry's Torment", 'Blackfire Torch'], 2, 2, 2),
    P('Nautilus', ['Heartsteel', "Warmog's Armor"], 0, 2, 4, 'UTILITY'),
    P('Lee Sin', ['Sundered Sky', 'Black Cleaver'], 2, 2, 2, 'JUNGLE'),
    P('Lux', ["Luden's Companion", 'Horizon Focus'], 2, 2, 2),
  ];
  const tankyMe = ME(['Riftmaker', 'Cosmic Drive', "Randuin's Omen", 'Spirit Visage'], 3, 2, 5);
  const out = run(enemies.map(p => ({ ...p })), tankyMe);
  assert.ok(names(out).includes("Jak'Sho, The Protean"), `got ${names(out)}`);

  const squishyMe = ME(['Riftmaker', 'Cosmic Drive', 'Dark Seal'], 3, 2, 5);
  const out2 = run(enemies, squishyMe);
  assert.ok(!names(out2).includes("Jak'Sho, The Protean"), 'Jak\'Sho offered without tank items');
});

test('boots follow the guide: AA-heavy -> Steelcaps, CC-heavy -> Mercs', () => {
  const aa = run([
    P('Master Yi', ['Kraken Slayer', "Guinsoo's Rageblade"]),
    P('Jinx', ['Infinity Edge', 'Phantom Dancer']),
    P('Ahri', ["Luden's Companion"]), P('Lux', ["Luden's Companion"]), P('Nautilus', ['Heartsteel']),
  ], ME(['Riftmaker', 'Cosmic Drive', 'Dark Seal']));
  assert.equal(aa.boots?.name, 'Plated Steelcaps');

  const cc = run([
    P('Nautilus', ['Heartsteel']), P('Leona', ['Locket of the Iron Solari']),
    P('Morgana', ["Liandry's Torment"]), P('Sejuani', ['Heartsteel']), P('Jinx', ['Kraken Slayer']),
  ], ME(['Riftmaker', 'Cosmic Drive', 'Dark Seal']));
  assert.equal(cc.boots?.name, "Mercury's Treads");
});

test('items you already built are never recommended', () => {
  const out = run([
    P('Ashe', ['Infinity Edge', 'The Collector']),
    P('Yasuo', ['Infinity Edge', 'Yun Tal Wildarrows']),
    P('Ahri', ["Luden's Companion"]), P('Lux', ["Luden's Companion"]), P('Jhin', ['Hubris']),
  ], ME(['Riftmaker', 'Cosmic Drive', "Randuin's Omen"]));
  assert.ok(!names(out).includes("Randuin's Omen"));
  assert.ok(!names(out).includes('Riftmaker'));
});

// Regression: the exact game that produced bad advice — fed Warwick plus
// K'Sante must NOT read as "all squishy -> damage" and must NOT pick Frozen
// Heart when the fed threat is a kit healer.
test('regression: fed Warwick vs Vayne/K\'Sante/Senna/Diana -> Thornmail, not D&D/Gunblade/Frozen Heart', () => {
  const out = run(five([
    P('Vayne', ['Kraken Slayer', "Guinsoo's Rageblade"], 2, 2, 3, 'TOP'),
    P('Warwick', ['Sundered Sky', 'Titanic Hydra'], 8, 1, 4, 'JUNGLE'),
    P("K'Sante", ['Heartsteel', "Jak'Sho, The Protean"], 1, 2, 2, 'MIDDLE'),
    P('Senna', ['Echoes of Helia', 'Moonstone Renewer'], 1, 3, 9, 'UTILITY'),
    P('Diana', ['Stormsurge', "Zhonya's Hourglass"], 3, 2, 3, 'JUNGLE'),
  ]));
  assert.equal(out.recommendations[0]?.name, 'Thornmail', `top pick was ${names(out)}`);
  assert.ok(
    names(out).includes("Bloodletter's Curse") || names(out).includes('Morellonomicon'),
    `expected pen/grievous in top 3, got ${names(out)}`,
  );
  for (const bad of ['Dusk and Dawn', 'Hextech Gunblade', 'Frozen Heart']) {
    assert.ok(!names(out).includes(bad), `${bad} should not be recommended here: ${names(out)}`);
  }
});

test('gold diff: your items + pocket gold vs lane opponent items', () => {
  const me = { ...ME(), currentGold: 500 };
  const out = run([
    P('Vayne', ['Kraken Slayer', "Guinsoo's Rageblade"], 2, 2, 3, 'TOP'),
    P('Warwick', ['Sundered Sky'], 1, 1, 1, 'JUNGLE'),
  ], me);
  assert.equal(out.goldVs, 'Vayne');
  assert.equal(out.goldDiff, 3 * 3000 + 500 - 2 * 3000); // +3500
});

test('gold diff: the picked matchup wins over position and list order', () => {
  const me = { ...ME(), currentGold: 0 };
  const enemies = [
    P('Vayne', ['Kraken Slayer', "Guinsoo's Rageblade"], 2, 2, 3, 'TOP'),   // position match, listed first
    P('Warwick', ['Sundered Sky'], 1, 1, 1, 'JUNGLE'),                       // picked matchup
  ];
  const out = advise({ me, enemies, allies: [], core: CORE, pool: POOL, gameMinutes: 22, laneOpponent: 'Warwick' });
  assert.equal(out.goldVs, 'Warwick');
  assert.equal(out.goldDiff, 3 * 3000 - 3000); // vs Warwick's single item, not Vayne's two
});
