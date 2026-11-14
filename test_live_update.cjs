// Interface-level live-update tests: node test_live_update.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, 'lyrics-display.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const start = script.indexOf('        // BEGIN live-update module');
const end = script.indexOf('        // END live-update module');
assert.ok(start !== -1 && end > start, 'live-update module must be present in standalone HTML');
const context = vm.createContext({URL, Blob, AbortController});
vm.runInContext(script.slice(start, end), context);
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}
const response = data => ({ok: true, json: () => Promise.resolve(data)});
const notice = '{"results":{"item":"song"}}';
function setup({websocket = true, abort = true} = {}) {
    let now = 0, nextId = 0;
    const timers = new Map(), requests = [], sockets = [], data = [], errors = [];
    const clock = {
        setTimeout(fn, ms) { const id = ++nextId; timers.set(id, {fn, at: now + ms, ms}); return id; },
        clearTimeout(id) { timers.delete(id); },
        setInterval(fn, ms) { const id = ++nextId; timers.set(id, {fn, at: now + ms, ms, interval: true}); return id; },
        clearInterval(id) { timers.delete(id); }
    };
    async function advance(ms) {
        const target = now + ms;
        while (true) {
            const entry = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
            if (!entry) break;
            const [id, timer] = entry; now = timer.at;
            if (timer.interval) timer.at += timer.ms; else timers.delete(id);
            timer.fn(); await tick();
        }
        now = target; await tick();
    }
    class Socket {
        constructor(url) { this.url = url; this.events = {}; this.closed = false; sockets.push(this); }
        addEventListener(name, fn) { this.events[name] = fn; }
        emit(name, data) { if (this.events[name]) this.events[name](data); }
        close() { this.closed = true; }
    }
    const network = {
        fetch(url, options) { const d = deferred(); requests.push({url, options, ...d}); return d.promise; },
        WebSocket: websocket ? Socket : undefined, AbortController: abort ? AbortController : undefined, Blob, URL
    };
    const client = context.createLiveUpdate({onData: value => data.push(value), onError: error => errors.push(error), network, clock});
    function take(part) {
        const index = requests.findIndex(r => r.url.includes(part));
        assert.notEqual(index, -1, `missing ${part}; pending: ${requests.map(r => r.url)}`);
        return requests.splice(index, 1)[0];
    }
    return {client, advance, timers, requests, sockets, data, errors, take};
}
const live = '/api/controller/live/text', system = '/api/v2/core/system';
async function connect(t, port = 9876) {
    t.take(system).resolve(response({websocketPort: port})); await tick();
    return t.sockets.at(-1);
}
(async () => {
    // Polls do not invalidate a slow request; push bursts invalidate it once and coalesce.
    const t = setup(); t.client.start('first:4316');
    const initial = t.take(live); const ws = await connect(t);
    assert.equal(ws.url, 'ws://first:9876/');
    await t.advance(2000); assert.equal(t.requests.length, 0);
    const empty = {results: {slides: []}}; initial.resolve(response(empty)); await tick();
    assert.equal(t.data[0], empty); assert.equal(t.errors.length, 0);
    await t.advance(1000); const stale = t.take(live);
    ws.emit('message', {data: notice}); ws.emit('message', {data: notice});
    stale.resolve(response({old: true})); await tick();
    assert.equal(t.data.length, 1); const fresh = t.take(live);
    fresh.resolve(response({fresh: true})); await tick();
    assert.equal(t.data[1].fresh, true); assert.equal(t.requests.length, 0);
    for (const payload of ['broken', '{}', '{"results":{"item":42}}']) ws.emit('message', {data: payload});
    class BadBlob extends Blob { text() { return Promise.reject(new Error('decode')); } }
    ws.emit('message', {data: new BadBlob()});
    ws.emit('message', {data: new Blob(['not json'])});
    ws.emit('message', {data: new Blob(['{"results":{"item":42}}'])}); await tick();
    assert.equal(t.requests.length, 0, 'invalid or unreadable binary notifications are ignored');
    ws.emit('message', {data: new Blob([notice])}); await tick();
    assert.equal(t.requests.length, 1);
    t.take(live).reject(new Error('offline')); await tick();
    assert.equal(t.errors.length, 1); assert.equal(t.errors[0].message, 'offline'); assert.equal(t.data.length, 2);
    ws.emit('open'); t.take(live).resolve(response({opened: true})); await tick();
    await t.advance(1000); const supersededFailure = t.take(live);
    ws.emit('message', {data: notice});
    supersededFailure.reject(new Error('stale push failure')); await tick();
    assert.equal(t.errors.length, 1, 'a push-superseded failure is silent');
    t.take(live).resolve(response({afterFailure: true})); await tick();
    assert.equal(t.data.at(-1).afterFailure, true);
    t.client.stop(); assert.equal(t.timers.size, 0); assert.equal(ws.closed, true);

    // Fetch AND parsing time out, even without AbortController, and late work is ignored.
    for (const abort of [true, false]) {
        const x = setup({abort}); x.client.start('timeout:4316');
        const r = x.take(live), d = x.take(system), json = deferred();
        r.resolve({ok: true, json: () => json.promise}); await tick();
        await x.advance(5000);
        assert.equal(x.errors.length, 1); assert.match(x.errors[0].message, /timed out/i);
        assert.equal(x.sockets[0].url, 'ws://timeout:4317/');
        if (abort) assert.equal(d.options.signal.aborted, true);
        json.resolve({late: true}); d.resolve(response({websocketPort: 9999})); await tick();
        assert.equal(x.data.length, 0); assert.equal(x.sockets.length, 1);
        // The next interval can recover after timeout.
        await x.advance(1000); x.take(live).resolve(response({recovered: true})); await tick();
        assert.equal(x.data[0].recovered, true); x.client.stop(); assert.equal(x.timers.size, 0);
    }
    // A push queued behind a hung request triggers one final read after timeout;
    // discovery's JSON parsing is bounded independently of fetch.
    const q = setup(); q.client.start('queued:4316');
    const hung = q.take(live), discoveryJson = deferred();
    q.take(system).resolve({ok: true, json: () => discoveryJson.promise}); await tick();
    await q.advance(5000); assert.equal(q.sockets[0].url, 'ws://queued:4317/');
    assert.equal(hung.options.signal.aborted, true, 'timed-out fetch is aborted');
    // A new request is started at the next poll. Queue a push while it hangs.
    await q.advance(1000); const pending = q.take(live);
    q.sockets[0].emit('message', {data: notice});
    await q.advance(5000); assert.equal(q.errors.length, 1, 'superseded timeout is silent');
    const final = q.take(live); final.resolve(response({final: true})); await tick();
    hung.resolve(response({late: true})); pending.resolve(response({late: true}));
    discoveryJson.resolve({websocketPort: 9999}); await tick();
    assert.equal(q.data.length, 1); assert.equal(q.data[0].final, true);
    assert.equal(q.sockets.length, 1); q.client.stop();

    // A notification still decoding when its socket disconnects cannot refresh.
    const disconnected = setup(); disconnected.client.start('disconnected:4316');
    disconnected.take(live).resolve(response({first: true}));
    const disconnectedSocket = await connect(disconnected);
    const disconnectedDecode = deferred();
    class DisconnectedBlob extends Blob { text() { return disconnectedDecode.promise; } }
    disconnectedSocket.emit('message', {data: new DisconnectedBlob()});
    disconnectedSocket.emit('close'); disconnectedDecode.resolve(notice); await tick();
    assert.equal(disconnected.requests.length, 0);
    disconnected.client.stop();

    // Switch invalidates request, discovery, socket and delayed Blob completion; stop invalidates everything.
    const s = setup(); s.client.start('old:4316');
    const oldRequest = s.take(live), oldDiscovery = s.take(system);
    s.client.switchServer('middle:4316');
    oldRequest.reject(new Error('old')); oldDiscovery.resolve(response({websocketPort: 1111})); await tick();
    assert.equal(s.errors.length, 0); assert.equal(s.sockets.length, 0);
    const middleRequest = s.take(live); const middleSocket = await connect(s, 2222);
    const decoding = deferred(); class SlowBlob extends Blob { text() { return decoding.promise; } }
    middleSocket.emit('message', {data: new SlowBlob()});
    s.client.switchServer('new:4316');
    middleRequest.resolve(response({old: true})); decoding.resolve(notice); await tick();
    assert.equal(s.data.length, 0); assert.equal(middleSocket.closed, true);
    const newRequest = s.take(live); const newDiscovery = s.take(system);
    assert.match(newRequest.url, /new:4316/);
    s.client.stop(); assert.equal(s.timers.size, 0);
    newRequest.reject(new Error('stopped')); newDiscovery.resolve(response({}));
    middleSocket.emit('message', {data: notice}); middleSocket.emit('close'); await tick();
    await s.advance(60000); assert.equal(s.errors.length, 0); assert.equal(s.requests.length, 0);
    assert.equal(s.sockets.length, 1); assert.equal(s.timers.size, 0);

    const stopped = setup(); stopped.client.start('stop:4316');
    const inflight = stopped.take(live); const connected = await connect(stopped);
    const lateDecode = deferred(); class StoppedBlob extends Blob { text() { return lateDecode.promise; } }
    connected.emit('message', {data: new StoppedBlob()});
    stopped.client.stop(); assert.equal(connected.closed, true); assert.equal(stopped.timers.size, 0);
    inflight.resolve(response({late: true})); lateDecode.resolve(notice); connected.emit('close');
    await tick(); await stopped.advance(60000);
    assert.equal(stopped.data.length, 0); assert.equal(stopped.errors.length, 0);
    assert.equal(stopped.requests.length, 0); assert.equal(stopped.timers.size, 0);

    // Stop discards queued push work and reconnect timers even without abort;
    // a later start owns a fresh lifetime, unaffected by abandoned completions.
    for (const abort of [true, false]) {
        const lifetime = setup({abort});
        lifetime.client.stop(); lifetime.client.stop();
        lifetime.client.start('abandoned:4316');
        const abandoned = lifetime.take(live), oldSocket = await connect(lifetime);
        oldSocket.emit('message', {data: notice}); // Queue behind the active read.
        oldSocket.emit('close'); // Also leave a reconnect scheduled.
        assert.ok([...lifetime.timers.values()].some(timer => timer.ms === 2000));
        lifetime.client.stop(); lifetime.client.stop();
        assert.equal(lifetime.timers.size, 0);
        await lifetime.advance(60000);
        assert.equal(lifetime.requests.length, 0, 'stop cannot restart queued work');
        lifetime.client.start('restarted:4316');
        const restarted = lifetime.take(live);
        const restartedSocket = await connect(lifetime);
        assert.equal(restartedSocket.url, 'ws://restarted:9876/');
        restarted.resolve(response({restarted: true})); await tick();
        abandoned.resolve(response({abandoned: true}));
        oldSocket.emit('open'); oldSocket.emit('message', {data: notice}); oldSocket.emit('error');
        await tick();
        assert.equal(lifetime.data.length, 1);
        assert.equal(lifetime.data[0].restarted, true);
        assert.equal(lifetime.errors.length, 0);
        assert.equal(lifetime.requests.length, 0);
        lifetime.client.stop(); assert.equal(lifetime.timers.size, 0);
    }

    // Discovery failure and bounded reconnect, reset on successful open.
    const b = setup(); b.client.start('backoff:4316'); b.take(live).resolve(response({}));
    b.take(system).resolve({ok: false}); await tick();
    assert.equal(b.sockets[0].url, 'ws://backoff:4317/');
    for (const delay of [2000, 4000, 8000, 16000, 30000, 30000]) {
        b.sockets.at(-1).emit('close');
        // Stop polling requests from accumulating while advancing time.
        const until = [...b.timers.values()].find(timer => !timer.interval && timer.ms === delay);
        assert.ok(until, `reconnect delay ${delay}`);
        await b.advance(delay);
        b.take(system).resolve(response({})); await tick();
    }
    b.sockets.at(-1).emit('open'); b.sockets.at(-1).emit('error');
    assert.ok([...b.timers.values()].some(timer => !timer.interval && timer.ms === 2000));
    b.client.stop(); assert.equal(b.timers.size, 0);
    const noSocket = setup({websocket: false}); noSocket.client.start('poll:4316');
    noSocket.take(live).resolve(response({first: true})); await tick();
    assert.equal(noSocket.requests.length, 0); await noSocket.advance(1000);
    noSocket.take(live).resolve(response({second: true})); await tick();
    assert.equal(noSocket.data.length, 2); noSocket.client.stop();
    console.log('All live-update module tests passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
