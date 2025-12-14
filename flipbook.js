// flipbook.js
export class FlipBook {
  constructor(stage, opts = {}) {
    if (!stage) throw new Error('FlipBook: stage element required');
    this.stage = stage;
    this.pages = [];
    this.backfaces = [];
    this.flipped = [];

    // ⭐ 新增：记录每页是否已翻页
    this.pageState = [];

    // ⭐ 新增：记录每页是否正面（true=正面, false=反面）
    this.pageFront = [];

    this.options = Object.assign({
      angle: 70,
      lift: 120,
      duration: 600
    }, opts);

    this.#applyOpts();
    this.onPageTurn = [];
    this.onPageUnflip = [];
    this.onPageFlip = [];
  }

  #applyOpts() {
    const { angle, lift, duration } = this.options;
    this.stage.style.setProperty('--duration', `${duration}ms`);
    this.stage.style.setProperty('--lift', `${lift}px`);
    this.stage.style.setProperty('--angle', `${angle}deg`);
  }

  async loadImages(urls) {
    this.stage.innerHTML = '';
    this.pages = [];
    this.flipped = [];
    this.pageState = [];
    this.pageFront = [];

    for (let i = 0; i < urls.length; i++) {
      const div = document.createElement('div');
      div.className = 'page';
      div.style.zIndex = String(1000 - i);

      const img = document.createElement('img');
      img.src = urls[i];
      img.draggable = false;

      div.appendChild(img);
      this.stage.appendChild(div);

      this.pages.push(div);

      // ⭐ 初始：所有页面都未翻页 & 正面
      this.pageState.push(false);
      this.pageFront.push(true);
    }
  }

  async loadBackfaces(urls) {

    for (let i = 0; i < urls.length; i++) {
      const div = document.createElement('div');
      div.className = 'page';
      div.style.zIndex = String(1000 - i);

      const img = document.createElement('img');
      img.src = urls[i];
      img.draggable = false;

      div.appendChild(img);
      this.stage.appendChild(div);
      div.classList.add("face-flipped");
      this.backfaces.push(div);
    }
  }

  /* ===============================
     页面翻页
     ===============================*/
  flipNext() {
    const idx = this.#findTopUnflipped();
    if (idx === -1) return;

    //全部翻回正面
    for (let i = 0; i < this.pages.length; i++) {
      this.unflipFace(i);
    }

    this.pages[idx].classList.add('flipped');
    this.flipped.push(idx);
    this.pageState[idx] = true;

    if (this.onPageTurn)
      this.onPageTurn.forEach(cb => cb(idx + 1, this.pageFront[idx+1]));
  }

  unflipLast() {
    if (this.flipped.length === 0) return;
    //全部翻回正面
    for (let i = 0; i < this.pages.length; i++) {
      this.unflipFace(i);
    }

    const idx = this.flipped.pop();

    this.pages[idx].classList.remove('flipped');
    this.pageState[idx] = false;

    if (this.onPageUnflip)
      this.onPageUnflip.forEach(cb => cb(idx, this.pageFront[idx]));
  }

  #findTopUnflipped() {
    for (let i = 0; i < this.pages.length; i++) {
      if (!this.pages[i].classList.contains('flipped'))
        return i;
    }
    return -1;
  }

  /* ===============================
     ⭐ 新增：找到当前显示中的页面
     ===============================*/
  getCurrentPage() {
    // 优先当前未翻的那一页
    const idx = this.#findTopUnflipped();
    return idx === -1 ? this.pages.length - 1 : idx;
  }

  /* ===============================
     ⭐ 新增：页面正反面翻转
     ===============================*/
  flipFace(idx) {
    if (!this.pages[idx]) return;
    this.pages[idx].classList.add("face-flipped");
    if (this.backfaces[idx]) this.backfaces[idx].classList.remove("face-flipped");
    this.pageFront[idx] = false;
    if (this.onPageFlip)
      this.onPageFlip.forEach(cb => cb(idx, false));
  }

  unflipFace(idx) {
    if (!this.pages[idx]) return;
    this.pages[idx].classList.remove("face-flipped");
    if (this.backfaces[idx]) this.backfaces[idx].classList.add("face-flipped");
    this.pageFront[idx] = true;
    if (this.onPageFlip)
      this.onPageFlip.forEach(cb => cb(idx, true));
  }

  toggleFace(idx) {
    if (!this.pages[idx]) return;
    if (this.pageFront[idx]) this.flipFace(idx);
    else this.unflipFace(idx);
  }
}
