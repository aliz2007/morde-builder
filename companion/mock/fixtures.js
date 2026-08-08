const styles = [
  {
    id: 8000, name: 'Precision',
    slots: [
      { type: 'kKeyStone', perks: [8005, 8010, 8021] },
      { type: 'kMixedRegularSplashable', perks: [9101, 9111] },
      { type: 'kMixedRegularSplashable', perks: [9104, 9105, 9103] },
      { type: 'kMixedRegularSplashable', perks: [8014, 8017, 8299] },
      { type: 'kStatMod', perks: [5005, 5008, 5007] },
      { type: 'kStatMod', perks: [5008, 5010, 5007] },
      { type: 'kStatMod', perks: [5011, 5001, 5013] },
    ],
  },
  {
    id: 8400, name: 'Resolve',
    slots: [
      { type: 'kKeyStone', perks: [8437, 8439, 8465] },
      { type: 'kMixedRegularSplashable', perks: [8401, 8446, 8463] },
      { type: 'kMixedRegularSplashable', perks: [8429, 8444, 8473] },
      { type: 'kMixedRegularSplashable', perks: [8451, 8453, 8242] },
      { type: 'kStatMod', perks: [5005, 5008, 5007] },
      { type: 'kStatMod', perks: [5008, 5010, 5007] },
      { type: 'kStatMod', perks: [5011, 5001, 5013] },
    ],
  },
  {
    id: 8200, name: 'Sorcery',
    slots: [
      { type: 'kKeyStone', perks: [8230, 8231, 8229] },
      { type: 'kMixedRegularSplashable', perks: [8275, 8224, 8226] },
      { type: 'kMixedRegularSplashable', perks: [8210, 8234, 8233] },
      { type: 'kMixedRegularSplashable', perks: [8237, 8232, 8236] },
      { type: 'kStatMod', perks: [5005, 5008, 5007] },
      { type: 'kStatMod', perks: [5008, 5010, 5007] },
      { type: 'kStatMod', perks: [5011, 5001, 5013] },
    ],
  },
];

const perks = [
  [8005, 'Press the Attack'], [8010, 'Conqueror'], [8021, 'Fleet Footwork'],
  [9101, 'Absorb Life'], [9111, 'Triumph'],
  [9104, 'Legend: Alacrity'], [9105, 'Legend: Haste'], [9103, 'Legend: Bloodline'],
  [8014, 'Coup de Grace'], [8017, 'Cut Down'], [8299, 'Last Stand'],
  [8437, 'Grasp of the Undying'], [8439, 'Aftershock'], [8465, 'Guardian'],
  [8401, 'Shield Bash'], [8446, 'Demolish'], [8463, 'Font of Life'],
  [8429, 'Conditioning'], [8444, 'Second Wind'], [8473, 'Bone Plating'],
  [8451, 'Overgrowth'], [8453, 'Revitalize'], [8242, 'Unflinching'],
  [8230, "Stormraider's Surge"], [8231, 'Deathfire Touch'], [8229, 'Arcane Comet'],
  [8275, 'Nimbus Cloak'], [8224, 'Nullifying Orb'], [8226, 'Manaflow Band'],
  [8210, 'Transcendence'], [8234, 'Celerity'], [8233, 'Absolute Focus'],
  [8237, 'Scorch'], [8232, 'Waterwalking'], [8236, 'Gathering Storm'],
  [5005, 'Attack Speed'], [5008, 'Adaptive Force'], [5007, 'Ability Haste'],
  [5010, 'Movement Speed'], [5011, 'Health'], [5001, 'Health Scaling'],
  [5013, 'Tenacity and Slow Resist'],
].map(([id, name]) => ({ id, name }));

const items = [
  [1001, 'Boots'], [3076, 'Bramble Vest'], [3047, 'Plated Steelcaps'],
  [3111, "Mercury's Treads"], [3009, 'Boots of Swiftness'],
  [4633, 'Riftmaker'], [4629, 'Cosmic Drive'], [3152, 'Hextech Rocketbelt'],
  [6653, "Liandry's Torment"], [3157, "Zhonya's Hourglass"], [3115, "Nashor's Tooth"],
  [3916, 'Oblivion Orb'], [1082, 'Dark Seal'], [4644, "Rylai's Crystal Scepter"],
  [447101, 'Dusk & Dawn'], [447102, "Bloodletter's Curse"], [447103, 'Kaenic Rookern'],
  [447104, 'Experimental Hexplate'], [447105, 'Gluttonous Greaves'], [447106, "Doran's Helm"],
  [1054, "Doran's Shield"], [1056, "Doran's Ring"], [3082, "Warden's Mail"],
  [1057, 'Negatron Cloak'], [3211, "Spectre's Cowl"], [3065, 'Spirit Visage'],
].map(([id, name]) => ({ id, name }));

const spells = [
  [4, 'Flash'], [14, 'Ignite'], [6, 'Ghost'], [12, 'Teleport'], [21, 'Barrier'], [11, 'Smite'],
].map(([id, name]) => ({ id, name }));

const champions = [
  [266, 'Aatrox', 'Aatrox'], [103, 'Ahri', 'Ahri'], [122, 'Darius', 'Darius'],
  [82, 'Mordekaiser', 'Mordekaiser'], [36, 'Dr. Mundo', 'DrMundo'],
  [62, 'Wukong', 'MonkeyKing'], [145, "Kai'Sa", 'Kaisa'], [24, 'Jax', 'Jax'],
  [86, 'Garen', 'Garen'], [23, 'Tryndamere', 'Tryndamere'], [45, 'Veigar', 'Veigar'],
  [10, 'Kayle', 'Kayle'], [26, 'Zilean', 'Zilean'], [98, 'Shen', 'Shen'],
].map(([id, name, alias]) => ({ id, name, alias }));

module.exports = { styles, perks, items, spells, champions };
