// --- 基本設定と状態変数 ---
let gridCols = 16; // グリッドの列数
let gridRows = 16; // グリッドの行数
const maxCanvasSize = 360; // キャンバスの最大表示サイズ（px）


// --- カラーパレット定義 ---
const PALETTE = [ // 64色
    "#000000", "#e03c28", "#ffffff", "#d7d7d7", "#a8a8a8", "#7b7b7b", "#343434", "#151515", 
    "#0d2030", "#415d66", "#71a6a1", "#bdffca", "#25e2cd", "#0a98ac", "#005280", "#00604b", 
    "#20b562", "#58d332", "#139d08", "#004e00", "#172808", "#376d03", "#6ab417", "#8cd612", 
    "#beeb71", "#eeffa9", "#b6c121", "#939717", "#cc8f15", "#ffbb31", "#ffe737", "#f68f37", 
    "#ad4e1a", "#231712", "#5c3c0d", "#ae6c37", "#c59782", "#e2d7b5", "#4f1507", "#823c3d", 
    "#da655e", "#e18289", "#f5b784", "#ffe9c5", "#ff82ce", "#cf3c71", "#871646", "#a328b3", 
    "#cc69e4", "#d59cfc", "#fec9ed", "#e2c9ff", "#a675fe", "#6a31ca", "#5a1991", "#211640", 
    "#3d34a5", "#6264dc", "#9ba0ef", "#98dcff", "#5ba8ff", "#0a89ff", "#024aca", "#00177d"
];


// --- 描画状態管理 ---
let grid = []; // 各セルの色情報を保持する1次元配列
let cellSize = 16; // 各セルの描画サイズ（px）
let currentColor = PALETTE[0]; // 現在選択中の描画色
let tool = 'pen'; // 現在のツール（'pen' または 'eraser'）
let isDragging = false; // ドラッグ中フラグ
let lastCell = null; // 直前に描いたセル位置（Shift描画用）
const history = []; // Undo用の履歴スタック
const isDrawGrid = false;

// --- canvas出力設定 ---
let outputMode = 'object'; // 出力形式 ('1d' | '2d' | 'object')

// 履歴スタックに現在の状態を保存
function pushHistory(snapshot) {
    history.push(snapshot || JSON.stringify(grid));
}

// Undo機能：履歴を1つ戻す
function undo() {
    if (history.length === 0) return;
    const snap = history.pop();
    grid = JSON.parse(snap);
    redraw();
}

// DOM要素取得
const holder = document.getElementById('p5-holder');
const paletteEl = document.getElementById('palette');
const penBtn = document.getElementById('penBtn');
const eraserBtn = document.getElementById('eraserBtn');
const undoBtn = document.getElementById('undoBtn');
const clearBtn = document.getElementById('clearBtn');

// ツール変更（ペン or 消しゴム）
function setTool(name) {
    tool = name;
    penBtn.classList.toggle('active', tool === 'pen');
    eraserBtn.classList.toggle('active', tool === 'eraser');
}

// カラーパレット生成
function buildPalette() {
    paletteEl.innerHTML = '';
    PALETTE.forEach((c, idx) => {
        const b = document.createElement('button');
        b.className = 'color' + (idx === 0 ? ' selected' : '');
        b.style.background = c;
        b.title = c;
        b.addEventListener('click', () => {
            currentColor = c;
            [...paletteEl.children].forEach(ch => ch.classList.remove('selected'));
            b.classList.add('selected');
            setTool('pen');
        });
        paletteEl.appendChild(b);
    });
}

penBtn.addEventListener('click', () => setTool('pen'));
eraserBtn.addEventListener('click', () => setTool('eraser'));
undoBtn.addEventListener('click', () => undo());
clearBtn.addEventListener('click', () => { pushHistory(); grid = grid.map(() => null); redraw(); logGrid(); });

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        logGrid();
    }
});

document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName.toLowerCase() === 'canvas') e.preventDefault();
});

let pg;

function initGrid(cols, rows) {
    gridCols = cols;
    gridRows = rows;
    grid = new Array(gridCols * gridRows).fill(null);
    history.length = 0;
    resizeCanvasForGrid();
}

function resizeCanvasForGrid() {
    const size = Math.min(maxCanvasSize, Math.min(window.innerWidth - 64, 640));
    cellSize = Math.floor(size / Math.max(gridCols, gridRows));
    const w = cellSize * gridCols;
    const h = cellSize * gridRows;
    if (pg) pg.remove();
    pg = createCanvas(w, h);
    pg.parent(holder);
    redraw();
    logGrid();
}

