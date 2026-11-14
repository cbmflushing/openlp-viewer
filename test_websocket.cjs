// Offline push/poll coordination tests: node test_websocket.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'test_viewer.cjs'), 'utf8');
// Reuse the viewer's small DOM fake without running its tests.
const dom = source.slice(source.indexOf('function decode'), source.indexOf('let payload'));
const script = fs.readFileSync(path.join(__dirname, 'lyrics-display.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };
const response = value => ({ok: true, json: async () => value});
const slide = text => response({results: {slides: [{selected: true, text}]}});

async function setup(withWebSocket = true, withAbort = true) {
    const requests = [], sockets = [], timeouts = new Map(), intervals = new Map();
    let timerId = 0;
    class WebSocket {
        constructor(url) { this.url = url; this.events = {}; this.closed = false; sockets.push(this); }
        addEventListener(name, callback) { this.events[name] = callback; }
        emit(name, data) { if (this.events[name]) this.events[name](data); }
        close() { this.closed = true; }
    }
    const context = vm.createContext({console: {error() {}}, WebSocket, URL, AbortController, Blob,
        localStorage: {getItem: () => null, setItem() {}, removeItem() {}},
        setTimeout: (fn, ms) => { const id = ++timerId; timeouts.set(id, {fn, ms}); return id; },
        clearTimeout: id => timeouts.delete(id),
        setInterval: (fn, ms) => { const id = ++timerId; intervals.set(id, {fn, ms}); return id; },
        fetch: (url, options) => { const d = deferred(); requests.push({url, options, ...d}); return d.promise; }
    });
    if (!withWebSocket) delete context.WebSocket;
    if (!withAbort) delete context.AbortController;
    vm.runInContext(dom + '\nthis.get = get; this.document = {body: new Element(), createElement: () => new Element(), getElementById: get, addEventListener() {}};', context);
    vm.runInContext(script, context);
    const take = part => { const i = requests.findIndex(r => r.url.includes(part)); assert.notEqual(i, -1, `missing request ${part}: ${requests.map(r => r.url)}`); return requests.splice(i, 1)[0]; };
    return {context, requests, sockets, timeouts, intervals, take};
}

(async () => {
    // Timeouts must cover both fetch and JSON parsing, even without abort support.
    for (const withAbort of [true, false]) {
        const t = await setup(true, withAbort);
        const initial = t.take('/api/controller/live/text');
        const discovery = t.take('/api/v2/core/system');
        const fireTimeout = () => {
            const entry = [...t.timeouts.entries()].find(([, timer]) => timer.ms === 5000);
            assert.ok(entry, 'request has a bounded timeout');
            t.timeouts.delete(entry[0]); entry[1].fn();
        };
        const stalledJson = deferred();
        initial.resolve({ok: true, json: () => stalledJson.promise});
        await tick();
        fireTimeout(); await tick();
        fireTimeout(); await tick();
        assert.equal(t.sockets[0].url, 'ws://localhost:4317/', 'stalled discovery falls back');
        [...t.intervals.values()][0].fn();
        const retry = t.take('/api/controller/live/text');
        retry.resolve(slide('Recovered')); await tick();
        stalledJson.resolve({results: {slides: [{selected: true, text: 'Late'}]}});
        discovery.resolve(response({websocketPort: 9999})); await tick();
        assert.match(t.context.get('content').innerHTML, /Recovered/);
        assert.equal(t.sockets.length, 1, 'late discovery ignored');
        assert.equal(t.timeouts.size, 0, 'completed requests clear timeout timers');
        t.sockets[0].emit('message', {data: '{"results":{"item":""}}'});
        t.take('/api/controller/live/text').resolve(slide('Cleared item refresh')); await tick();
        assert.match(t.context.get('content').innerHTML, /Cleared item refresh/);
    }
    // A queued notification must run after a hung fetch times out; late fetch
    // completions must not overwrite it. Discovery JSON can hang independently.
    const pending = await setup();
    const hungFetch = pending.take('/api/controller/live/text');
    const hungDiscovery = pending.take('/api/v2/core/system');
    const hungDiscoveryJson = deferred();
    hungDiscovery.resolve({ok: true, json: () => hungDiscoveryJson.promise});
    await tick();
    pending.context.requestRefresh();
    for (const [id, timer] of [...pending.timeouts]) {
        pending.timeouts.delete(id); timer.fn();
    }
    await tick();
    assert.equal(hungFetch.options.signal.aborted, true);
    assert.equal(hungDiscovery.options.signal.aborted, true);
    const afterTimeout = pending.take('/api/controller/live/text');
    afterTimeout.resolve(slide('Pending recovered')); await tick();
    hungFetch.resolve(slide('Late fetch'));
    hungDiscoveryJson.resolve({websocketPort: 9999}); await tick();
    assert.match(pending.context.get('content').innerHTML, /Pending recovered/);
    assert.equal(pending.sockets[0].url, 'ws://localhost:4317/');
    assert.equal(pending.sockets.length, 1);
    assert.equal(pending.timeouts.size, 0);

    // OpenLP sends binary JSON, exposed by browsers as Blob messages.
    const binary = await setup();
    binary.take('/api/controller/live/text').resolve(slide('Initial'));
    binary.take('/api/v2/core/system').resolve(response({})); await tick();
    const binarySocket = binary.sockets[0];
    binarySocket.emit('message', {data: new Blob(['{"results":{"item":"","slide":1}}'])});
    await tick();
    binary.take('/api/controller/live/text').resolve(slide('Binary update')); await tick();
    assert.match(binary.context.get('content').innerHTML, /Binary update/);
    for (const payload of ['not json', '{"results":{"item":42}}']) {
        binarySocket.emit('message', {data: new Blob([payload])});
    }
    class RejectedBlob extends Blob { text() { return Promise.reject(new Error('decode failed')); } }
    binarySocket.emit('message', {data: new RejectedBlob()});
    await tick();
    assert.equal(binary.requests.length, 0, 'malformed or unreadable binary ignored');
    const decoding = deferred();
    class SlowBlob extends Blob { text() { return decoding.promise; } }
    binarySocket.emit('message', {data: new SlowBlob()});
    binarySocket.emit('close');
    decoding.resolve('{"results":{"item":"old"}}'); await tick();
    assert.equal(binary.requests.length, 0, 'message from disconnected socket ignored after decoding');
    const changed = await setup();
    changed.take('/api/controller/live/text').resolve(slide('Initial'));
    changed.take('/api/v2/core/system').resolve(response({})); await tick();
    const oldDecoding = deferred();
    class OldBlob extends Blob { text() { return oldDecoding.promise; } }
    changed.sockets[0].emit('message', {data: new OldBlob()});
    changed.context.showSettings(); changed.context.get('server-ip').value = 'new:4316'; changed.context.closeModal(true);
    changed.take('/api/controller/live/text').resolve(slide('New server'));
    changed.take('/api/v2/core/system').resolve(response({})); await tick();
    oldDecoding.resolve('{"results":{"item":"old"}}'); await tick();
    assert.equal(changed.requests.length, 0, 'message from old generation ignored after decoding');

    const h = await setup();
    const initial = h.take('/api/controller/live/text');
    const discovery = h.take('/api/v2/core/system');
    assert.equal(discovery.url, 'http://localhost:4316/api/v2/core/system');
    discovery.resolve(response({websocketPort: 9876})); initial.resolve(slide('Initial')); await tick();
    assert.equal(h.sockets[0].url, 'ws://localhost:9876/');
    const ws = h.sockets[0];
    ws.emit('open');
    let req = h.take('/api/controller/live/text'); req.resolve(slide('Connected')); await tick();
    for (const message of ['bad json', '{}', '{"results":{}}', '{"results":{"item":42}}']) ws.emit('message', {data: message});
    assert.equal(h.requests.length, 0, 'invalid messages ignored');
    ws.emit('message', {data: '{"results":{"item":"same"}}'});
    const older = h.take('/api/controller/live/text');
    ws.emit('message', {data: '{"results":{"item":"same"}}'});
    ws.emit('message', {data: '{"results":{"item":"same"}}'});
    // A pending notification must cause a final refresh after the active request.
    older.resolve(slide('Old')); await tick();
    req = h.take('/api/controller/live/text'); req.resolve(slide('Final')); await tick();
    assert.match(h.context.get('content').innerHTML, /Final/);
    assert.equal(h.requests.length, 0, 'burst coalesced');
    const interval = [...h.intervals.values()][0]; assert.equal(interval.ms, 1000);
    interval.fn(); const stale = h.take('/api/controller/live/text');
    h.context.showSettings(); h.context.get('server-ip').value = 'new.example:4316'; h.context.closeModal(true);
    assert.equal(ws.closed, true);
    const newDiscovery = h.take('/api/v2/core/system');
    const newRefresh = h.take('/api/controller/live/text');
    assert.equal(newDiscovery.url, 'http://new.example:4316/api/v2/core/system');
    // Old HTTP completions must not overwrite the new configuration.
    stale.resolve(slide('Stale')); newDiscovery.resolve(response({websocket_port: 5555})); await tick();
    assert.equal(h.sockets[1].url, 'ws://new.example:5555/');
    ws.emit('message', {data: '{"results":{"item":"old"}}'});
    ws.emit('close'); assert.equal([...h.timeouts.values()].filter(t => t.ms !== 5000).length, 0);
    h.sockets[1].emit('open'); newRefresh.resolve(slide('Obsolete')); await tick();
    req = h.take('/api/controller/live/text'); req.resolve(slide('New server')); await tick();
    assert.match(h.context.get('content').innerHTML, /New server/);
    const current = h.sockets[1]; current.emit('error'); current.emit('close');
    assert.equal(h.timeouts.size, 1, 'only one reconnect timer');
    let timer = [...h.timeouts.values()][0]; assert.equal(timer.ms, 2000);
    h.timeouts.clear(); timer.fn(); await tick();
    const retryDiscovery = h.take('/api/v2/core/system'); retryDiscovery.resolve(response({})); await tick();
    assert.equal(h.sockets[2].url, 'ws://new.example:4317/');
    h.sockets[2].emit('close'); timer = [...h.timeouts.values()][0]; assert.equal(timer.ms, 4000);
    h.context.resetSettings(); assert.equal([...h.timeouts.values()].filter(t => t.ms === 4000).length, 0, 'reset clears reconnect timer');
    const resetDiscovery = h.take('/api/v2/core/system'); resetDiscovery.resolve(response({websocketPort: 4444})); await tick();
    assert.equal(h.sockets[3].url, 'ws://localhost:4444/');
    // Polls do not starve a slow request; late direct HTTP completions cannot overwrite newer ones.
    const p = await setup();
    const pInitial = p.take('/api/controller/live/text');
    const pDiscovery = p.take('/api/v2/core/system');
    [...p.intervals.values()][0].fn();
    pInitial.resolve(slide('Slow but valid')); pDiscovery.resolve(response({})); await tick();
    assert.match(p.context.get('content').innerHTML, /Slow but valid/);
    assert.equal(p.sockets[0].url, 'ws://localhost:4317/');
    const a = p.context.fetchAndDisplay(); const oldResponse = p.take('/api/controller/live/text');
    const b = p.context.fetchAndDisplay(); const newResponse = p.take('/api/controller/live/text');
    newResponse.resolve(slide('Newer')); await b;
    oldResponse.resolve(slide('Older')); await a;
    assert.match(p.context.get('content').innerHTML, /Newer/);

    // A delayed discovery from an abandoned server must never create a socket.
    const race = await setup();
    const oldDiscovery = race.take('/api/v2/core/system');
    race.context.showSettings(); race.context.get('server-ip').value = 'fresh:4316'; race.context.closeModal(true);
    const freshDiscovery = race.take('/api/v2/core/system');
    assert.equal(oldDiscovery.options.signal.aborted, true);
    oldDiscovery.resolve(response({websocketPort: 1111})); freshDiscovery.resolve(response({websocketPort: 2222})); await tick();
    assert.deepEqual(race.sockets.map(s => s.url), ['ws://fresh:2222/']);
    // Fail repeatedly without opening, verifying the backoff is capped.
    for (const delay of [2000, 4000, 8000, 16000, 30000, 30000]) {
        race.sockets.at(-1).emit('close');
        const entry = [...race.timeouts.entries()].find(([, timer]) => timer.ms === delay);
        assert.ok(entry, `reconnect timer ${delay}`);
        race.timeouts.delete(entry[0]); entry[1].fn();
        race.take('/api/v2/core/system').resolve(response({})); await tick();
    }
    const fallback = await setup(false);
    fallback.take('/api/controller/live/text').resolve(slide('First')); await tick();
    assert.equal(fallback.requests.length, 0, 'no discovery without WebSocket support');
    [...fallback.intervals.values()][0].fn();
    fallback.take('/api/controller/live/text').resolve(slide('Polled')); await tick();
    assert.match(fallback.context.get('content').innerHTML, /Polled/);
    const failedDiscovery = await setup();
    failedDiscovery.take('/api/v2/core/system').resolve({ok: false}); await tick();
    assert.equal(failedDiscovery.sockets[0].url, 'ws://localhost:4317/');
    console.log('All offline WebSocket regression tests passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
