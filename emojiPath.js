/* ===========================================================
   EmojiPath.js — 完整稳定版本
   修复内容：
   ✔ 正确加载 SVG
   ✔ group transform 保证文字跟随路径
   ✔ pathLength 保证非 NaN
   ✔ update() 不会提前执行
   ✔ createChars() 单一版本
   ✔ 可见性与 page 翻页逻辑正确
   =========================================================== */

export class EmojiPath {
    constructor({
        flipbook,
        pageIndex,
        svgUrl,
        emojis,
        speed = 40,
        size = 26,
        scalePercent = 0.6,
        color = "#c3ff8bff",
        // 新增：面部的三个符号
        eyeLeft = 'ಠ',
        eyeRight = 'ಠ',
        mouth = '益',

        eyeLeftPos = { x: 0.4, y: 0.42 },
        eyeRightPos = { x: 0.6, y: 0.42 },
        mouthPos = { x: 0.5, y: 0.5 }
    }) {
        this.flipbook = flipbook;
        this.pageIndex = pageIndex;
        this.emojis = emojis;
        this.speed = speed;
        this.size = size;
        this.scalePercent = scalePercent;
        this.color = color;
        this.visible = false;

        this.pathLength = 0;
        this.offset = 0;

        this.eyeLeft   = eyeLeft;
        this.eyeRight  = eyeRight;
        this.mouth     = mouth;

        this.eyeLeftPos  = eyeLeftPos;
        this.eyeRightPos = eyeRightPos;
        this.mouthPos    = mouthPos;

        this.loadSvg(svgUrl);
        this.registerFlipEvents();
    }

    async loadSvg(svgUrl) {
        const text = await fetch(svgUrl).then(r => r.text());
        const match = text.match(/<path[^>]*d="([^"]+)"/i);
        if (!match) throw new Error("SVG 中没有找到 <path>");
        this.pathD = match[1];
        this.mountToPage();
        this.updateVisibility(0, true); // 初始化可见性
    }

    mountToPage() {
        const page = this.flipbook.pages[this.pageIndex];
        if (!page) throw new Error("pageIndex 超出范围");

        /* ---- SVG 容器 ---- */
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.style.position = "absolute";
        this.svg.style.top = 0;
        this.svg.style.left = 0;
        this.svg.style.width = "100%";
        this.svg.style.height = "100%";
        this.svg.style.pointerEvents = "none";
        this.svg.style.opacity = 0;
        this.svg.style.transition = "opacity 0.8s";
        page.appendChild(this.svg);

        /* ---- group (路径 + 字符一起缩放) ---- */
        this.g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.svg.appendChild(this.g);

        /* ---- 路径 ---- */
        this.path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.path.setAttribute("d", this.pathD);
        this.path.setAttribute("fill", "none");
        this.path.setAttribute("stroke", "transparent");
        // this.path.setAttribute("stroke-width", 4);
        this.g.appendChild(this.path);

        /* ---- 延迟计算 BBox 与缩放 ---- */
        requestAnimationFrame(() => {
            this.applyTransform();
            this.pathLength = this.path.getTotalLength();
            this.createChars();  // 重新创建字符以适应路径长度
            this.createFaceSymbolsOnPage(); // 创建面部符号
        });

        /* ---- 开始动画 ---- */
        requestAnimationFrame(this.update.bind(this));
    }

    /* ======================================================
       创建字符 — 所有字符放进 <g>
       ====================================================== */
    createChars() {
        const fullText = this.emojis.join("");
        const chars = [...fullText];
        this.chars = [];

        for (let i = 0; i < chars.length; i++) {
            const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
            t.textContent = chars[i];
            t.setAttribute("font-size", this.size);
            t.setAttribute("dominant-baseline", "middle");
            t.setAttribute("text-anchor", "middle");
            t.style.userSelect = "none";
            t.style.pointerEvents = "none";

            this.g.appendChild(t);

            this.chars.push({
                el: t,
                offset: i * this.size * 0.8 // 字符间距
            });
            if (i * this.size * 0.8 > this.pathLength) {
                break;  // 超出路径长度则停止添加字符      
            }
        }
    }

