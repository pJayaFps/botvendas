const test = require('node:test');
const assert = require('node:assert/strict');
const { formatCurrency } = require('../src/utils/format');
const { init, db } = require('../src/database');

test('formatCurrency should format BRL', async () => {
  await init();
  const formatted = formatCurrency(199.9);
  assert.match(formatted, /R\$\s?199,90/);
});

test('database should create tables', async () => {
  await init();
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
  assert.equal(table.name, 'products');
});
