// ==================== 配置 ====================
const GRID_SIZE = 20;              // 格子数量（20x20）
const CELL_SIZE = 20;              // 每格像素
const INITIAL_SPEED = 150;         // 初始移动间隔（毫秒）
const MIN_SPEED = 60;              // 最快速度
const SPEED_STEP = 4;              // 每吃一个食物加快的毫秒数

// ==================== 状态 ====================
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const finalScoreEl = document.getElementById('final-score');
const newRecordEl = document.getElementById('new-record');

const startOverlay = document.getElementById('start-overlay');
const gameoverOverlay = document.getElementById('gameover-overlay');
const pauseOverlay = document.getElementById('pause-overlay');

let snake;          // 蛇身数组，[{x, y}, ...]，头部在索引 0
let direction;      // 当前移动方向
let nextDirection;  // 下一步方向（防止一帧内连续转向导致自杀）
let food;           // 食物位置 {x, y}
let score;
let highScore = parseInt(localStorage.getItem('snake-high-score')) || 0;
let speed;
let timer = null;
let state = 'idle'; // idle | running | paused | over

highScoreEl.textContent = highScore;

// ==================== 游戏逻辑 ====================
function resetGame() {
    // 蛇初始在中心，长度 3，向右移动
    const cx = Math.floor(GRID_SIZE / 2);
    const cy = Math.floor(GRID_SIZE / 2);
    snake = [
        { x: cx, y: cy },
        { x: cx - 1, y: cy },
        { x: cx - 2, y: cy },
    ];
    direction = { x: 1, y: 0 };
    nextDirection = direction;
    score = 0;
    speed = INITIAL_SPEED;
    scoreEl.textContent = score;
    spawnFood();
}

function spawnFood() {
    while (true) {
        const pos = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE),
        };
        // 食物不能生成在蛇身上
        if (!snake.some(seg => seg.x === pos.x && seg.y === pos.y)) {
            food = pos;
            return;
        }
    }
}

function step() {
    direction = nextDirection;

    const head = {
        x: snake[0].x + direction.x,
        y: snake[0].y + direction.y,
    };

    // 撞墙或撞到自己 → 游戏结束
    const hitWall = head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE;
    const hitSelf = snake.some(seg => seg.x === head.x && seg.y === head.y);
    if (hitWall || hitSelf) {
        gameOver();
        return;
    }

    snake.unshift(head);

    // 吃到食物：加分、加速、生成新食物；否则去掉尾巴
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreEl.textContent = score;
        speed = Math.max(MIN_SPEED, speed - SPEED_STEP);
        restartTimer();
        spawnFood();
    } else {
        snake.pop();
    }

    draw();
}

function startGame() {
    resetGame();
    state = 'running';
    startOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    restartTimer();
    draw();
}

function gameOver() {
    state = 'over';
    clearInterval(timer);
    timer = null;

    finalScoreEl.textContent = score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snake-high-score', highScore);
        highScoreEl.textContent = highScore;
        newRecordEl.classList.remove('hidden');
    } else {
        newRecordEl.classList.add('hidden');
    }
    gameoverOverlay.classList.remove('hidden');
}

function togglePause() {
    if (state === 'running') {
        state = 'paused';
        clearInterval(timer);
        timer = null;
        pauseOverlay.classList.remove('hidden');
    } else if (state === 'paused') {
        state = 'running';
        pauseOverlay.classList.add('hidden');
        restartTimer();
    }
}

function restartTimer() {
    clearInterval(timer);
    timer = setInterval(step, speed);
}

// ==================== 绘制 ====================
function draw() {
    // 背景
    ctx.fillStyle = '#0f0f23';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 淡淡的网格线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(canvas.width, i * CELL_SIZE);
        ctx.stroke();
    }

    // 食物（带呼吸光晕）
    const fx = food.x * CELL_SIZE + CELL_SIZE / 2;
    const fy = food.y * CELL_SIZE + CELL_SIZE / 2;
    const pulse = 1 + Math.sin(Date.now() / 200) * 0.15;
    ctx.save();
    ctx.shadowColor = '#ff4d6d';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.arc(fx, fy, (CELL_SIZE / 2 - 3) * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 蛇（头部亮绿，身体渐变）
    snake.forEach((seg, i) => {
        const ratio = i / snake.length;
        const g = Math.floor(220 - ratio * 90);
        ctx.fillStyle = i === 0 ? '#4ecca3' : `rgb(46, ${g}, 140)`;
        const pad = i === 0 ? 1 : 2;
        roundRect(
            seg.x * CELL_SIZE + pad,
            seg.y * CELL_SIZE + pad,
            CELL_SIZE - pad * 2,
            CELL_SIZE - pad * 2,
            5
        );
    });

    // 蛇眼睛
    const head = snake[0];
    const hx = head.x * CELL_SIZE;
    const hy = head.y * CELL_SIZE;
    ctx.fillStyle = '#0f0f23';
    const e = 3; // 眼睛半径
    const off = 6; // 眼睛偏移
    // 根据方向决定眼睛位置
    let e1, e2;
    if (direction.x === 1)       { e1 = [hx + 14, hy + off];  e2 = [hx + 14, hy + 14]; }
    else if (direction.x === -1) { e1 = [hx + 6,  hy + off];  e2 = [hx + 6,  hy + 14]; }
    else if (direction.y === -1) { e1 = [hx + off, hy + 6];   e2 = [hx + 14, hy + 6]; }
    else                         { e1 = [hx + off, hy + 14];  e2 = [hx + 14, hy + 14]; }
    ctx.beginPath();
    ctx.arc(e1[0], e1[1], e - 1.5, 0, Math.PI * 2);
    ctx.arc(e2[0], e2[1], e - 1.5, 0, Math.PI * 2);
    ctx.fill();
}

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
}

// 食物呼吸动画：非运行状态也持续重绘
function animate() {
    if (state === 'running' || state === 'idle') {
        draw();
    }
    requestAnimationFrame(animate);
}

// ==================== 输入控制 ====================
const DIRECTIONS = {
    up:    { x: 0, y: -1 },
    down:  { x: 0, y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1, y: 0 },
};

function changeDirection(name) {
    if (state !== 'running') return;
    const dir = DIRECTIONS[name];
    // 禁止 180 度掉头
    if (dir.x === -direction.x && dir.y === -direction.y) return;
    nextDirection = dir;
}

const KEY_MAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
};

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        if (state === 'idle' || state === 'over') startGame();
        else togglePause();
        return;
    }
    const dir = KEY_MAP[e.code];
    if (dir) {
        e.preventDefault();
        changeDirection(dir);
    }
});

// 按钮
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

// 移动端方向按钮
document.querySelectorAll('.dir-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        changeDirection(btn.dataset.dir);
    }, { passive: false });
    btn.addEventListener('click', () => changeDirection(btn.dataset.dir));
});

// 触屏滑动
let touchStart = null;
canvas.addEventListener('touchstart', (e) => {
    touchStart = e.touches[0];
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.clientX;
    const dy = e.changedTouches[0].clientY - touchStart.clientY;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return; // 忽略轻触
    if (Math.abs(dx) > Math.abs(dy)) {
        changeDirection(dx > 0 ? 'right' : 'left');
    } else {
        changeDirection(dy > 0 ? 'down' : 'up');
    }
    touchStart = null;
}, { passive: true });

// ==================== 初始化 ====================
resetGame();
draw();
animate();
