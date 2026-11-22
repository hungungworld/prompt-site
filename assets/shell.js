/* =========================================================
   공통 동작: 탭 · 복사 · 스크롤스파이(LNB + 브레드크럼)
   ========================================================= */
(function () {
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* ---------- 탭 ---------- */
  function selectTab(tab, focus) {
    const list = tab.closest('[role="tablist"]');
    $$('[role="tab"]', list).forEach(t => {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      const p = document.getElementById(t.getAttribute("aria-controls"));
      if (p) p.hidden = !on;
    });
    if (focus) tab.focus();
    list.dispatchEvent(new CustomEvent("tabchange", { bubbles: true, detail: { tab } }));
  }
  document.addEventListener("click", e => {
    const t = e.target.closest('[role="tab"]');
    if (t) selectTab(t);
  });
  document.addEventListener("keydown", e => {
    const t = e.target.closest('[role="tab"]');
    if (!t) return;
    const tabs = $$('[role="tab"]', t.closest('[role="tablist"]'));
    let i = tabs.indexOf(t);
    if (e.key === "ArrowRight") i = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") i = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = tabs.length - 1;
    else return;
    e.preventDefault();
    selectTab(tabs[i], true);
  });

  /* ---------- 복사 ----------
     .js-copy 버튼: data-copy-text(글자 그대로) → data-copy(요소 id) → 가장 가까운 .tpl 의 pre 순서로 찾아요 */
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
  }
  document.addEventListener("click", async e => {
    const b = e.target.closest(".js-copy");
    if (!b) return;
    let text = b.dataset.copyText;
    if (text == null) {
      const el = b.dataset.copy ? document.getElementById(b.dataset.copy) : b.closest(".tpl")?.querySelector("pre");
      if (!el) return;
      text = el.innerText;
    }
    await copyText(text);
    if (!b.dataset.label) b.dataset.label = b.textContent;
    b.textContent = "복사했어요"; b.classList.add("done");
    clearTimeout(b._t);
    b._t = setTimeout(() => { b.textContent = b.dataset.label; b.classList.remove("done"); }, 1600);
    b.dispatchEvent(new CustomEvent("copied", { bubbles: true }));
  });

  /* ---------- 스크롤스파이 ----------
     본문 [data-spy-root] 안의 [data-spy-cat](분류)과 [data-spy-item](항목)을 읽어
     LNB를 만들고, 스크롤 위치에 맞춰 LNB 강조와 브레드크럼을 바꿔요. */
  function initSpy() {
    const root = document.querySelector("[data-spy-root]");
    const lnb = document.querySelector(".lnb");
    if (!root || !lnb) return null;
    const cats = $$("[data-spy-cat]", root);
    const itemsOf = c => $$("[data-spy-item]", c);

    lnb.innerHTML =
      (lnb.dataset.title ? `<p class="lnb-title">${esc(lnb.dataset.title)}</p>` : "") +
      "<ol>" + cats.map(c => {
        const items = itemsOf(c);
        const count = items.length && !c.hasAttribute("data-spy-nocount") ? `<span>${items.length}</span>` : "";
        return `<li data-cat="${c.id}"><a class="cat" href="#${c.id}">${esc(c.dataset.title)}${count}</a>` +
          (items.length ? `<ol class="items">${items.map(i => `<li><a class="item" href="#${i.id}">${esc(i.dataset.title)}</a></li>`).join("")}</ol>` : "") +
          "</li>";
      }).join("") + "</ol>";

    const crumbCat = document.querySelector('[data-crumb="cat"]');
    const crumbItem = document.querySelector('[data-crumb="item"]');
    let curCat = null, curItem = null;

    const offset = () => (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 70) + 12;
    const shown = el => el.offsetParent !== null;

    function update(force) {
      const y = offset();
      const vis = cats.filter(shown);
      if (!vis.length) return;
      const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
      let cat = vis[0];
      for (const c of vis) if (c.getBoundingClientRect().top <= y) cat = c;
      if (atBottom) cat = vis[vis.length - 1];
      let item = null;
      const its = itemsOf(cat).filter(shown);
      for (const i of its) if (i.getBoundingClientRect().top <= y) item = i;
      if (atBottom && its.length) item = its.filter(i => i.getBoundingClientRect().top < innerHeight).pop() || item;

      if (!force && cat === curCat && item === curItem) return;
      curCat = cat; curItem = item;

      $$("li[data-cat]", lnb).forEach(li => {
        const on = li.dataset.cat === cat.id;
        const a = li.querySelector("a.cat");
        li.classList.toggle("open", on);
        a.classList.toggle("on", on);
        on ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current");
      });
      $$("a.item", lnb).forEach(a => {
        const on = !!item && a.getAttribute("href") === "#" + item.id;
        a.classList.toggle("on", on);
        on ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current");
      });

      // 브레드크럼
      if (crumbCat) { crumbCat.hidden = false; crumbCat.innerHTML = `<a href="#${cat.id}">${esc(cat.dataset.title)}</a>`; }
      if (crumbItem) { crumbItem.hidden = !item; crumbItem.textContent = item ? item.dataset.title : ""; }
      const crumbs = $$(".crumbs li").filter(li => !li.hidden);
      crumbs.forEach((li, i) => {
        li.classList.toggle("is-current", i === crumbs.length - 1);
        i === crumbs.length - 1 ? li.setAttribute("aria-current", "location") : li.removeAttribute("aria-current");
      });
      const ol = document.querySelector(".crumbs ol");
      if (ol) ol.scrollLeft = ol.scrollWidth;

      // 강조된 메뉴가 LNB 안에서 보이게
      const catLink = lnb.querySelector(`li[data-cat="${cat.id}"] a.cat`);
      if (lnb.scrollWidth > lnb.clientWidth + 2) {
        lnb.scrollTo({ left: catLink.offsetLeft - 16, behavior: "smooth" });
      } else {
        const a = (item && lnb.querySelector(`a.item[href="#${item.id}"]`)) || catLink;
        const top = a.offsetTop, bottom = top + a.offsetHeight;
        if (top < lnb.scrollTop + 30 || bottom > lnb.scrollTop + lnb.clientHeight - 30) {
          lnb.scrollTo({ top: top - lnb.clientHeight / 3, behavior: "smooth" });
        }
      }
    }

    let raf;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => update()); };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    update(true);
    spy = { refresh: () => update(true) };
    return spy;
  }
  let spy = null;

  // 화면을 JS로 그린 뒤 주소의 #위치로 이동
  function jumpToHash() {
    if (!location.hash) return;
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!el) return;
    // 글꼴이 늦게 불러와지면 높이가 바뀌므로 한 번 더 맞춰요
    const go = () => {
      el.scrollIntoView({ behavior: "instant", block: "start" });
      if (spy) spy.refresh();
    };
    setTimeout(go, 0);
    if (document.fonts) document.fonts.ready.then(go);
    addEventListener("load", go, { once: true });
  }

  window.Shell = { initSpy, selectTab, esc, copyText, jumpToHash };
})();
