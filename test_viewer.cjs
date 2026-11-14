// Offline regression tests: node test_viewer.cjs (no dependencies).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function decode(text) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|nbsp);/gi, (_, entity) => {
        if (entity.startsWith('#')) return String.fromCodePoint(
            entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
        return {amp: '&', lt: '<', gt: '>', quot: '"', nbsp: '\u00a0'}[entity.toLowerCase()];
    });
}
class Element {
    constructor() {
        this.style = {setProperty() {}};
        this.handlers = {};
        this.classes = new Set();
        this.classList = {
            add: name => this.classes.add(name),
            remove: name => this.classes.delete(name),
            contains: name => this.classes.has(name),
            toggle: (name, force) => {
                const enabled = force === undefined ? !this.classes.has(name) : force;
                enabled ? this.classes.add(name) : this.classes.delete(name);
                return enabled;
            }
        };
        this.innerHTML = '';
    }
    addEventListener(event, handler) { this.handlers[event] = handler; }
    click(target = this) { if (this.handlers.click) this.handlers.click.call(this, {target}); }
    set innerHTML(value) {
        this.html = value;
        this.text = decode(value.replace(/<!--[\s\S]*?-->|<[^>]*>/g, ''));
    }
    get innerHTML() { return this.html; }
    set textContent(value) {
        this.text = value;
        this.html = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    get textContent() { return this.text; }
}
const elements = new Map();
const get = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
};
get('fade-overlay').classList.add('dark');
const handlers = {};
let payload = {results: {slides: []}};
let networkError = false;
let stored = null;
const context = vm.createContext({
    document: {
        body: new Element(), createElement: () => new Element(), getElementById: get,
        addEventListener: (event, handler) => { handlers[event] = handler; }
    },
    localStorage: {
        getItem: () => stored,
        setItem: (key, value) => { stored = value; },
        removeItem: () => { stored = null; }
    },
    setInterval() {}, setTimeout, clearTimeout, console: {error() {}},
    fetch: async () => {
        if (networkError) throw new Error('offline');
        return {ok: true, json: async () => payload};
    }
});
const html = fs.readFileSync(path.join(__dirname, 'lyrics-display.html'), 'utf8');
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
const parse = text => JSON.parse(JSON.stringify(context.parseSlideLines(text)));
const dark = () => get('fade-overlay').classList.contains('dark');
const slide = fields => ({results: {slides: [{selected: true, ...fields}]}});
async function display(value) { payload = value; await context.fetchAndDisplay(); }

