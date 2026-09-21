// Curated item trait database.
//
// The live item catalog's description text is unreliable (some patches ship
// empty descriptions), so the advisor reasons over hand-tagged traits for the
// Bible's item universe and the common enemy items. Tags follow the author's
// own itemization guide (guides.json "itemguide"): what each item is FOR.
//
// Numeric fields: hp, armor, mr, ad, ap, as (attack speed %), crit (%).
// Flags: sheen, onhit, burst, dot, ramping, omnivamp, lifesteal, penM (magic
// penetration), penFlat, haste, shield, magicShield, stasis, revive,
// spellShield, tenacity, antiCrit, antiAS, antiAA, grievous, slowResist, ms,
// dash, slowApply, healAmp, shieldAmp, regen, shredAura, antiShield, ultHaste,
// cheap, stacking, risky, boots, enchanter (heal/shield support item).

const k = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const DB = new Map();
const def = (name, traits) => DB.set(k(name), { name, ...traits });

// ---------------------------------------------------------------- Morde core
def('Riftmaker', { ap: 80, hp: 300, flags: ['omnivamp', 'ramping'] });
def('Dusk and Dawn', { ap: 90, flags: ['sheen', 'burst', 'onhit'] });
def('Dusk & Dawn', { alias: 'Dusk and Dawn' });
def('Hextech Rocketbelt', { ap: 90, hp: 300, flags: ['dash', 'ms', 'haste'] });
def("Rylai's Crystal Scepter", { ap: 75, hp: 400, flags: ['slowApply'] });
def('Cosmic Drive', { ap: 90, flags: ['haste', 'ms'] });
def("Liandry's Torment", { ap: 70, hp: 300, flags: ['dot', 'ramping'] });
def("Bloodletter's Curse", { ap: 70, hp: 400, flags: ['penM', 'ramping'] });
def("Nashor's Tooth", { ap: 100, as: 50, flags: ['onhit'] });
def('Hextech Gunblade', { ap: 90, ad: 40, flags: ['omnivamp'] });
def("Rabadon's Deathcap", { ap: 140, flags: [] });
def('Shadowflame', { ap: 110, flags: ['penM', 'burst'] });
def('Void Staff', { ap: 95, flags: ['penM'] });
def('Experimental Hexplate', { ad: 45, as: 25, flags: ['ultHaste'] });
def('Dark Seal', { ap: 15, flags: ['cheap', 'stacking'] });
def("Mejai's Soulstealer", { ap: 25, flags: ['stacking', 'risky', 'ms'] });

// ---------------------------------------------------------------- anti-burst
def("Zhonya's Hourglass", { ap: 105, armor: 50, flags: ['stasis'] });
def("Banshee's Veil", { ap: 120, mr: 50, flags: ['spellShield'] });
def('Kaenic Rookern', { hp: 350, mr: 80, flags: ['magicShield'] });
def("Sterak's Gage", { hp: 400, flags: ['shield'] });
def("Death's Dance", { armor: 50, ad: 55, flags: ['antiBurst'] });

// --------------------------------------------------------------------- tanks
def("Randuin's Omen", { hp: 400, armor: 60, flags: ['antiCrit'] });
def('Frozen Heart', { armor: 80, flags: ['antiAS', 'haste'] });
def('Thornmail', { hp: 350, armor: 70, flags: ['grievous', 'antiAA'] });
def('Bramble Vest', { armor: 35, flags: ['grievous', 'cheap'] });
def('Spirit Visage', { hp: 400, mr: 50, flags: ['healAmp', 'shieldAmp'] });
def('Force of Nature', { hp: 350, mr: 60, flags: ['ms', 'antiDot'] });
def('Abyssal Mask', { hp: 350, mr: 60, flags: ['shredAura'] });
def("Jak'Sho, The Protean", { hp: 300, armor: 50, mr: 50, flags: ['ramping'] });
def('Unending Despair', { hp: 400, armor: 50, flags: ['omnivamp'] });
def("Dead Man's Plate", { hp: 300, armor: 50, flags: ['ms', 'slowResist'] });
def("Warmog's Armor", { hp: 1000, flags: ['regen'] });
def("Guardian's Angel", { ad: 55, armor: 45, flags: ['revive'] });

// ------------------------------------------------------------- situational
def('Oblivion Orb', { ap: 30, flags: ['grievous', 'cheap'] });
def('Morellonomicon', { ap: 90, hp: 300, flags: ['grievous'] });
def("Serpent's Fang", { ad: 55, flags: ['antiShield', 'penFlat'] });

// --------------------------------------------------------------------- boots
def('Plated Steelcaps', { armor: 20, flags: ['boots', 'antiAA'] });
def("Mercury's Treads", { mr: 25, flags: ['boots', 'tenacity'] });
def('Boots of Swiftness', { flags: ['boots', 'ms', 'slowResist'] });
def('Gluttonous Greaves', { flags: ['boots', 'ms', 'omnivamp'] });
def("Sorcerer's Shoes", { flags: ['boots', 'penM'] });

