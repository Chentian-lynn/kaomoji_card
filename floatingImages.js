// floatingImages.js
export class FloatingImages {
    constructor({
        count = 15,
        urls = [],
        floatRange = 20,
        repelRadius = 150,
        speed = 0.3,
        imageSize = [60, 120]   // [min, max] 像素
    } = {}) {
        this.count = count;
        this.urls = urls;
        this.floatRange = floatRange;
        this.repelRadius = repelRadius;
        this.speed = speed;
        this.imageSize = imageSize;
        this.items = [];
        this.mouse = { x: 0, y: 0, active: false };

        this.#create();
        this.#bindMouse();
        requestAnimationFrame(this.#update.bind(this));
    }

    // 创建 DOM 和初始位置
    #create() {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = 0;
        container.style.left = 0;
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none';
        container.style.overflow = 'hidden';
        container.style.zIndex = 5; // 介于背景颜文字 (z=1) 和前景翻页 (z>10)
        document.body.appendChild(container);
        this.container = container;

        const W = window.innerWidth;
        const H = window.innerHeight;
        const area = W * H;
        const areaPerPoint = area / this.count;

        // 自适应距离
        const radius = Math.sqrt(areaPerPoint / Math.PI);
        const minDist = radius * 1.3;

        // 生成均匀分布点
        let positions = [];

        while (positions.length < this.count) {
            let x = Math.random() * W * 0.8 + W * 0.1;
            let y = Math.random() * H * 0.8 + H * 0.1;
            while (Math.abs(x - W / 2) < W / 4)
                x = Math.random() * W * 0.8 + W * 0.1;
            positions.push({
                x, y
            });
        }

        for (let i = 0; i < this.count; i++) {
            const img = document.createElement('img');
            img.src = this.urls[Math.floor(Math.random() * this.urls.length)];
            console.log(`Loaded image: ${img.src}`);
            img.style.position = 'absolute';
            img.style.opacity = 1;
            img.style.willChange = 'transform';
            img.style.pointerEvents = 'none';

            const size = this.imageSize[0] + Math.random() *
                (this.imageSize[1] - this.imageSize[0]);
            img.style.width = `${size}px`;
            img.style.height = 'auto';

            this.container.appendChild(img);

            const { x, y } = positions[i];

            this.items.push({
                el: img,
                x0: x,
                y0: y,
                x,
                y,
                dx: Math.random() * Math.PI * 2,
                dy: Math.random() * Math.PI * 2,
            });
        }
    }

    // 鼠标交互
    #bindMouse() {
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            this.mouse.active = true;
        });
        window.addEventListener('mouseleave', () => (this.mouse.active = false));
    }

    // 浮动动画 + 排斥行为
    #update() {
        const t = performance.now() * 0.001;
        const { floatRange, repelRadius, speed } = this;
        const { active, x: mx, y: my } = this.mouse;

        for (const item of this.items) {
            const fx = Math.sin(t + item.dx) * floatRange;
            const fy = Math.cos(t + item.dy) * floatRange;

            let tx = item.x0 + fx;
            let ty = item.y0 + fy;

            if (active) {
                const dx = tx - mx;
                const dy = ty - my;
                const dist = Math.hypot(dx, dy);

                if (dist < repelRadius) {
                    const force = (1 - dist / repelRadius) * 160;
                    tx += (dx / dist) * force;
                    ty += (dy / dist) * force;
                }
            }

            // 缓动
            item.x += (tx - item.x) * 0.05 * speed;
            item.y += (ty - item.y) * 0.05 * speed;
            item.el.style.transform = `translate(${item.x}px, ${item.y}px)`;
        }

        requestAnimationFrame(this.#update.bind(this));
    }

    // Bridson Poisson Disk Sampling
    #poissonDiskSampling({ width, height, minDist, maxPoints }) {
        const k = 30;
        const r = minDist;
        const cell = r / Math.sqrt(2);
        const gw = Math.ceil(width / cell);
        const gh = Math.ceil(height / cell);
        const grid = Array(gw * gh).fill(null);

        const pts = [];
        const active = [];

        const first = { x: width * 0.5, y: height * 0.5 };
        const add = (p) => {
            pts.push(p);
            active.push(p);
            const gx = Math.floor(p.x / cell);
            const gy = Math.floor(p.y / cell);
            grid[gy * gw + gx] = p;
        };
        add(first);

        while (active.length && pts.length < maxPoints) {
            const idx = Math.floor(Math.random() * active.length);
            const base = active[idx];
            let found = false;

            for (let i = 0; i < k; i++) {
                const ang = Math.random() * Math.PI * 2;
                const rad = r * (1 + Math.random());
                const p = {
                    x: base.x + Math.cos(ang) * rad,
                    y: base.y + Math.sin(ang) * rad,
                };

                if (p.x < 0 || p.x >= width || p.y < 0 || p.y >= height) continue;

                const gx = Math.floor(p.x / cell);
                const gy = Math.floor(p.y / cell);

                let ok = true;

                for (let yy = -2; yy <= 2; yy++) {
                    for (let xx = -2; xx <= 2; xx++) {
                        const nx = gx + xx;
                        const ny = gy + yy;
                        if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
                        const nb = grid[ny * gw + nx];
                        if (nb) {
                            const dx = nb.x - p.x;
                            const dy = nb.y - p.y;
                            if (dx * dx + dy * dy < r * r) {
                                ok = false;
                                break;
                            }
                        }
                    }
                    if (!ok) break;
                }

                if (ok) {
                    add(p);
                    found = true;
                    break;
                }
            }

            if (!found) active.splice(idx, 1);
        }

        return pts;
    }
}