createFaceSymbolsOnPage() {
    const page = this.flipbook.pages[this.pageIndex];
    if (!page) return;

    const addFaceSymbol = (char, pos) => {
        if (!char || !pos) return;
        const pageW = page.offsetWidth;
        const pageH = page.offsetHeight;
        const div = document.createElement("div");
        div.textContent = char;
        div.style.position = "absolute";
        div.style.left = pos.x * pageW + "px";
        div.style.top = pos.y * pageH + "px";
        div.style.fontSize = this.size * 0.4 + "px";
        div.style.userSelect = "none";
        div.style.pointerEvents = "none";
        div.style.transform = "translate(-50%, -50%)";
        div.style.transition = "opacity 0.8s";
        div.style.color = this.color;
        page.appendChild(div);
        return div;
    };

    this.eyeLeftImg = addFaceSymbol(this.eyeLeft,  this.eyeLeftPos);
    this.eyeRightImg = addFaceSymbol(this.eyeRight, this.eyeRightPos);
    this.mouthImg = addFaceSymbol(this.mouth,    this.mouthPos);
}

    /* ======================================================
       缩放路径 + 居中路径（对 g 做 transform）
       ====================================================== */
    applyTransform() {
        const page = this.flipbook.pages[this.pageIndex];

        const bbox = this.path.getBBox();
        const pageW = page.offsetWidth;
        const pageH = page.offsetHeight;

        const targetW = pageW * this.scalePercent;
        const targetH = pageH * this.scalePercent;

        const scale = Math.min(targetW / bbox.width, targetH / bbox.height);

        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;

        const px = pageW / 2;
        const py = pageH / 2;

        const tx = px - cx * scale;
        const ty = py - cy * scale;

        this.g.setAttribute("transform", `translate(${tx}, ${ty}) scale(${scale})`);
    }

    /* ======================================================
       翻页可见性逻辑
       ====================================================== */
    registerFlipEvents() {
        this.flipbook.onPageTurn.push((pg, isFront) => {if (pg === this.pageIndex) this.updateVisibility(pg, isFront)});
        this.flipbook.onPageUnflip.push((pg, isFront) =>  this.updateVisibility(pg, isFront));
        this.flipbook.onPageFlip.push((pg, isFront) =>  this.updateVisibility(pg, isFront));
    }

    updateVisibility(curPage, isFront) {
        if (curPage === this.pageIndex && isFront) {
            this.svg.style.transition = "none";
            this.svg.style.opacity = 1;
            if (this.eyeLeftImg) this.eyeLeftImg.style.opacity = 1;
            if (this.eyeRightImg) this.eyeRightImg.style.opacity = 1;
            if (this.mouthImg) this.mouthImg.style.opacity = 1;
            this.visible = true;
        } else {
            this.svg.style.transition = "opacity 0.8s";
            this.svg.style.opacity = 0;
            if (this.eyeLeftImg) this.eyeLeftImg.style.opacity = 0;
            if (this.eyeRightImg) this.eyeRightImg.style.opacity = 0;
            if (this.mouthImg) this.mouthImg.style.opacity = 0;
            this.visible = false;
        }
    }

    /* ======================================================
       主动画循环
       ====================================================== */
    update(ts) {
        if (!this.visible) {
            return requestAnimationFrame(this.update.bind(this));
        }
        if (!this.pathLength || !isFinite(this.pathLength)) {
            return requestAnimationFrame(this.update.bind(this));
        }

        if (!this.lastTs) this.lastTs = ts;
        const dt = (ts - this.lastTs) / 1000;
        this.lastTs = ts;

        if (this.visible) this.offset += this.speed * dt;

        const len = this.pathLength;

        for (const ch of this.chars) {
            const pos = (this.offset + ch.offset) % len;

            const pt = this.path.getPointAtLength(pos);
            const pt2 = this.path.getPointAtLength((pos + 0.1) % len);

            const angle = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI;

            ch.el.setAttribute("x", pt.x);
            ch.el.setAttribute("y", pt.y);
            ch.el.setAttribute("transform", `rotate(${angle} ${pt.x} ${pt.y})`);
            ch.el.setAttribute("fill", this.color);
        }

        requestAnimationFrame(this.update.bind(this));
    }
}