function setup() {
    const w = Math.min(maxCanvasSize, Math.min(window.innerWidth - 64, 640));
    const s = Math.floor(w / Math.max(gridCols, gridRows));
    cellSize = Math.max(4, s);
    pg = createCanvas(cellSize * gridCols, cellSize * gridRows);
    pg.parent(holder);
    noLoop();
    initGrid(gridCols, gridRows);
    buildPalette();
}

function windowResized() {
    resizeCanvasForGrid();
}

function draw() {
    background(240);

    // 市松模様の背景
    noStroke();
    for (let j = 0; j < gridRows; j++) {
        for (let i = 0; i < gridCols; i++) {
            ((i + j) % 2 == 0) ? fill(235) : fill(245);
            square(i * cellSize, j * cellSize, cellSize);
        }
    }

    // セルの色を描画
    noStroke();
    for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
            const col = grid[r * gridCols + c];
            if (col) {
                fill(col);
                rect(c * cellSize, r * cellSize, cellSize, cellSize);
            }
        }
    }

    // グリッド線
    if (isDrawGrid) {
        stroke(200);
        strokeWeight(1);
        for (let c = 0; c <= gridCols; c++) line(c * cellSize, 0, c * cellSize, height);
        for (let r = 0; r <= gridRows; r++) line(0, r * cellSize, width, r * cellSize);
    }
}

function mousePressed() {
    if (!isMouseOnCanvas()) return;
    isDragging = true;
    pushHistory();
    paintAt(mouseX, mouseY, true);
}

function mouseDragged() {
    if (!isDragging || !isMouseOnCanvas()) return;
    paintAt(mouseX, mouseY, false);
}

function mouseReleased() {
    isDragging = false;
    lastCell = null;
    logGrid();
}

function mouseClicked(e) {
    if (e.button === 2 && isMouseOnCanvas()) {
        const { ci, ri } = getCellIndex(mouseX, mouseY);
        const picked = grid[ri * gridCols + ci];
        if (picked) {
            currentColor = picked;
            [...paletteEl.children].forEach(ch => {
                if (ch.style.background.toLowerCase() === picked.toLowerCase()) ch.classList.add('selected');
                else ch.classList.remove('selected');
            });
            setTool('pen');
        }
    }
}

function getCellIndex(x, y) {
    const ci = Math.floor(constrain(x, 0, width - 1) / cellSize);
    const ri = Math.floor(constrain(y, 0, height - 1) / cellSize);
    return { ci, ri };
}

function isMouseOnCanvas() {
    return mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height;
}

function setCell(ci, ri, color) {
    grid[ri * gridCols + ci] = color;
}

function paintAt(x, y, start) {
    const { ci, ri } = getCellIndex(x, y);
    if (keyIsDown(SHIFT) && lastCell) {
        const { ci: lci, ri: lri } = lastCell;
        if (lci === ci) {
            const [a, b] = [Math.min(lri, ri), Math.max(lri, ri)];
            for (let r = a; r <= b; r++) setCell(ci, r, tool === 'eraser' ? null : currentColor);
        } else if (lri === ri) {
            const [a, b] = [Math.min(lci, ci), Math.max(lci, ci)];
            for (let c = a; c <= b; c++) setCell(c, ri, tool === 'eraser' ? null : currentColor);
        } else {
            setCell(ci, ri, tool === 'eraser' ? null : currentColor);
        }
    } else {
        setCell(ci, ri, tool === 'eraser' ? null : currentColor);
    }
    lastCell = { ci, ri };
    redraw();
}

// グリッド内容をコンソール出力
function logGrid() {
    if (outputMode === '1d') {
        console.log('Grid (1D):', grid);
    } else if (outputMode === '2d') {
        const arr2d = [];
        for (let r = 0; r < gridRows; r++) {
            arr2d.push(grid.slice(r * gridCols, (r + 1) * gridCols));
        }
        console.table(arr2d);
    } else if (outputMode === 'object') {
        const obj = {};
        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                const key = `${r}-${c}`;
                obj[key] = grid[r * gridCols + c];
            }
        }
        console.log('Grid (object):', obj);
    }
}

function touchStarted() {
    if (isMouseOnCanvas()) { isDragging = true; pushHistory(); paintAt(mouseX, mouseY, true); return false; }
}
function touchMoved() {
    if (isDragging && isMouseOnCanvas()) { paintAt(mouseX, mouseY, false); return false; }
}
function touchEnded() {
    isDragging = false;
    lastCell = null;
    logGrid();
}