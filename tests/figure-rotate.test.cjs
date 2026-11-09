// 돌리기·돌린 물체 크기 바꾸기·그래프 직접 편집 도우미 시험
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/figure-model.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ` ${a} vs ${b}`);

test('rotateObject: 상자는 중심을 기준으로 돌고, 다른 점을 기준으로 돌리면 자리도 옮겨짐', () => {
    const r = M.makeObject('rect', { x: 0, y: 0, w: 100, h: 40 });
    M.rotateObject(r, 30, 50, 20);
    assert.equal(r.rot, 30);
    assert.deepEqual([r.x, r.y], [0, 0]);
    const r2 = M.makeObject('rect', { x: 0, y: 0, w: 20, h: 20 });     // 중심 (10, 10)
    M.rotateObject(r2, 90, 0, 0);                                      // 원점 기준 90° → 중심 (-10, 10)
    near(r2.x + r2.w / 2, -10, 1e-9); near(r2.y + r2.h / 2, 10, 1e-9);
    M.rotateObject(r2, 300, 0, 0);
    assert.equal(r2.rot, 30);                                           // 390° → 30°
});

test('rotateObject: 선·도선은 점을, 각도 표시는 각을 함께 돌림', () => {
    const l = M.makeObject('line', { x1: 0, y1: 0, x2: 100, y2: 0 });
    M.rotateObject(l, 90, 50, 0);
    assert.deepEqual([l.x1, l.y1, l.x2, l.y2], [50, -50, 50, 50]);
    const w = M.makeObject('wire', { points: [[0, 0], [10, 0], [10, 10]] });
    M.rotateObject(w, 180, 0, 0);
    assert.deepEqual(w.points.map(p => p.map(v => Math.round(v))), [[0, 0], [-10, 0], [-10, -10]]);
    const a = M.makeObject('angle', { x: 0, y: 0, a1: 0, a2: 40 });
    M.rotateObject(a, 30, 0, 0);       // 화면에서 시계 방향 30° = 수학 각 −30°
    assert.deepEqual([a.a1, a.a2], [-30, 10]);
    const g = M.makeObject('graph', { x: 0, y: 0 });
    M.rotateObject(g, 30, 0, 0);
    assert.equal(g.x, 0);              // 그래프는 돌리지 않음
    assert.equal(M.canRotate(g), false);
});

test('돌린 상자의 모서리를 끌면 맞은편 모서리는 그대로', () => {
    const r = M.makeObject('rect', { x: 100, y: 100, w: 80, h: 40, rot: -30 });
    const before = Object.fromEntries(M.handles(r).map(h => [h.key, [h.x, h.y]]));
    // se 모서리를 상자 방향으로 (20, 10) 더 끌기
    const c = Math.cos(-30 * Math.PI / 180), s = Math.sin(-30 * Math.PI / 180);
    const [sx, sy] = before.se;
    M.moveHandle(r, 'se', sx + 20 * c - 10 * s, sy + 20 * s + 10 * c);
    const after = Object.fromEntries(M.handles(r).map(h => [h.key, [h.x, h.y]]));
    near(r.w, 100, 0.05); near(r.h, 50, 0.05);
    near(after.nw[0], before.nw[0], 0.05); near(after.nw[1], before.nw[1], 0.05);
    // nw 를 끌면 se 가 그대로
    M.moveHandle(r, 'nw', after.nw[0] - 10 * c, after.nw[1] - 10 * s);
    const again = Object.fromEntries(M.handles(r).map(h => [h.key, [h.x, h.y]]));
    near(r.w, 110, 0.05);
    near(again.se[0], after.se[0], 0.05); near(again.se[1], after.se[1], 0.05);
});

test('돌린 원·파동·렌즈·글자의 테두리 상자와 손잡이', () => {
    const e = M.makeObject('ellipse', { cx: 0, cy: 0, rx: 50, ry: 10, rot: 90 });
    const b = M.bbox(e);
    near(b.x2, 10, 1e-9); near(b.y2, 50, 1e-9);
    const h = M.handles(e)[0];
    M.moveHandle(e, 'r', h.x, h.y);       // 손잡이 자리에 그대로 놓으면 크기 그대로
    near(e.rx, 50, 0.01); near(e.ry, 10, 0.01);
    const w = M.makeObject('wave', { x: 0, y: 0, length: 100, amp: 10, rot: 90 });
    const wb = M.bbox(w);
    near(wb.y2, 100, 1e-9); near(wb.x1, -10, 1e-9);
    const t = M.makeObject('text', { x: 0, y: 0, text: 'ABCD', size: 20, anchor: 'start', rot: 90 });
    const tb = M.bbox(t);
    assert.ok(tb.y2 > 40 && tb.x2 - tb.x1 < 30, JSON.stringify(tb));
    const svg = M.renderObject(t);
    assert.match(svg, /rotate\(90 0 0\)/);
});

test('돌린 상자의 안쪽 글자는 바로 선 채로', () => {
    const s = M.renderObject(M.makeObject('rect', { x: 0, y: 0, w: 60, h: 40, rot: -30, label: 'A' }));
    const g = s.indexOf('</g>'), t = s.indexOf('<text');
    assert.ok(g > 0 && t > g, '글자는 회전 묶음 밖에');
});

test('graphMap·valueStep·snapValue: 그래프 값과 화면 좌표', () => {
    const g = M.makeObject('graph', { x: 100, y: 50, w: 200, h: 100, xmin: 0, xmax: 10, ymin: 0, ymax: 5 });
    const m = M.graphMap(g);
    assert.equal(m.X(5), 200); assert.equal(m.Y(5), 50);
    near(m.vx(150), 2.5, 1e-12); near(m.vy(100), 2.5, 1e-12);
    assert.equal(M.valueStep(g, 'x'), 2.5);    // 폭 200px 이면 자동 눈금 5 → 절반 2.5
    assert.equal(M.valueStep({ ...g, xstep: 2 }, 'x'), 1);
    assert.equal(M.snapValue(2.74, 0.5), 2.5);
    assert.equal(M.formatPoints([[0, 0], [1.5, 2.0000001]]), '0,0  1.5,2');
});

test('눈금 표 ↔ 글: 그대로 왕복, 글자 안 쉼표는 빼냄', () => {
    const rows = M.parseTickList('1:*t*_0, 2:2*t*_0; pi:π, 3');
    assert.deepEqual(rows, [{ v: '1', label: '*t*_0' }, { v: '2', label: '2*t*_0' }, { v: 'pi', label: 'π' }, { v: '3', label: '' }]);
    assert.equal(M.formatTickList(rows), '1:*t*_0, 2:2*t*_0, pi:π, 3');
    assert.equal(M.formatTickList([{ v: '1', label: 'a,b' }, { v: ' ', label: 'x' }]), '1:a b');
});

test('normalize: 새 기울기 칸이 남고 렌더에 NaN 없음', () => {
    const sc = M.normalizeScene({ objects: [
        { type: 'ellipse', rot: 45 }, { type: 'text', rot: '-30' }, { type: 'lens', rot: 10 }, { type: 'wave', rot: 'x' }
    ] });
    assert.deepEqual(sc.objects.map(o => o.rot), [45, -30, 10, 0]);
    assert.ok(!/NaN/.test(M.renderSVG(sc)));
});
