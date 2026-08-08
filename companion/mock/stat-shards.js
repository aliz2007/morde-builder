const slots = [
  { type: 'kStatMod', perks: [5005, 5008, 5007] },
  { type: 'kStatMod', perks: [5008, 5010, 5007] },
  { type: 'kStatMod', perks: [5011, 5001, 5013] },
];

const perks = [
  [5001, 'Health Scaling'],
  [5005, 'Attack Speed'],
  [5007, 'Ability Haste'],
  [5008, 'Adaptive Force'],
  [5010, 'Movement Speed'],
  [5011, 'Health'],
  [5013, 'Tenacity and Slow Resist'],
].map(([id, name]) => ({ id, name }));

module.exports = { slots, perks };
