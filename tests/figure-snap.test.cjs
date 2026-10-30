// 맞추기(밀착)·연결(구속)·묶음 시험
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/figure-model.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ` ${a} vs ${b}`);
const scene = objs => M.normalizeScene({ width: 640, height: 420, objects: objs });
const get = (sc, id) => sc.objects.find(o => o.id === id);

test('기준틀: 돌린 상자에서 화면 ↔ 상자 좌표가 서로 맞음', () => {
    const r = M.makeObject('rect', { x: 100, y: 100, w: 80, h: 40, rot: -30 });
    const F = M.frame(r);
    const [x, y] = M.toWorld(F, 0.5, 0.5);
    const [u, v] = M.toLocal(F, x, y);
    near(u, 0.5, 1e-9); near(v, 0.5, 1e-9);
    // 돌리지 않은 상자의 오른쪽 아래 모서리
    const r0 = M.makeObject('rect', { x: 100, y: 100, w: 80, h: 40 });
    assert.deepEqual(M.toWorld(M.frame(r0), 0.5, 0.5).map(Math.round), [180, 140]);
});

test('테두리 상자: 돌린 상자·글자·소자', () => {
    const b = M.bbox(M.makeObject('rect', { x: 0, y: 0, w: 100, h: 0.0001, rot: 90 }));
    near(b.y2 - b.y1, 100, 1e-6);
    const t = M.bbox(M.makeObject('text', { x: 100, y: 50, text: 'AB', size: 20, anchor: 'middle' }));
    near((t.x1 + t.x2) / 2, 100, 1e-9);
    assert.ok(t.y1 < 50 && t.y2 > 50);
    const c = M.bbox(M.makeObject('comp', { x: 100, y: 100, len: 80, rot: 90 }));
    near(c.y1, 60, 1e-9); near(c.y2, 140, 1e-9);
});

test('nearestOn: 상자 안쪽 점은 가까운 변으로, 바깥 점은 상자 테두리로', () => {
    const r = M.makeObject('rect', { id: 'r', x: 0, y: 0, w: 100, h: 40 });
    const q = M.nearestOn(r, 50, 5);         // 윗변 가까이 안쪽
    near(q.x, 50, 1e-9); near(q.y, 0, 1e-9);
    const q2 = M.nearestOn(r, 130, 20);      // 오른쪽 바깥
    near(q2.x, 100, 1e-9); near(q2.y, 20, 1e-9); near(q2.d, 30, 1e-9);
    const l = M.makeObject('line', { id: 'l', x1: 0, y1: 0, x2: 100, y2: 0 });
    const q3 = M.nearestOn(l, 30, 7);
    assert.deepEqual([q3.x, q3.y, q3.link.seg], [30, 0, 0]);
    near(q3.link.t, 0.3, 1e-9);
});

test('연결: 한쪽만 붙은 화살표는 상자를 따라 통째로 움직임', () => {
    const sc = scene([
        { type: 'rect', id: 'box', x: 100, y: 100, w: 100, h: 60 },
        { type: 'line', id: 'f', x1: 200, y1: 130, x2: 280, y2: 130, arrow: 'end' }
    ]);
    const f = get(sc, 'f');
    f.links = { a: M.linkFor(get(sc, 'box'), 200, 130) };
    M.translate(get(sc, 'box'), 50, 20);
    assert.deepEqual(M.resolveLinks(sc), ['f']);
    assert.deepEqual([f.x1, f.y1, f.x2, f.y2], [250, 150, 330, 150]);
});

test('연결: 상자를 돌리거나 키우면 붙은 점도 그 자리에', () => {
    const sc = scene([
        { type: 'rect', id: 'box', x: 100, y: 100, w: 100, h: 60 },
        { type: 'line', id: 'f', x1: 150, y1: 100, x2: 150, y2: 40, arrow: 'end' }
    ]);
    get(sc, 'f').links = { a: M.linkFor(get(sc, 'box'), 150, 100) };   // 윗변 가운데
    get(sc, 'box').w = 200;   // 가운데가 오른쪽으로 50
    M.resolveLinks(sc);
    assert.deepEqual([get(sc, 'f').x1, get(sc, 'f').y1], [200, 100]);
});

