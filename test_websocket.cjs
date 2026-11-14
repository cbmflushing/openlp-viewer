// Offline production caller / WebSocket integration tests: node test_websocket.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'test_viewer.cjs'), 'utf8');
const dom = source.slice(source.indexOf('function decode'), source.indexOf('let payload'));
const script = fs.readFileSync(path.join(__dirname, 'lyrics-display.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return {promise, resolve, reject}; };
const response = value => ({ok: true, json: async () => value});
const slide = text => response({results: {slides: [{selected: true, text}]}});

function setup(withWebSocket = true, saved = null) {
    const requests = [], sockets = [], timeouts = new Map(), intervals = new Map(), lifecycle = [];
    let timerId = 0;
    class WebSocket {
        constructor(url) { this.url = url; this.events = {}; this.closed = false; sockets.push(this); }
        addEventListener(name, callback) { this.events[name] = callback; }
        emit(name, data) { if (this.events[name]) this.events[name](data); }
        close() { this.closed = true; }
    }
    const context = vm.createContext({console: {error() {}}, WebSocket, URL, AbortController, Blob, lifecycle,
        localStorage: {getItem: () => saved, setItem() {}, removeItem() {} },
        setTimeout: (fn, ms) => { const id = ++timerId; timeouts.set(id, {fn, ms}); return id; },
        clearTimeout: id => timeouts.delete(id),
        setInterval: (fn, ms) => { const id = ++timerId; intervals.set(id, {fn, ms}); return id; },
        clearInterval: id => intervals.delete(id),
        fetch: (url, options) => { const d = deferred(); requests.push({url, options, ...d}); return d.promise; }
    });
    if (!withWebSocket) delete context.WebSocket;
    vm.runInContext(dom + '\nthis.get = get; this.document = {body: new Element(), createElement: () => new Element(), getElementById: get, addEventListener() {}};', context);
    // Wrap, rather than replace, the real module: verify lifecycle calls and real network-to-DOM flow.
    const instrumented = script.replace('function createLiveUpdate(', 'function realCreateLiveUpdate(').replace(
        '        // END live-update module', `        function createLiveUpdate(options) {
            const client = realCreateLiveUpdate(options);
            return Object.fromEntries(['start', 'switchServer', 'stop'].map(name => [name, (...args) => {
                lifecycle.push([name, ...args]); return client[name](...args);
            }]));
        }
        // END live-update module`);
    vm.runInContext(instrumented, context);
    const take = part => { const i = requests.findIndex(r => r.url.includes(part)); assert.notEqual(i, -1, `missing request ${part}: ${requests.map(r => r.url)}`); return requests.splice(i, 1)[0]; };
    return {context, requests, sockets, timeouts, intervals, take, lifecycle};
}
const live = '/api/controller/live/text', system = '/api/v2/core/system';
const calls = h => JSON.parse(JSON.stringify(h.lifecycle));
const content = h => h.context.get('content').innerHTML;

(async () => {
    const saved = setup(false, JSON.stringify({serverIp: 'saved:4316', firstRun: false}));
    assert.deepEqual(calls(saved), [['start', 'saved:4316']]);
    const savedRequest = saved.take(live);
    assert.equal(savedRequest.url, 'http://saved:4316/api/controller/live/text');
    savedRequest.resolve(slide('Saved server')); await tick();
    assert.match(content(saved), /Saved server/);

    const h = setup();
    assert.deepEqual(calls(h), [['start', 'localhost:4316']]);
    const initial = h.take(live), discovery = h.take(system);
    assert.equal(discovery.url, 'http://localhost:4316/api/v2/core/system');
    discovery.resolve(response({websocketPort: 9876})); initial.resolve(slide('Initial')); await tick();
    assert.match(content(h), /Initial/);
    h.context.showSettings(); h.context.closeModal(true);
    assert.deepEqual(calls(h), [['start', 'localhost:4316']], 'unchanged server does not restart');
    const ws = h.sockets[0]; assert.equal(ws.url, 'ws://localhost:9876/');
    ws.emit('open'); h.take(live).resolve(slide('Connected')); await tick();
    assert.match(content(h), /Connected/);
    ws.emit('message', {data: new Blob(['{"results":{"item":"","slide":1}}'])}); await tick();
    h.take(live).resolve(slide('Binary update')); await tick();
    assert.match(content(h), /Binary update/);
    ws.emit('message', {data: '{"results":{"item":"song"}}'});
    const old = h.take(live);
    ws.emit('message', {data: '{"results":{"item":"song"}}'});
    ws.emit('message', {data: '{"results":{"item":"song"}}'});
    old.resolve(slide('Obsolete')); await tick();
    assert.doesNotMatch(content(h), /Obsolete/);
    h.take(live).resolve(slide('Final')); await tick();
    assert.match(content(h), /Final/); assert.equal(h.requests.length, 0);
    const poll = [...h.intervals.values()][0]; assert.equal(poll.ms, 1000);
    poll.fn(); const stale = h.take(live);
    h.context.showSettings(); h.context.get('server-ip').value = 'new.example:4316'; h.context.closeModal(true);
    assert.deepEqual(calls(h).at(-1), ['switchServer', 'new.example:4316']);
    assert.equal(ws.closed, true); assert.equal(h.intervals.size, 1);
    const newDiscovery = h.take(system), newRefresh = h.take(live);
    assert.equal(newDiscovery.url, 'http://new.example:4316/api/v2/core/system');
    stale.reject(new Error('stale failure')); newDiscovery.resolve(response({websocket_port: 5555}));
    newRefresh.resolve(slide('New server')); await tick();
    assert.match(content(h), /New server/); assert.notEqual(h.context.get('error').style.display, 'block');
    ws.emit('message', {data: '{"results":{"item":"old"}}'}); ws.emit('close');
    assert.equal(h.requests.length, 0);
    assert.equal(h.sockets[1].url, 'ws://new.example:5555/');
    h.sockets[1].emit('error'); h.sockets[1].emit('close');
    assert.equal([...h.timeouts.values()].filter(t => t.ms === 2000).length, 1);
    h.context.resetSettings();
    assert.deepEqual(calls(h).at(-1), ['switchServer', 'localhost:4316']);
    assert.equal([...h.timeouts.values()].filter(t => t.ms === 2000).length, 0);
    h.take(system).resolve(response({websocketPort: 4444})); h.take(live).resolve(slide('Reset')); await tick();
    assert.equal(h.sockets[2].url, 'ws://localhost:4444/'); assert.match(content(h), /Reset/);

    const fallback = setup(false);
    fallback.take(live).resolve(slide('First')); await tick();
    assert.equal(fallback.requests.length, 0);
    [...fallback.intervals.values()][0].fn(); fallback.take(live).resolve(slide('Polled')); await tick();
    assert.match(content(fallback), /Polled/);
    console.log('All offline WebSocket regression tests passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
