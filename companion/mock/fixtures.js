const catalog = require('./catalog.json');

module.exports = {
  patch: catalog.patch,
  styles: catalog.styles,
  perks: catalog.perks,
  items: catalog.items,
  spells: catalog.spells,
  champions: catalog.champions,
};