test('연결: 두 끝이 다 붙은 선은 늘어나고, 도선은 가로·세로 모양을 지킴', () => {
    const sc = scene([
        { type: 'comp', id: 'r1', kind: 'resistor', x: 100, y: 100, len: 80 },
        { type: 'comp', id: 'r2', kind: 'resistor', x: 300, y: 200, len: 80, rot: 90 },
        { type: 'wire', id: 'w', points: [[140, 100], [300, 100], [300, 160]] }
    ]);
    const w = get(sc, 'w');
    w.links = { a: M.linkFor(get(sc, 'r1'), 140, 100), b: M.linkFor(get(sc, 'r2'), 300, 160) };
    near(w.links.a.u, 0.5, 1e-9); near(w.links.b.u, -0.5, 1e-9); near(w.links.b.v, 0, 1e-9);
    M.translate(get(sc, 'r1'), 0, 30);         // 왼쪽 소자를 아래로
    M.translate(get(sc, 'r2'), 40, 0);         // 오른쪽 소자를 오른쪽으로
    M.resolveLinks(sc);
    assert.deepEqual(w.points, [[140, 130], [340, 130], [340, 160]]);
});

test('연결: 일직선 도선의 끝이 옆으로 비켜나면 꺾는 점을 넣어 가로·세로 유지', () => {
    const sc = scene([
        { type: 'comp', id: 'a', x: 100, y: 100, len: 80 },
        { type: 'comp', id: 'b', x: 340, y: 100, len: 80 },
        { type: 'wire', id: 'w', points: [[140, 100], [220, 100], [300, 100]] }
    ]);
    const w = get(sc, 'w');
    w.links = { a: M.linkFor(get(sc, 'a'), 140, 100), b: M.linkFor(get(sc, 'b'), 300, 100) };
    M.translate(get(sc, 'b'), 30, -40);
    M.resolveLinks(sc);
    assert.deepEqual(w.points, [[140, 100], [220, 100], [220, 60], [330, 60]]);
    assert.ok(w.points.every((p, i) => !i || p[0] === w.points[i - 1][0] || p[1] === w.points[i - 1][1]));
});

test('연결: 두 점뿐인 도선이 비스듬해지면 꺾는 점을 넣음', () => {
    const sc = scene([
        { type: 'comp', id: 'a', x: 100, y: 100, len: 80 },
        { type: 'comp', id: 'b', x: 300, y: 100, len: 80 },
        { type: 'wire', id: 'w', points: [[140, 100], [260, 100]] }
    ]);
    const w = get(sc, 'w');
    w.links = { a: M.linkFor(get(sc, 'a'), 140, 100), b: M.linkFor(get(sc, 'b'), 260, 100) };
    M.translate(get(sc, 'b'), 0, 50);
    M.resolveLinks(sc);
    assert.deepEqual(w.points, [[140, 100], [140, 150], [260, 150]]);
});

test('연결: 도선 가운데(T자)에 붙은 도선도 따라감, 붙은 물체를 지우면 연결만 사라짐', () => {
    const sc = scene([
        { type: 'comp', id: 'c', x: 100, y: 100, len: 80 },
        { type: 'wire', id: 'w1', points: [[140, 100], [300, 100]] },
        { type: 'wire', id: 'w2', points: [[220, 100], [220, 200]] }
    ]);
    get(sc, 'w1').links = { a: M.linkFor(get(sc, 'c'), 140, 100) };
    get(sc, 'w2').links = { a: M.linkFor(get(sc, 'w1'), 220, 100) };
    assert.deepEqual([...M.dependents(sc, ['c'])].sort(), ['w1', 'w2']);
    M.translate(get(sc, 'c'), 0, -20);
    M.resolveLinks(sc);
    assert.deepEqual(get(sc, 'w1').points, [[140, 80], [300, 80]]);
    assert.deepEqual(get(sc, 'w2').points, [[220, 80], [220, 180]]);
    sc.objects = sc.objects.filter(o => o.id !== 'c');
    M.resolveLinks(sc);
    assert.equal(get(sc, 'w1').links, undefined);
    assert.deepEqual(get(sc, 'w1').points, [[140, 80], [300, 80]]);
});

