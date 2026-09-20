// Mirrors the kStatMod slots the live client serves in perkstyles.json
// (verified against rcp-be-lol-game-data .../v1/perkstyles.json + perks.json).
// Row 2 is Adaptive Force / Move Speed / Health Scaling — not Ability Haste —
// and the client names 5010 "Move Speed", not "Movement Speed".
const slots = [
  { type: 'kStatMod', perks: [5008, 5005, 5007] },
  { type: 'kStatMod', perks: [5008, 5010, 5001] },
  { type: 'kStatMod', perks: [5011, 5013, 5001] },
];

const perks = [
  [5001, 'Health Scaling'],
  [5005, 'Attack Speed'],
  [5007, 'Ability Haste'],
  [5008, 'Adaptive Force'],
  [5010, 'Move Speed'],
  [5011, 'Health'],
  [5013, 'Tenacity and Slow Resist'],
].map(([id, name]) => ({ id, name }));

module.exports = { slots, perks };