// ------------------------------------------------- enemy items (scouting)
// physical sustained / crit
def('Infinity Edge', { ad: 70, crit: 20, flags: [] });
def('The Collector', { ad: 60, crit: 25, flags: ['penFlat'] });
def('Yun Tal Wildarrows', { ad: 60, crit: 25, flags: ['as'] });
def('Phantom Dancer', { as: 45, crit: 25, flags: ['ms'] });
def('Statikk Shiv', { as: 35, crit: 25, flags: [] });
def('Rapid Firecannon', { as: 30, crit: 25, flags: [] });
def("Runaan's Hurricane", { as: 40, crit: 25, flags: [] });
def('Navori Flickerblade', { as: 30, crit: 25, flags: ['haste'] });
def('Essence Reaver', { ad: 65, crit: 25, flags: ['sheen'] });
def('Immortal Shieldbow', { ad: 55, crit: 25, flags: ['shield', 'lifesteal'] });
def("Lord Dominik's Regards", { ad: 45, crit: 25, flags: ['penFlat'] });
def('Bloodthirster', { ad: 80, flags: ['lifesteal'] });
def('Mercurial Scimitar', { ad: 65, crit: 25, mr: 30, flags: ['tenacity'] });
// physical sustained / on-hit
def('Kraken Slayer', { ad: 40, as: 35, flags: ['onhit'] });
def('Blade of the Ruined King', { ad: 40, as: 30, flags: ['onhit', 'lifesteal'] });
def("Guinsoo's Rageblade", { as: 40, flags: ['onhit'] });
def("Wit's End", { as: 40, mr: 40, flags: ['onhit'] });
def('Terminus', { ad: 35, as: 35, flags: ['penFlat'] });
def('Trinity Force', { ad: 40, as: 33, hp: 300, flags: ['sheen', 'haste'] });
def('Hullbreaker', { ad: 65, hp: 400, flags: [] });
// physical burst / lethality
def('Eclipse', { ad: 60, flags: ['burst', 'shield', 'penFlat'] });
def("Youmuu's Ghostblade", { ad: 60, flags: ['burst', 'penFlat', 'ms'] });
def('Opportunity', { ad: 55, flags: ['burst', 'penFlat'] });
def('Hubris', { ad: 65, flags: ['burst', 'penFlat'] });
def('Voltaic Cyclosword', { ad: 55, flags: ['burst', 'penFlat'] });
def('Profane Hydra', { ad: 65, flags: ['burst', 'penFlat'] });
def('Ravenous Hydra', { ad: 70, flags: ['lifesteal'] });
def('Titanic Hydra', { ad: 40, hp: 500, flags: [] });
def('Spear of Shojin', { ad: 55, hp: 400, flags: ['haste', 'ramping'] });
def('Black Cleaver', { ad: 55, hp: 400, flags: ['haste'] });
def('Sundered Sky', { ad: 55, hp: 400, flags: ['lifesteal'] });
def('Maw of Malmortius', { ad: 65, mr: 50, flags: ['magicShield'] });
// magic burst
def("Luden's Companion", { ap: 100, flags: ['burst', 'haste'] });
def('Stormsurge', { ap: 100, flags: ['burst', 'penM'] });
def('Lich Bane', { ap: 100, flags: ['sheen', 'burst', 'ms'] });
def('Horizon Focus', { ap: 110, flags: ['burst'] });
def('Cryptbloom', { ap: 90, flags: ['penM'] });
// magic dot / sustained
def('Blackfire Torch', { ap: 90, flags: ['dot', 'haste'] });
def('Malignance', { ap: 90, flags: ['dot', 'haste'] });
def('Rod of Ages', { ap: 100, hp: 800, flags: ['ramping'] });
def("Seraph's Embrace", { ap: 90, flags: ['shield', 'haste'] });
// enemy tank items
def('Heartsteel', { hp: 900, flags: [] });
def('Sunfire Aegis', { hp: 450, armor: 50, flags: ['dot'] });
def('Hollow Radiance', { hp: 500, mr: 50, flags: ['dot'] });
def("Knight's Vow", { hp: 300, armor: 40, flags: [] });
def("Zeke's Convergence", { hp: 300, armor: 40, flags: [] });
def('Locket of the Iron Solari', { hp: 200, armor: 30, mr: 30, flags: ['shield'] });
// enchanter items (healing/shielding power)
def('Moonstone Renewer', { flags: ['enchanter'] });
def('Redemption', { hp: 250, flags: ['enchanter'] });
def('Ardent Censer', { flags: ['enchanter'] });
def('Staff of Flowing Water', { flags: ['enchanter'] });
def("Mikael's Blessing", { flags: ['enchanter'] });
def("Shurelya's Battlesong", { flags: ['enchanter', 'ms'] });
def('Echoes of Helia', { flags: ['enchanter'] });
def('Dawncore', { flags: ['enchanter'] });

function lookup(name) {
  const hit = DB.get(k(String(name || '')));
  if (!hit) return null;
  if (hit.alias) return DB.get(k(hit.alias)) || null;
  return hit;
}

module.exports = { lookup, DB };