test('normalize: 묶음·연결은 남기고 잘못된 연결은 버림', () => {
    const sc = scene([
        { type: 'line', id: 'l', group: 'g1', links: { a: { id: 'r', u: 0.5, v: '0' }, b: { id: 'x', seg: 1, t: 7 } } },
        { type: 'line', id: 'm', links: { a: { id: 'r', u: 'bad', v: 0 }, b: { u: 1, v: 1 } } },
        { type: 'rect', id: 'r', group: 'g1', links: { a: { id: 'l', u: 0, v: 0 } } }
    ]);
    assert.deepEqual(get(sc, 'l').links, { a: { id: 'r', u: 0.5, v: 0 }, b: { id: 'x', seg: 1, t: 1 } });
    assert.equal(get(sc, 'l').group, 'g1');
    assert.equal(get(sc, 'm').links, undefined);
    assert.equal(get(sc, 'r').links, undefined);   // 상자는 끝점이 없어 연결을 갖지 않음
    assert.equal(get(sc, 'r').group, 'g1');
});

test('snapDelta: 상자를 끌어 바닥선에 딱 붙임 (격자에 안 맞는 높이여도)', () => {
    const sc = scene([
        { type: 'ground', id: 'g', x1: 50, y1: 203, x2: 450, y2: 203 },
        { type: 'rect', id: 'b', x: 100, y: 100, w: 70, h: 44 }
    ]);
    const T = M.snapTargets(sc, new Set(['b']));
    const box = M.bbox(get(sc, 'b'));
    const r = M.snapDelta(13, 55, { box, pts: [] }, T, 6);     // 아랫변 144+55=199 → 203
    near(r.dy, 59, 1e-9);
    assert.equal(r.sy, true);
    assert.equal(r.guides.length >= 1, true);
    const far = M.snapDelta(13, 30, { box, pts: [] }, T, 6);
    assert.equal(far.sy, false);
    near(far.dy, 30, 1e-9);
});

test('snapDelta: 두 상자 옆면 맞붙이기, 점끼리가 선보다 먼저', () => {
    const sc = scene([
        { type: 'rect', id: 'a', x: 100, y: 100, w: 73, h: 50 },
        { type: 'rect', id: 'b', x: 300, y: 100, w: 50, h: 50 },
        { type: 'dot', id: 'd', x: 400, y: 300 }
    ]);
    const T = M.snapTargets(sc, new Set(['b']));
    const r = M.snapDelta(-123, 0, { box: M.bbox(get(sc, 'b')), pts: [] }, T, 6);   // 왼변 177 → a 의 오른변 173
    near(r.dx, -127, 1e-9);
    const p = M.snapDelta(3, 4, { box: { x1: 0, y1: 0, x2: 0, y2: 0 }, pts: [[396, 297]] }, T, 6);
    assert.deepEqual([p.dx, p.dy], [4, 3]);
    assert.deepEqual(p.point, [400, 300]);
});

test('snapPointTo: 소자 끝 → 테두리 → 정렬선 순서, 멀면 그대로', () => {
    const sc = scene([
        { type: 'comp', id: 'c', x: 100, y: 100, len: 80 },
        { type: 'rect', id: 'r', x: 300, y: 300, w: 100, h: 60 }
    ]);
    const T = M.snapTargets(sc, new Set());
    const a = M.snapPointTo(143, 98, T, 8);
    assert.deepEqual([a.x, a.y, a.target], [140, 100, 'c']);
    const b = M.snapPointTo(350, 303, T, 8);       // 윗변 바로 아래
    assert.deepEqual([b.x, b.y, b.target], [350, 300, 'r']);
    const c = M.snapPointTo(500, 362, T, 8);       // 상자 아랫변과 같은 높이로만
    assert.deepEqual([c.x, c.y, c.sx, c.sy, c.target], [500, 360, false, true, null]);
    const d = M.snapPointTo(520, 20, T, 8);
    assert.deepEqual([d.x, d.y, d.sx, d.sy], [520, 20, false, false]);
});

test('remapCopies: 복사본끼리 묶음·연결 유지, 바깥 연결은 끊음', () => {
    const copies = [
        { id: 'r2', type: 'rect', group: 'g' },
        { id: 'f2', type: 'line', group: 'g', links: { a: { id: 'r', u: 0, v: 0 }, b: { id: 'other', u: 0, v: 0 } } }
    ];
    M.remapCopies(copies, new Map([['r', 'r2'], ['f', 'f2']]));
    assert.notEqual(copies[0].group, 'g');
    assert.equal(copies[0].group, copies[1].group);
    assert.deepEqual(copies[1].links, { a: { id: 'r2', u: 0, v: 0 } });
});
