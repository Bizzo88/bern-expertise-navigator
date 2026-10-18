// Optional UI checks: install jsdom@26 outside the repo and set NODE_PATH to its node_modules.
// Run: node --test src/tests/ui-workspace.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { JSDOM } = require('jsdom');
const source = readFileSync(require('node:path').join(__dirname, '../app/navigator/static/app.js'), 'utf8');
const requests = [
  { id: 'a', company: 'Alpha <Sensors>', summary: 'Glucose monitoring', country: 'Germany', status: 'new', updated_at: '2026-10-18', has_brief: false },
  { id: 'b', company: 'Beta AG', summary: 'Cardiac devices', city: 'Bern', country: 'Switzerland', status: 'new', updated_at: '2026-10-18', has_brief: true },
];
async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail('UI did not reach the expected state');
}
function app(t, { lang = 'en', hash = '/staff/requests', fetcher } = {}) {
  const dom = new JSDOM('<header id="topbar"></header><main id="view"></main><footer id="foot"></footer><div id="toast"></div>', {
    url: `https://navigator.test/#${hash}`, runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.localStorage.setItem('nav-staff', JSON.stringify({ name: 'Demo officer', email: '', team: '' }));
  w.localStorage.setItem('nav-lang', JSON.stringify(lang));
  w.matchMedia = () => ({ matches: false });
  w.scrollTo = () => {};
  w.fetch = async (url, options) => {
    const result = fetcher ? await fetcher(url, options) : undefined;
    if (result !== undefined) return result;
    return { ok: true, json: async () => url === '/cases' ? requests : [] };
  };
  w.eval(source);
  return w;
}
test('lead search filters by company, need and location; clearing restores cards', async (t) => {
  const w = app(t), d = w.document;
  await until(() => d.querySelector('#requestFilter'));
  const input = d.querySelector('#requestFilter');
  const search = (q) => { input.value = q; input.dispatchEvent(new w.Event('input')); };
  assert.equal(d.querySelectorAll('.case-card').length, 2);
  for (const q of ['ALPHA', ' glucose ', 'Germany', 'Bern']) {
    search(q);
    assert.equal(d.querySelectorAll('.case-card').length, 1, q);
    assert.equal(d.querySelector('#requestCount').textContent, '1 of 2 requests');
  }
  search('unknown');
  assert.equal(d.querySelectorAll('.case-card').length, 0);
  assert.match(d.querySelector('#requestBoard').textContent, /Try another search/);
  search('');
  assert.equal(d.querySelectorAll('.case-card').length, 2);
  assert.equal(d.querySelector('.case-card h3').textContent, 'Alpha <Sensors>');
  assert.equal(d.querySelector('.case-card h3').children.length, 0);
});
for (const [lang, label] of [['en', 'Find a company request'], ['de', 'Firmenanfrage finden'], ['fr', 'Trouver une demande']]) {
  test(`request filter is localized in ${lang}`, async (t) => {
    const w = app(t, { lang });
    await until(() => w.document.querySelector('#requestFilter'));
    assert.equal(w.document.querySelector('label[for="requestFilter"]').textContent, label);
  });
}
test('failed case loading shows an error instead of an empty board and can recover', async (t) => {
  let failed = true;
  const w = app(t, { fetcher: async (url) => {
    if (url === '/cases' && failed) return { ok: false, status: 503, json: async () => ({ detail: 'Temporarily unavailable' }) };
  } });
  await until(() => w.document.querySelector('#retryCases'));
  assert.match(w.document.querySelector('[role="alert"]').textContent, /Temporarily unavailable/);
  assert.equal(w.document.querySelector('.kpis'), null);
  failed = false;
  w.document.querySelector('#retryCases').click();
  await until(() => w.document.querySelector('#requestFilter'));
  assert.equal(w.document.querySelectorAll('.case-card').length, 2);
});

function companyCase() {
  return {
    ...requests[0], created_at: '2026-10-18', contact_name: '', contact_email: '', events: [],
    analysis: { summary: 'Glucose monitoring', company_does: 'Sensors', company_needs: ['Study partner'], search_query: 'sensors' },
    matches: [{ id: 'partner', name: 'Research partner', selected: true, archetype: 'research', entity_type: 'unit', institution: 'Bern', url: 'https://example.org', why: 'Sensors' }],
    outreach: { brief: { token: 'existing', at: '2026-10-18', lang: 'en', explainer: [], data: { hook: 'Original pitch', items: [], sources: [] } } },
  };
}
test('pitch generation announces progress, preserves previous output on failure, and allows retry', async (t) => {
  const c = companyCase();
  let rejectPitch;
  const w = app(t, { hash: '/staff/case/a', fetcher: async (url) => {
    if (url === '/cases/a') return { ok: true, json: async () => c };
    if (url === '/cases/a/brief') return new Promise((resolve) => { rejectPitch = () => resolve({ ok: false, status: 503, json: async () => ({ detail: 'Please retry later' }) }); });
  } });
  const d = w.document;
  await until(() => d.querySelector('#prepBrief'));
  assert.match(d.querySelector('#pitchBox').textContent, /Original pitch/);
  d.querySelector('#prepBrief').click();
  assert.equal(d.querySelector('#prepBrief').disabled, true);
  assert.equal(d.querySelector('#pitchBox').getAttribute('aria-busy'), 'true');
  assert.match(d.querySelector('#pitchBox [role="status"]').textContent, /Preparing/);
  await until(() => rejectPitch);
  rejectPitch();
  await until(() => d.querySelector('#pitchBox [role="alert"]'));
  assert.match(d.querySelector('#pitchBox').textContent, /Original pitch/);
  assert.match(d.querySelector('#pitchBox [role="alert"]').textContent, /Please retry later/);
  assert.equal(d.querySelector('#prepBrief').disabled, false);
  assert.match(d.querySelector('[aria-current="step"]').textContent, /^3Pitch/);
});
test('failed partner search keeps the query and restores the submit button', async (t) => {
  const c = companyCase();
  const w = app(t, { hash: '/staff/case/a', fetcher: async (url) => {
    if (url === '/cases/a') return { ok: true, json: async () => c };
    if (url === '/cases/a/rematch') return { ok: false, status: 503, json: async () => ({ detail: 'Search unavailable' }) };
  } });
  const d = w.document;
  await until(() => d.querySelector('#rematch'));
  const form = d.querySelector('#rematch');
  // jsdom does not implement HTMLFormElement's named property access.
  Object.defineProperty(form, 'q', { value: form.elements.namedItem('q') });
  form.q.value = 'new sensor query';
  form.dispatchEvent(new w.Event('submit', { cancelable: true }));
  assert.equal(form.querySelector('button').disabled, true);
  await until(() => !form.querySelector('button').disabled);
  assert.equal(form.q.value, 'new sensor query');
  assert.equal(form.hasAttribute('aria-busy'), false);
  assert.equal(d.querySelector('#toast').textContent, 'Search unavailable');
});
