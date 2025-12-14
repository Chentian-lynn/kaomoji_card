// floatingEmojis.js
export class FloatingEmojis {
    constructor({
        count = 25,
        floatRange = 30,
        repelRadius = 150,
        speed = 0.3,
        emojis = [],
        ocupacy = 1
    } = {}) {
        this.count = count;
        this.floatRange = floatRange;
        this.repelRadius = repelRadius;
        this.speed = speed;
        this.emojis = emojis;
        this.items = [];
        this.mouse = { x: 0, y: 0, active: false };
        this.ocupacy = ocupacy;

        this.#create();
        this.#bindMouse();
        requestAnimationFrame(this.#update.bind(this));
    }

    #create() {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = 0;
        container.style.left = 0;
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none';
        container.style.overflow = 'hidden';
        document.body.appendChild(container);
        this.container = container;

        const W = window.innerWidth;
        const H = window.innerHeight;

        const area = W * H;

        // 动态计算合适的最小距离（自适应）
        const areaPerPoint = area / this.count;
        const radius = Math.sqrt(areaPerPoint / Math.PI);
        const minDist = radius*1.2; 
        
        // 使用泊松盘采样生成均匀分布的位置
        const positions = this.#poissonDiskSampling({
            width: W,
            height: H,
            minDist: minDist,      // 颜文字之间最小距离，按需要可调
            maxPoints: this.count
        });

        for (let i = 0; i < this.count; i++) {
            const emoji = document.createElement('div');
            emoji.textContent = this.emojis[Math.floor(Math.random() * this.emojis.length)];
            emoji.style.position = 'absolute';
            emoji.style.color = Math.random() > 0.5 ? '#8063FE' : '#cce35aff';
            emoji.style.opacity = this.ocupacy;//Math.random() * 0.6 + 0.4;
            emoji.style.fontSize = `${Math.random() * 10 + 16}px`;
            emoji.style.userSelect = 'none';
            emoji.style.willChange = 'transform';
            emoji.style.transition = 'transform 0.1s linear';
            emoji.style.webkitTextStroke = '0.5px black';

            container.appendChild(emoji);
            const { x, y } = positions[i];
            this.items.push({
                el: emoji,
                x0: x,
                y0: y,
                x,
                y,
                dx: Math.random() * Math.PI * 2,
                dy: Math.random() * Math.PI * 2,
            });
        }
    }

    #bindMouse() {
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            this.mouse.active = true;
        });
        window.addEventListener('mouseleave', () => (this.mouse.active = false));
    }

    #update() {
        const t = performance.now() * 0.001;
        const { floatRange, repelRadius, speed } = this;
        const { active, x: mx, y: my } = this.mouse;

        for (const item of this.items) {
            const floatX = Math.sin(t + item.dx) * floatRange;
            const floatY = Math.cos(t + item.dy) * floatRange;

            let tx = item.x0 + floatX;
            let ty = item.y0 + floatY;

            if (active) {
                const dx = tx - mx;
                const dy = ty - my;
                const dist = Math.hypot(dx, dy);
                if (dist < repelRadius) {
                    const force = (1 - dist / repelRadius) * 200;
                    tx += (dx / dist) * force;
                    ty += (dy / dist) * force;
                }
            }

            // 缓动到目标位置
            item.x += (tx - item.x) * 0.05 * speed;
            item.y += (ty - item.y) * 0.05 * speed;
            item.el.style.transform = `translate(${item.x}px, ${item.y}px)`;
        }

        requestAnimationFrame(this.#update.bind(this));
    }
    // Bridson's Poisson Disk Sampling
    #poissonDiskSampling({ width, height, minDist, maxPoints }) {
        const k = 30; // 每个点的尝试次数
        const r = minDist;
        const cellSize = r / Math.sqrt(2);

        const gridW = Math.ceil(width / cellSize);
        const gridH = Math.ceil(height / cellSize);
        const grid = Array(gridW * gridH).fill(null);

        const points = [];
        const active = [];

        // 随机选择一个起始点
        const first = {
            x: 0.5 * width,
            y: 0.5 * height
        };

        const insertPoint = (p) => {
            points.push(p);
            active.push(p);
            const gx = Math.floor(p.x / cellSize);
            const gy = Math.floor(p.y / cellSize);
            grid[gy * gridW + gx] = p;
        };

        insertPoint(first);

        while (active.length && points.length < maxPoints) {
            const idx = Math.floor(Math.random() / 3 * active.length);
            const base = active[idx];
            let found = false;

            for (let i = 0; i < k; i++) {
                const angle = Math.random() * Math.PI * 2;
                const radius = r * (1 + Math.random());
                const candidate = {
                    x: base.x + Math.cos(angle) * radius,
                    y: base.y + Math.sin(angle) * radius
                };

                if (
                    candidate.x < 0 || candidate.x >= width ||
                    candidate.y < 0 || candidate.y >= height
                ) continue;

                const gx = Math.floor(candidate.x / cellSize);
                const gy = Math.floor(candidate.y / cellSize);

                let ok = true;

                // 检查邻域九宫格
                for (let yy = -2; yy <= 2; yy++) {
                    for (let xx = -2; xx <= 2; xx++) {
                        const nx = gx + xx;
                        const ny = gy + yy;
                        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
                        const neighbor = grid[ny * gridW + nx];
                        if (neighbor) {
                            const dx = neighbor.x - candidate.x;
                            const dy = neighbor.y - candidate.y;
                            if (dx * dx + dy * dy < r * r) {
                                ok = false;
                                break;
                            }
                        }
                    }
                    if (!ok) break;
                }

                if (ok) {
                    insertPoint(candidate);
                    found = true;
                    break;
                }
            }

            if (!found) {
                active.splice(idx, 1);
            }
        }

        return points.slice(0, maxPoints);
    }

}