(async () => {
    // Let the initial fetch finish before issuing test responses.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(dark(), true);
    assert.deepEqual(parse('<span style="color:red">Amazing grace</span>'), {
        englishLines: ['<span style="color:red">Amazing grace</span>'], chineseLines: []
    });
    assert.deepEqual(parse('Amazing grace<br>奇異恩典<br><span><em>奇 異 恩 典</em></span>'), {
        englishLines: ['Amazing grace'], chineseLines: ['奇異恩典']
    });
    assert.deepEqual(parse('&#x5947;&#x7570;&#x6069;&#x5178;'), {
        englishLines: [], chineseLines: ['奇異恩典']
    });
    assert.equal(parse('中文abcdef').chineseLines.length, 0); // 25%
    assert.equal(parse('中文abc').chineseLines.length, 1); // 40%
    assert.equal(parse('中文漢abcdefg').chineseLines.length, 0); // exactly 30%
    assert.equal(parse('中文😀😀😀😀').chineseLines.length, 1); // count code points
    assert.deepEqual(parse(' <span>&nbsp;</span><br>\n'), {englishLines: [], chineseLines: []});

    vm.runInContext('settings.showTitle = true', context);
    for (const empty of [
        {}, {results: {}}, {results: {slides: []}},
        {results: {slides: [{text: 'Not selected'}]}},
        slide({text: ''}), slide({text: ' \n '}),
        slide({text: 'fallback', html: '<span>&nbsp;</span><br>'})
    ]) {
        await display(slide({text: 'Hello', title: 'Song'}));
        assert.equal(dark(), false);
        assert.equal(get('title-display').textContent, 'Song');
        await display(empty);
        assert.equal(dark(), true);
        assert.equal(get('content').innerHTML, '');
        assert.equal(get('title-display').textContent, '');
    }
    await display(slide({html: '<em>Hello</em><br>奇異恩典', title: 'HTML only'}));
    assert.equal(dark(), false);
    assert.match(get('content').innerHTML, /class="english"><em>Hello<\/em>/);
    assert.match(get('content').innerHTML, /class="chinese">奇異恩典/);
    const previous = get('content').innerHTML;
    networkError = true;
    await context.fetchAndDisplay();
    assert.equal(dark(), false);
    assert.equal(get('content').innerHTML, previous);
    networkError = false;
    await display(slide({text: ''}));
    networkError = true;
    await context.fetchAndDisplay();
    assert.equal(dark(), true);

    handlers.keydown({key: '.', target: {matches: () => false}});
    assert.equal(context.document.body.classList.contains('hidden-content'), true);
    context.setFadeState(false);
    assert.equal(context.document.body.classList.contains('hidden-content'), true);
    handlers.keydown({key: '.', target: {matches: () => false}});
    assert.equal(context.document.body.classList.contains('hidden-content'), false);
    // Settings dismissal must use the same persistence and draft behavior as Skip.
    const overlay = get('modal-overlay');
    const input = get('server-ip');
    const key = (name, focused = false) => handlers.keydown({
        key: name, target: {matches: selector => focused && selector === 'input'}
    });
    context.showSettings();
    input.value = 'saved.example:4316';
    context.closeModal(true);
    assert.equal(JSON.parse(stored).serverIp, 'saved.example:4316');
    context.showSettings();
    input.value = 'cancelled.example:4316';
    context.closeModal(false);
    assert.equal(JSON.parse(stored).serverIp, 'saved.example:4316');
    context.showSettings();
    assert.equal(input.value, 'saved.example:4316');

    if (process.argv[2] !== 'backdrop') {
        input.value = 'draft.example:4316';
        key('.', true);
        assert.equal(context.document.body.classList.contains('hidden-content'), false);
        key('Escape', true);
        assert.equal(overlay.classList.contains('hidden'), true, 'Escape dismisses with input focused');
        assert.equal(JSON.parse(stored).serverIp, 'saved.example:4316');
        context.showSettings();
        assert.equal(input.value, 'saved.example:4316');
        key('Escape');
        assert.equal(overlay.classList.contains('hidden'), true, 'Escape dismisses without input focus');
        const before = stored;
        key('Escape');
        assert.equal(stored, before, 'Escape while closed does not persist settings');
    }
    if (process.argv[2] !== 'escape') {
        context.showSettings();
        input.value = 'draft.example:4316';
        overlay.click(get('modal'));
        overlay.click(input);
        assert.equal(overlay.classList.contains('hidden'), false, 'inside clicks stay open');
        overlay.click();
        assert.equal(overlay.classList.contains('hidden'), true, 'backdrop click dismisses');
        assert.equal(JSON.parse(stored).serverIp, 'saved.example:4316');
        context.showSettings();
        assert.equal(input.value, 'saved.example:4316');
    }
    // Language settings default for both new and pre-existing saved configurations.
    stored = JSON.stringify({serverIp: 'legacy.example:4316', firstRun: false});
    context.loadSettings();
    const language = get('display-language');
    assert.equal(language.value, 'bilingual');
    const languageSelect = html.match(/<select id="display-language">([\s\S]*?)<\/select>/);
    assert.ok(languageSelect, 'settings expose a display-language selector');
    assert.deepEqual([...languageSelect[1].matchAll(/<option value="([^"]+)"/g)].map(m => m[1]),
        ['bilingual', 'english']);
    networkError = false;
    await display(slide({html: '<em>First</em><br>奇異恩典<br>Second<sup>2</sup>', title: 'c123'}));
    assert.match(get('content').innerHTML, /class="chinese">奇異恩典/);

    context.showSettings();
    language.value = 'english';
    context.closeModal(true);
    assert.equal(JSON.parse(stored).displayLanguage, 'english');
    await context.fetchAndDisplay();
    assert.equal(get('content').innerHTML,
        '<p class="english"><em>First</em></p><p class="english">Second<sup>2</sup></p>');
    assert.match(get('footer').innerHTML, /Chorus #123/);
    context.loadSettings(); // Reload saved settings into the active state.
    context.showSettings();
    assert.equal(language.value, 'english');
    for (const dismiss of [() => context.closeModal(false), () => key('Escape'), () => overlay.click()]) {
        language.value = 'bilingual';
        dismiss();
        await context.fetchAndDisplay();
        assert.doesNotMatch(get('content').innerHTML, /class="chinese"/);
        context.showSettings();
        assert.equal(language.value, 'english');
    }
    await display(slide({html: '奇異恩典', title: 'c123'}));
    assert.equal(dark(), true);
    assert.equal(get('content').innerHTML, '');
    assert.equal(get('title-display').textContent, '');
    assert.doesNotMatch(get('footer').innerHTML, /Chorus/);
    context.resetSettings();
    assert.equal(language.value, 'bilingual');
    await display(slide({text: '奇異恩典'}));
    assert.match(get('content').innerHTML, /class="chinese">奇異恩典/);
    assert.equal(dark(), false);

    assert.match(html, /transition: opacity 0\.3s ease/);
    assert.match(html, /pointer-events: none/);
    console.log('All offline viewer regression tests passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
