// ==UserScript==
// @name         Price Grabber[21vek.by, sila.by, ozon.by]
// @namespace    http://tampermonkey.net/
// @version      1.9.2
// @description  Выгрузка товаров (упрощённая для корзины 21vek): Наименование / Остаток / Цена
// @author       Pavel Yudenka
// @match        https://www.21vek.by/*
// @match        https://sila.by/*
// @match        https://ozon.by/*
// @match        https://www.ozon.by/*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// @updateURL    https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/price-grabber.meta.js
// @downloadURL  https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/price-grabber.user.js
// ==/UserScript==

(() => {
  'use strict';

  /* =========================
     Конфигурация / константы
     ========================= */
  const CFG = {
    BTN_SIZE: 50,
    BTN_EXPANDED_WIDTH: 180,
    BTN_COLOR_GRADIENT: 'linear-gradient(145deg, #f6d365 0%, #fda085 100%)',
    FONT_URL: 'https://fonts.googleapis.com/css2?family=Poppins:wght@800&display=swap',
    NUMERIC_HEADERS: ['Остаток', 'Цена', 'Цена со скидкой', 'Цена без скидки'],
    DEFAULTS: {
      ADD_BATCH_SIZE: 6, // пакетное добавление в корзину
      ADD_INTRA_MIN: 40,
      ADD_INTRA_MAX: 140,
      ADD_BATCH_DELAY_MIN: 300,
      ADD_BATCH_DELAY_MAX: 1000,
      ADD_WAIT_POLL: 250,
      ADD_WAIT_TIMEOUT: 1000,
      ADD_MAX_LOOPS: 200,
      INCREASE_WAIT_POLL: 200,
      INCREASE_WAIT_TIMEOUT: 1000
    }
  };

  /* =========================
     Утилиты
     ========================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const randBetween = (min, max) => min + Math.random() * (max - min);
  const nowFilenameStamp = () => (new Date()).toISOString().replace(/[:.]/g, '-');

  /* =========================
     Стили и центрирование элементов
     ========================= */
  const ensureFont = () => {
    if (!document.getElementById('poppins-font')) {
      const link = document.createElement('link');
      link.id = 'poppins-font';
      link.rel = 'stylesheet';
      link.href = CFG.FONT_URL;
      document.head.appendChild(link);
    }
  };

  const styleCenter = el => Object.assign(el.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    transition: 'all 0.28s ease'
  });

  const styleMainButton = (btnElement, iconText, hoverText) => {
    Object.assign(btnElement.style, {
      position: 'fixed',
      right: '20px',
      transform: 'translateY(-50%)',
      zIndex: '9999',
      width: `${CFG.BTN_SIZE}px`,
      height: `${CFG.BTN_SIZE}px`,
      background: CFG.BTN_COLOR_GRADIENT,
      color: '#000',
      border: 'none',
      borderRadius: '15px',
      cursor: 'pointer',
      fontWeight: '900',
      fontSize: '16px',
      transition: 'all 0.28s ease, transform 0.16s',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 5px 15px rgba(245, 158, 11, 0.4)',
      fontFamily: "'Poppins', sans-serif",
      top: '50%',
      padding: '0'
    });

    // очистим содержимое и создадим иконку и текст (абсолютно центрируем)
    btnElement.innerHTML = '';

    const icon = document.createElement('span');
    icon.textContent = iconText;
    styleCenter(icon);
    icon.style.fontSize = '16px';
    icon.style.transition = 'all 0.28s ease';
    btnElement.appendChild(icon);

    const text = document.createElement('span');
    text.textContent = hoverText;
    styleCenter(text);
    Object.assign(text.style, {
      whiteSpace: 'nowrap',
      opacity: '0',
      color: '#000',
      fontSize: '14px',
      fontWeight: '800',
      textShadow: '1px 1px 0px rgba(255,255,255,0.3)',
      pointerEvents: 'none',
      transition: 'all 0.28s ease',
    });
    btnElement.appendChild(text);

    const enter = () => {
      btnElement.style.width = `${CFG.BTN_EXPANDED_WIDTH}px`;
      icon.style.opacity = '0';
      text.style.opacity = '1';
    };
    const leave = () => {
      btnElement.style.width = `${CFG.BTN_SIZE}px`;
      icon.style.opacity = '1';
      text.style.opacity = '0';
    };
    const down = () => { btnElement.style.transform = 'translateY(-50%) scale(0.96)'; };
    const up = () => { btnElement.style.transform = 'translateY(-50%)'; };

    btnElement.addEventListener('mouseenter', enter);
    btnElement.addEventListener('mouseleave', leave);
    btnElement.addEventListener('mousedown', down);
    btnElement.addEventListener('mouseup', up);

    ensureFont();

    return {
      btn: btnElement,
      icon,
      text,
      disableHover: () => {
        btnElement.removeEventListener('mouseenter', enter);
        btnElement.removeEventListener('mouseleave', leave);
      },
      enableHover: () => {
        btnElement.addEventListener('mouseenter', enter);
        btnElement.addEventListener('mouseleave', leave);
      }
    };
  };

  /* =========================
     Спиннер (создаётся как отдельный элемент)
     ========================= */
  const createSmallSpinner = () => {
    const spinner = document.createElement('div');
    Object.assign(spinner.style, {
      display: 'none',
      width: '20px',
      height: '20px',
      border: '3px solid #ccc',
      borderTop: '3px solid #f90',
      borderRadius: '50%',
      animation: 'pg-spin 1s linear infinite',
      position: 'absolute',
      right: '10px',
      top: '50%',
      transform: 'translateY(-50%)',
    });

    if (!document.getElementById('pg-spin-animation-style')) {
      const s = document.createElement('style');
      s.id = 'pg-spin-animation-style';
      s.textContent = `
        @keyframes pg-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `;
      document.head.appendChild(s);
    }

    return spinner;
  };

  /* =========================
     Экран-блок (overlay)
     ========================= */
  const blockScreen = (show) => {

    const ID = 'overlay-block';
    let overlay = document.getElementById(ID);
    if (show) {
      if (overlay) return;
      overlay = document.createElement('div');
      overlay.id = ID;
      Object.assign(overlay.style, {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.25)', zIndex: '99998',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '28px', fontWeight: '900', color: '#fff',
        fontFamily: "'Courier New', monospace", userSelect: 'none',
      });
      const txt = document.createElement('div');
      txt.textContent = 'Stackin’ da loot, no talkin’...';
      txt.style.display = 'inline-flex';
      txt.style.alignItems = 'center';
      txt.style.gap = '14px';

      const spinner = document.createElement('div');
      Object.assign(spinner.style, {
        width: '30px', height: '30px',
        border: '4px solid #ccc', borderTop: '4px solid #f90',
        borderRadius: '50%', animation: 'pg-spin 1s linear infinite',
      });

      txt.appendChild(spinner);
      overlay.appendChild(txt);
      document.body.appendChild(overlay);
    } else {
      if (overlay) overlay.remove();
    }
  };

  /* =========================
     Форматирование/парсинг цены
     ========================= */
  const formatPrice = (raw) => {
    if (typeof raw === 'number') return +raw.toFixed(2);
    const cleaned = (raw || '').toString().replace(/[\u00A0\u202F\u2009\s]/g, '').replace(/[^\d,.]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return +(isNaN(parsed) ? 0 : parsed).toFixed(2);
  };

  /* =========================
     Извлечение данных item (sila) — аккуратно парсим dataLayer.push({...})
     ========================= */
  const extractItemData = (onClickAttr) => {
    try {
      const match = (onClickAttr || '').match(/dataLayer\.push\((\{[\s\S]*?\})\)/);
      if (!match) return null;
      // Используем Function для безопасного выполнения литерала объекта
      return Function('return ' + match[1])();
    } catch (e) {
      return null;
    }
  };

  /* =========================
     Сбор данных: 21vek (каталог)
     ========================= */
const collectData21vek = () => {
    const products = [];
    const seenNames = new Set();

    // 1. Находим контейнер с товарами
    const productList = document.querySelector('[data-testid="product-list"]');
    if (!productList) {
        console.warn('Product list container not found');
        return products;
    }

    // 2. Используем $$ для поиска карточек товаров внутри контейнера, исключая product-block
    const productCards = $$('[data-testid^="product-"]:not([data-testid="product-block"])', productList);
    if (!productCards.length) {
        console.warn('No product cards found');
        return products;
    }

    // 3. Обрабатываем каждую карточку
    productCards.forEach(card => {
        try {
            // 4. Используем $$ для поиска элементов внутри карточки
            const nameEl = $('[data-testid="card-info"]', card);
            const priceEl = $('[data-testid="card-current-price"]', card);
            const oldPriceEl = $('[data-testid="card-old-price"]', card);

            if (!nameEl || !priceEl) return;

            const name = nameEl.textContent.trim();
            if (seenNames.has(name)) return;
            seenNames.add(name);

            // 5. Форматируем цены
            const currentPrice = formatPrice(priceEl.textContent);
            const oldPrice = oldPriceEl ? formatPrice(oldPriceEl.textContent) : currentPrice;

            // 6. Добавляем товар
            products.push({
                'Наименование': name,
                'Цена без скидки': oldPrice,
                'Цена со скидкой': currentPrice
            });

        } catch (e) {
            console.error('Error processing product card:', e);
        }
    });

    return products;
};

  /* =========================
     Сбор данных: sila (каталог) — исправлена обработка ключа
     ========================= */
  const collectDataSila = () => {
    const products = [];
    const seenItems = new Set();

    $$('.btn_zak, .add_cmpr').forEach(btn => {
      const data = extractItemData(btn.getAttribute('onclick') || '');
      if (!data?.ecommerce?.items?.length) return;
      const item = data.ecommerce.items[0];

      try {
        const brand = item.item_brand || '';
        const cat4 = item.item_category4 || '';
        const itemKey = `${brand}_${cat4}`;
        if (seenItems.has(itemKey)) return;
        seenItems.add(itemKey);

        const article = (item.item_category4 || '').replace(item.item_brand || '', '').trim();
        const price = parseFloat(item.price) || 0;
        const discount = parseFloat(item.discount) || 0;
        const stockW = parseInt(item.instock) || 0;
        const stockS = parseInt(item.instore) || 0;
        products.push({
          Категория: item.item_category5 || '',
          Бренд: brand,
          Артикул: article,
          'Остаток на складе': stockW,
          'Остаток в магазинах': stockS,
          'Итого в наличии': stockW + stockS,
          'Цена без скидки': formatPrice(price + discount),
          'Цена со скидкой': formatPrice(price),
        });
      } catch (e) {
        /* noop */
      }
    });
    return products;
  };

  /* =========================
     Сбор данных: ozon.by
     ========================= */
  const collectDataOzon = () => {
    const products = [];
    const seen = new Set();

    const paginator = document.querySelector('div[data-widget="infiniteVirtualPaginator"]#paginator') || document.querySelector('div[data-widget="infiniteVirtualPaginator"], #paginator');
    const root = paginator || document;

    // Попробуем извлечь карточки: приоритет — элементы с data-index, затем стандартные классы tile-root/oi3_24
    let cards = Array.from(root.querySelectorAll('[data-index]')).filter(el => el.offsetParent !== null);
    if (!cards.length) {
      cards = Array.from(root.querySelectorAll('.tile-root, .oi3_24, .oi3_24.tile-root')).filter(el => el.offsetParent !== null);
    }

    cards.forEach(card => {
      try {
        // Название — обычно внутри a.tile-clickable-element > div.bq02_5_0-a > span.tsBody500Medium
        let titleEl = card.querySelector('a.tile-clickable-element .bq02_5_0-a span.tsBody500Medium')
          || card.querySelector('div.bq02_5_0-a span.tsBody500Medium')
          || card.querySelector('span.tsBody500Medium')
          || card.querySelector('a.tile-clickable-element .bq02_5_0-a span')
          || card.querySelector('.bq02_5_0-a span');

        if (!titleEl) return;
        let title = titleEl.textContent.trim();
        if (!title) return;

        // Обрезаем до первой запятой
        title = title.split(',').slice(0, 2).join(',').trim();
        if (!title) return;
        if (seen.has(title)) return;
        seen.add(title);

        // Находим все элементы, содержащие BYN (цены)
        const spansWithBYN = Array.from(card.querySelectorAll('span')).filter(s => /\bBYN\b/.test(s.textContent));
        // Попытка определить цену со скидкой (обычно headline) и цену без скидки (обычно body control)
        let priceSaleEl = spansWithBYN.find(s => /Headline|tsHeadline500Medium/.test(s.className)) || spansWithBYN[0];
        let priceOldEl = spansWithBYN.find(s => s !== priceSaleEl && /BodyControl|tsBodyControl400Small|tsBodyControl/.test(s.className)) || spansWithBYN.find(s => s !== priceSaleEl);

        const priceSale = priceSaleEl ? formatPrice(priceSaleEl.textContent.trim()) : 0;
        const priceOld = priceOldEl ? formatPrice(priceOldEl.textContent.trim()) : priceSale;

        products.push({
          'Наименование': title,
          'Цена без скидки': priceOld,
          'Цена со скидкой': priceSale,
        });
      } catch (e) {
        /* noop */
      }
    });

    return products;
  };

  /* =========================
     Сбор данных: /order/ (21vek) — УПРОЩЁННО (только Наименование / Остаток / Цена)
     ========================= */
  const collectDataOrder = () => {
    const products = [];
    const seenItems = new Set();

    // На разных шаблонах страницы корзины селекторы могут отличаться — пробуем несколько вариантов
    const blocks = document.querySelectorAll('div[class*="BasketItem_topBlock"], .BasketItem_topBlock__U4bk8, .basket-item, .cart-item');
    blocks.forEach(block => {
      // Название товара
      const titleEl = block.querySelector('a[class*="BasketItem_title"], a.BasketItem_title__MzCQ9, [data-testid="product-name"], .product-name, .cart-item__title, a');
      // Поле количества
      const qtyInput = block.querySelector('input[class*="Counter_counterInput"], input.Counter_counterInput__idJlc, input[type="number"], input.qty, input.quantity');
      // Блок с ценой (итоговая цена за позицию)
      const priceBlock = block.querySelector('div[class*="PriceBlock_priceBlock"], .PriceBlock_priceBlock__bLP4B, .cart-item__price, .price, [data-testid="product-price"]');

      if (!titleEl || !qtyInput || !priceBlock) return;

      const title = titleEl.textContent.trim();
      if (!title) return;
      if (seenItems.has(title)) return;
      seenItems.add(title);

      const stock = parseInt(qtyInput.value, 10) || 0;
      const priceText = priceBlock.textContent.trim();
      const totalPrice = formatPrice(priceText);
      const unitPrice = stock > 0 ? +(totalPrice / stock).toFixed(2) : totalPrice;

      products.push({
        'Наименование': title,
        'Остаток': stock,
        'Цена': unitPrice
      });
    });

    // Fallback: если не найдено блоков, попробуем собрать через inputs на странице (последняя надежда)
    if (!products.length) {
      const inputs = Array.from(document.querySelectorAll('input[type="number"]')).filter(i => i.offsetParent !== null);
      const titles = Array.from(document.querySelectorAll('a, .product-name, [data-testid="product-name"]')).map(n => n.textContent && n.textContent.trim()).filter(Boolean);
      // Если есть хотя бы одно title и inputs сопоставимы по длине — составим простой список
      if (inputs.length && titles.length) {
        for (let i = 0; i < Math.min(inputs.length, titles.length); i++) {
          const stock = parseInt(inputs[i].value, 10) || 0;
          // Попытка найти рядом цену — не гарантировано, но попробуем
          const priceAncestor = inputs[i].closest('.cart-item') || inputs[i].closest('.BasketItem_topBlock') || inputs[i].parentElement;
          const priceBlock = priceAncestor ? (priceAncestor.querySelector('.price, [data-testid="product-price"], .cart-item__price') || priceAncestor) : null;
          const totalPrice = priceBlock ? formatPrice(priceBlock.textContent || '') : 0;
          const unitPrice = stock > 0 ? +(totalPrice / stock).toFixed(2) : totalPrice;
          products.push({
            'Наименование': titles[i],
            'Остаток': stock,
            'Цена': unitPrice
          });
        }
      }
    }

    return products;
  };

  /* =========================
     Excel helpers
     ========================= */
  const formatNumericColumns = (ws) => {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let c = 0; c <= range.e.c; c++) {
      const headerCell = ws[XLSX.utils.encode_col(c) + '1'];
      if (!headerCell) continue;
      const header = String(headerCell.v || '').trim();
      if (!CFG.NUMERIC_HEADERS.includes(header)) continue;
      for (let r = range.s.r + 1; r <= range.e.r; r++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[cellAddr];
        if (cell) {
          // Попытка привести к числу
          const n = parseFloat(String(cell.v).toString().replace(',', '.').replace(/[^\d\-.]/g, ''));
          if (!isNaN(n)) {
            cell.v = n;
            cell.t = 'n';
            cell.z = 'General';
          }
        }
      }
    }
  };

  const setColumnWidths = (ws, data) => {
    if (!data || !data.length) return;
    const keys = Object.keys(data[0] || {});
    ws['!cols'] = keys.map(key => {
      const maxLen = Math.max(
        String(key).length,
        ...data.map(row => String(row[key] || '').length)
      );
      // конвертируем в ширину столбца (приблизительно)
      return { width: Math.min(Math.max(Math.round(maxLen * 1.2), 10), 50) };
    });
  };

  const generateExcel = () => {
    const isSila = location.hostname.includes('sila.by');
    const isOzon = location.hostname.includes('ozon');
    let products = [];
    if (isSila) products = collectDataSila();
    else if (isOzon) products = collectDataOzon();
    else if (location.hostname.includes('21vek.by') && location.pathname.startsWith('/order/')) products = collectDataOrder();
    else products = collectData21vek();

    if (!products.length) {
      alert('Товары не найдены!');
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(products);
    formatNumericColumns(ws);
    setColumnWidths(ws, products);
    XLSX.utils.book_append_sheet(wb, ws, 'Товары');

    const site = isSila ? 'sila' : (isOzon ? 'ozon' : '21vek');
    const filename = `Товары_${site}_${nowFilenameStamp()}.xlsx`;
    try {
      XLSX.writeFile(wb, filename);
    } catch (e) {
      // fallback
      alert('Ошибка при сохранении файла: ' + (e && e.message ? e.message : e));
    }
  };

  /* =========================
     Работа с кнопками "Добавить в корзину"
     ========================= */
  const getCartButtons = () => {
    const all = Array.from(document.querySelectorAll('button[data-testid="card-basket-action"], button.add-to-cart, button.basket-action'));
    return all.filter(b => {
      if (b.closest('[data-testid="product-block"]')) return false;
      const txt = (b.textContent || '').trim();
      if (!txt) return false;
      return !txt.includes('В корзине') && !txt.includes('Уведомить') && !txt.includes('Добавлен');
    });
  };

  const safeClick = (el) => {
    try {
      el.click();
      return true;
    } catch (e) {
      try {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return true;
      } catch (e2) {
        return false;
      }
    }
  };

  /* =========================
     Создание кнопки "ADD 'EM ALL!"
     ========================= */
  const createAddToCartButton = () => {
    if (!location.hostname.includes('21vek.by')) return;
    if (document.querySelector('button[data-safe-script-btn="addtocart"]')) return;

    const raw = document.createElement('button');
    raw.setAttribute('data-safe-script-btn', 'addtocart');

    const { btn, icon, text, disableHover, enableHover } = styleMainButton(raw, '🛒', "ADD 'EM ALL!");

    // Спиннер создаётся и управляется (не обязательно прикрепляется к кнопке)
    const spinner = createSmallSpinner();

    btn.dataset.state = 'ready';

    const setAllInBagState = () => {
      btn.dataset.state = 'done';
      btn.disabled = true;
      icon.textContent = '🛒';
      icon.style.opacity = '1';
      text.innerHTML = '😎 All in da bag! 😎';
      text.style.opacity = '0';
      btn.style.width = `${CFG.BTN_SIZE}px`;
      spinner.style.display = 'none';
      enableHover();
    };

    if (!getCartButtons().length) setAllInBagState();

    btn.addEventListener('click', async () => {
      if (btn.dataset.state === 'working') return;

      let buttons = getCartButtons();
      if (!buttons.length) {
        setAllInBagState();
        return;
      }

      btn.dataset.state = 'working';
      btn.disabled = true;
      disableHover();
      spinner.style.display = 'block';
      btn.style.width = `${CFG.BTN_SIZE}px`;
      icon.textContent = '';
      icon.style.opacity = '1';
      text.textContent = `0/${buttons.length}`;
      text.style.opacity = '1';

      blockScreen(true);

      const {
        ADD_BATCH_SIZE, ADD_INTRA_MIN, ADD_INTRA_MAX,
        ADD_BATCH_DELAY_MIN, ADD_BATCH_DELAY_MAX,
        ADD_WAIT_POLL, ADD_WAIT_TIMEOUT,
        ADD_MAX_LOOPS
      } = {
        ADD_BATCH_SIZE: CFG.DEFAULTS.ADD_BATCH_SIZE,
        ADD_INTRA_MIN: CFG.DEFAULTS.ADD_INTRA_MIN,
        ADD_INTRA_MAX: CFG.DEFAULTS.ADD_INTRA_MAX,
        ADD_BATCH_DELAY_MIN: CFG.DEFAULTS.ADD_BATCH_DELAY_MIN,
        ADD_BATCH_DELAY_MAX: CFG.DEFAULTS.ADD_BATCH_DELAY_MAX,
        ADD_WAIT_POLL: CFG.DEFAULTS.ADD_WAIT_POLL,
        ADD_WAIT_TIMEOUT: CFG.DEFAULTS.ADD_WAIT_TIMEOUT,
        ADD_MAX_LOOPS: CFG.DEFAULTS.ADD_MAX_LOOPS
      };

      const initialTotal = buttons.length;
      let loops = 0;

      while ((buttons = getCartButtons()).length > 0 && loops < ADD_MAX_LOOPS) {
        loops++;
        const before = buttons.length;
        const batch = buttons.slice(0, ADD_BATCH_SIZE);

        for (const b of batch) {
          try { safeClick(b); } catch (e) { /* noop */ }
          await sleep(randBetween(ADD_INTRA_MIN, ADD_INTRA_MAX));
        }

        // ждать уменьшения числа доступных кнопок
        let waited = 0;
        while (waited < ADD_WAIT_TIMEOUT) {
          await sleep(ADD_WAIT_POLL);
          waited += ADD_WAIT_POLL;
          const nowLen = getCartButtons().length;
          if (nowLen < before) break;
        }

        const nowRemaining = getCartButtons().length;
        const processed = Math.max(0, initialTotal - nowRemaining);
        text.textContent = `${processed}/${initialTotal}`;

        await sleep(randBetween(ADD_BATCH_DELAY_MIN, ADD_BATCH_DELAY_MAX));
      }

      blockScreen(false);

      const finalRemaining = getCartButtons().length;
      if (!finalRemaining) setAllInBagState();
      else {
        btn.dataset.state = 'ready';
        btn.disabled = false;
        icon.textContent = '🛒';
        icon.style.opacity = '1';
        text.textContent = "ADD 'EM ALL!";
        text.style.opacity = '0';
        spinner.style.display = 'none';
        btn.style.width = `${CFG.BTN_SIZE}px`;
        enableHover();
      }
    });

    // наблюдатель: вернуть кнопку в ready если появились новые товары
    const observer = new MutationObserver(() => {
      if (!document.body.contains(btn)) { observer.disconnect(); return; }
      if (btn.dataset.state === 'done' && getCartButtons().length > 0) {
        btn.dataset.state = 'ready';
        btn.disabled = false;
        icon.textContent = '🛒';
        icon.style.opacity = '1';
        text.textContent = "ADD 'EM ALL!";
        text.style.opacity = '0';
        btn.style.width = `${CFG.BTN_SIZE}px`;
        enableHover();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.body.appendChild(btn);
  };

  /* =========================
     Кнопка экспорт XLSX
     ========================= */
  const createExportButton = () => {
    if (document.querySelector('button[data-safe-script-btn="export"]')) return;
    const element = document.createElement('button');
    element.setAttribute('data-safe-script-btn', 'export');
    const { btn } = styleMainButton(element, 'XLS', 'GET DAT SHEET!');
    btn.style.top = 'calc(50% - 80px)';
    btn.addEventListener('click', generateExcel);
    document.body.appendChild(btn);
  };

  /* =========================
     Кнопка увеличения количества на /order/
     ========================= */
  const createIncreaseQuantityButton = () => {
    if (!location.hostname.includes('21vek.by') || !location.pathname.startsWith('/order/')) return;
    if (document.querySelector('button[data-safe-script-btn="increaseqty"]')) return;

    const element = document.createElement('button');
    element.setAttribute('data-safe-script-btn', 'increaseqty');
    const { btn, icon, text, disableHover, enableHover } = styleMainButton(element, '➕', 'FILL DA BAG!');
    const spinner = createSmallSpinner();
    btn.addEventListener('click', async () => {
      disableHover();
      btn.style.width = `${CFG.BTN_SIZE}px`;
      icon.style.opacity = '1';
      text.style.opacity = '0';
      btn.disabled = true;
      blockScreen(true);

      const inputs = Array.from(document.querySelectorAll('input[type="number"]')).filter(i => i.offsetParent !== null);
      if (!inputs.length) {
        alert('Количество товаров не найдено!');
        btn.disabled = false;
        blockScreen(false);
        enableHover();
        return;
      }

      let totalPriceElem = document.querySelector('[data-testid="total-price"], .order-summary-total, .order-total, #total-price, .total-price');

      const getTotalPriceValue = () => {
        if (!totalPriceElem) {
          totalPriceElem = document.querySelector('[data-testid="total-price"], .order-summary-total, .order-total, #total-price, .total-price');
          if (!totalPriceElem) return 0;
        }
        const txt = (totalPriceElem.textContent || '').replace(/[^\d]/g, '');
        return parseInt(txt, 10) || 0;
      };

      const waitPriceChange = async (oldPrice, timeout = CFG.DEFAULTS.INCREASE_WAIT_TIMEOUT) => {
        const POLL = CFG.DEFAULTS.INCREASE_WAIT_POLL;
        let waited = 0;
        return new Promise(resolve => {
          const interval = setInterval(() => {
            const nv = getTotalPriceValue();
            if (nv !== oldPrice) {
              clearInterval(interval);
              resolve(nv);
            }
            waited += POLL;
            if (waited >= timeout) {
              clearInterval(interval);
              resolve(oldPrice);
            }
          }, POLL);
        });
      };

      let currentPrice = getTotalPriceValue();

      for (const input of inputs) {
        try {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(input, 9999);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
          input.value = 9999;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const newPrice = await waitPriceChange(currentPrice, 1000);
        if (newPrice !== currentPrice) {
          await sleep(500 + Math.random() * 500);
          currentPrice = newPrice;
        } else {
          await sleep(1000);
        }
      }

      blockScreen(false);
      btn.disabled = false;
      enableHover();
    });

    document.body.appendChild(btn);
  };

  /* =========================
     Инициализация
     ========================= */
  const init = () => {
    createExportButton();
    if (location.hostname.includes('21vek.by')) {
      if (location.pathname.startsWith('/order/')) createIncreaseQuantityButton();
      else createAddToCartButton();
    }
  };

  setTimeout(init, 200);

})();
