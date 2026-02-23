// ==UserScript==
// @name         Price Grabber[21vek.by, sila.by, ozon.by, onliner.by, dns-shop.by, emall.by, atlant-td.by]
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Выгрузка публичных данных товаров (названия и цены). ВНИМАНИЕ: Автор не несет ответственности за использование скрипта. Скрипт собирает только общедоступную информацию, видимую на страницах каталога. Любое использование в коммерческих целях или для сбора непубличных данных осуществляется на ваш страх и риск.
// @author       Pavelvl21
// @match        https://www.21vek.by/*
// @match        https://sila.by/*
// @match        https://ozon.by/*
// @match        https://www.ozon.by/*
// @match        https://catalog.onliner.by/*
// @match        https://dns-shop.by/*
// @match        https://emall.by/*
// @match        https://www.emall.by/*
// @match        https://atlant-td.by/*
// @match        https://www.atlant-td.by/*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// @updateURL    https://github.com/Pavelvl21/Price-Grabber/raw/refs/heads/main/price-grabber.meta.js
// @downloadURL  https://github.com/Pavelvl21/Price-Grabber/raw/refs/heads/main/price-grabber.user.js
// ==/UserScript==

(() => {
  'use strict';

  /* =========================
     ПРАВОВОЕ ПРЕДУПРЕЖДЕНИЕ
     ========================= */
  /**
   * Данный скрипт предназначен ТОЛЬКО для сбора публичной информации,
   * которая явно отображается на страницах каталога (названия товаров, цены).
   *
   * Автор не несет ответственности за:
   * - использование скрипта в коммерческих целях
   * - сбор непубличных данных (остатков, персональной информации и т.д.)
   * - нарушение условий использования сайтов
   * - любые последствия, связанные с применением скрипта
   *
   * Скрипт предоставляется "как есть" для личного некоммерческого использования.
   * Перед использованием ознакомьтесь с законодательством вашей страны и
   * условиями использования соответствующих сайтов.
   */

  /* =========================
     Конфигурация / константы
     ========================= */
  const CFG = {
    BTN_SIZE: 50,
    BTN_EXPANDED_WIDTH: 180,
    BTN_COLOR_GRADIENT: 'linear-gradient(145deg, #f6d365 0%, #fda085 100%)',
    FONT_URL: 'https://fonts.googleapis.com/css2?family=Poppins:wght@800&display=swap',
    NUMERIC_HEADERS: ['Цена', 'Цена со скидкой', 'Цена без скидки'],
    DEFAULTS: {
      ADD_BATCH_SIZE: 6,
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
     Спиннер
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
     Извлечение данных item (sila)
     ========================= */
  const extractItemData = (onClickAttr) => {
    try {
      const match = (onClickAttr || '').match(/dataLayer\.push\((\{[\s\S]*?\})\)/);
      if (!match) return null;
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

    const productList = document.querySelector(
      '[data-testid="product-list"], [data-testid="product_list"]'
    );
    if (!productList) {
      console.warn('Product list container not found');
      return products;
    }

    const productCards = $$('[data-testid^="product-"]:not([data-testid="product-block"])', productList);
    if (!productCards.length) {
      console.warn('No product cards found');
      return products;
    }

    productCards.forEach(card => {
      try {
        const nameEl = $('[data-testid="card-info"]', card);
        const priceEl = $('[data-testid="card-current-price"]', card);
        const oldPriceEl = $('[data-testid="card-old-price"]', card);

        if (!nameEl || !priceEl) return;

        const name = nameEl.textContent.trim();
        if (seenNames.has(name)) return;
        seenNames.add(name);

        const currentPrice = formatPrice(priceEl.textContent);
        const oldPrice = oldPriceEl ? formatPrice(oldPriceEl.textContent) : currentPrice;

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
     Сбор данных: sila (каталог)
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

        products.push({
          Категория: item.item_category5 || '',
          Бренд: brand,
          Артикул: article,
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

    let cards = Array.from(root.querySelectorAll('[data-index]')).filter(el => el.offsetParent !== null);
    if (!cards.length) {
      cards = Array.from(root.querySelectorAll('.tile-root, .oi3_24, .oi3_24.tile-root')).filter(el => el.offsetParent !== null);
    }

    cards.forEach(card => {
      try {
        let titleEl = card.querySelector('a.tile-clickable-element .bq02_5_0-a span.tsBody500Medium')
          || card.querySelector('div.bq02_5_0-a span.tsBody500Medium')
          || card.querySelector('span.tsBody500Medium')
          || card.querySelector('a.tile-clickable-element .bq02_5_0-a span')
          || card.querySelector('.bq02_5_0-a span');

        if (!titleEl) return;
        let title = titleEl.textContent.trim();
        if (!title) return;

        title = title.split(',').slice(0, 2).join(',').trim();
        if (!title) return;
        if (seen.has(title)) return;
        seen.add(title);

        const spansWithBYN = Array.from(card.querySelectorAll('span')).filter(s => /\bBYN\b/.test(s.textContent));
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
     Сбор данных: onliner.by
     ========================= */
  const collectDataOnliner = () => {
    const products = [];
    const seenNames = new Set();

    const productContainer = $('.catalog-form__offers');
    if (!productContainer) {
      console.warn('Product container not found on onliner.by');
      return products;
    }

    const productCards = $$('.catalog-form__offers-flex', productContainer);
    if (!productCards.length) {
      console.warn('No product cards found on onliner.by');
      return products;
    }

    productCards.forEach(card => {
      try {
        const nameEl = $('.catalog-form__link_primary-additional.catalog-form__link_base-additional.catalog-form__link_font-weight_semibold', card);
        if (!nameEl) return;

        const name = nameEl.textContent.trim();
        if (!name || seenNames.has(name)) return;
        seenNames.add(name);

        const priceEl = $('.catalog-form__link_huge-additional.catalog-form__link_font-weight_bold', card);
        let price = 0;

        if (priceEl) {
          const priceSpan = Array.from(priceEl.querySelectorAll('span')).find(span => {
            return span.textContent.includes('р.') || span.textContent.includes('руб');
          });

          if (priceSpan) {
            price = formatPrice(priceSpan.textContent);
          } else {
            price = formatPrice(priceEl.textContent);
          }
        }

        products.push({
          'Наименование': name,
          'Цена': price
        });
      } catch (e) {
        console.error('Error processing onliner product card:', e);
      }
    });

    return products;
  };

  /* =========================
     Сбор данных: dns-shop.by
     ========================= */
  const collectDataDnsShop = () => {
    const products = [];
    const seenNames = new Set();

    const productContainer = $('.catalog-category-products__product-list-wrapper');
    if (!productContainer) {
      console.warn('Product container not found on dns-shop.by');
      return products;
    }

    const productCards = $$('.catalog-category-product', productContainer);
    if (!productCards.length) {
      console.warn('No product cards found on dns-shop.by');
      return products;
    }

    productCards.forEach(card => {
      try {
        const nameElement = $('.catalog-category-product__title', card);
        if (!nameElement) return;

        let name = nameElement.textContent.trim();
        if (!name) return;

        const bracketIndex = name.indexOf('[');
        if (bracketIndex !== -1) {
          name = name.substring(0, bracketIndex).trim();
        }

        name = name.replace(/\s+/g, ' ').trim();
        if (!name) return;

        if (seenNames.has(name)) return;
        seenNames.add(name);

        let price = 0;
        const priceElement = $('.catalog-product-purchase__current-price.catalog-product-purchase__current-price_sale', card) ||
                             $('.catalog-product-purchase__current-price', card);

        if (priceElement) {
          const priceText = priceElement.textContent.trim();
          price = formatPrice(priceText);
        }

        products.push({
          'Наименование': name,
          'Цена': price
        });

      } catch (error) {
        console.error('Error processing DNS Shop product card:', error);
      }
    });

    return products;
  };

  /* =========================
     Сбор данных: emall.by
     ========================= */
  const collectDataEmall = () => {
    const products = [];
    const seenNames = new Set();

    const productCards = $$('.vertical_information__v99Cq');

    if (!productCards.length) {
      console.warn('No product cards found on emall.by');
      return products;
    }

    productCards.forEach(card => {
      try {
        const titleEl = card.querySelector('a.vertical_title__FM_Ud');
        if (!titleEl) return;

        let name = titleEl.textContent.trim();
        if (!name) return;

        if (seenNames.has(name)) return;
        seenNames.add(name);

        const priceBlock = card.querySelector('.price_main__ZI_hw');
        if (!priceBlock) return;

        const salePriceText = priceBlock.childNodes[0]?.textContent?.trim() || '';
        const salePrice = formatPrice(salePriceText);

        const oldPriceEl = priceBlock.querySelector('.price_old__OHDzw');
        let oldPrice = salePrice;

        if (oldPriceEl) {
          const oldPriceText = oldPriceEl.textContent.trim();
          oldPrice = formatPrice(oldPriceText);
        }

        products.push({
          'Наименование': name,
          'Цена без скидки': oldPrice,
          'Цена со скидкой': salePrice
        });

      } catch (e) {
        console.error('Error processing emall.by product card:', e);
      }
    });

    return products;
  };


  /* =========================
   Сбор данных: atlant-td.by
   ========================= */
const collectDataAtlant = () => {
  const products = [];
  const seenNames = new Set();

  const productCards = $$('.item_info');

  if (!productCards.length) {
    console.warn('No product cards found on atlant-td.by');
    return products;
  }

  productCards.forEach(card => {
    try {
      const stockEl = card.querySelector('.item-stock .value.font_sxs');
      if (!stockEl) return;

      const stockText = stockEl.textContent.trim();

      if (stockText.includes('Нет в наличии')) {
        console.log('⏭️ Товар пропущен (нет в наличии)');
        return;
      }

      const titleEl = card.querySelector('.item-title a.dark_link span');
      if (!titleEl) return;

      let name = titleEl.textContent.trim();
      if (!name) return;

      if (seenNames.has(name)) return;
      seenNames.add(name);

      const priceEl = card.querySelector('.price.font-bold.font_mxs .values_wrapper');
      if (!priceEl) return;

      const priceText = priceEl.textContent.trim();
      const price = formatPrice(priceText);

      const articleEl = card.querySelector('.article_block .muted.font_sxs');
      let article = '';
      if (articleEl) {
        const articleText = articleEl.textContent.trim();
        article = articleText.replace(/^Арт\.:\s*/i, '');
      }

      // ✅ НОВЫЙ ПОРЯДОК КОЛОНОК: Артикул -> Наименование -> Цена
      const product = {};

      // 1. Артикул (если есть)
      if (article) {
        product['Артикул'] = article;
      }

      // 2. Наименование
      product['Наименование'] = name;

      // 3. Цена
      product['Цена'] = price;

      products.push(product);

    } catch (e) {
      console.error('Error processing atlant-td.by product card:', e);
    }
  });

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
      return { width: Math.min(Math.max(Math.round(maxLen * 1.2), 10), 50) };
    });
  };

  /* =========================
     Генерация Excel
     ========================= */
  const generateExcel = () => {
    const isSila = location.hostname.includes('sila.by');
    const isOzon = location.hostname.includes('ozon');
    const isOnliner = location.hostname.includes('onliner.by');
    const isDnsShop = location.hostname.includes('dns-shop.by');
    const isEmall = location.hostname.includes('emall.by');
    const isAtlant = location.hostname.includes('atlant-td.by');
    let products = [];

    if (isSila) {
      products = collectDataSila();
    } else if (isOzon) {
      products = collectDataOzon();
    } else if (isOnliner) {
      products = collectDataOnliner();
    } else if (isDnsShop) {
      products = collectDataDnsShop();
    } else if (isEmall) {
      products = collectDataEmall();
    } else if (isAtlant) {
      products = collectDataAtlant();
    } else {
      products = collectData21vek();
    }

    if (!products.length) {
      alert('Товары не найдены!');
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(products);
    formatNumericColumns(ws);
    setColumnWidths(ws, products);
    XLSX.utils.book_append_sheet(wb, ws, 'Товары');

    let site = '21vek';
    if (isSila) site = 'sila';
    else if (isOzon) site = 'ozon';
    else if (isOnliner) site = 'onliner';
    else if (isDnsShop) site = 'dns-shop';
    else if (isEmall) site = 'emall';
    else if (isAtlant) site = 'atlant-td';

    const filename = `Товары_${site}_${nowFilenameStamp()}.xlsx`;
    try {
      XLSX.writeFile(wb, filename);
    } catch (e) {
      alert('Ошибка при сохранении файла: ' + (e && e.message ? e.message : e));
    }
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
     Инициализация
     ========================= */
  const init = () => {
    createExportButton();
  };

  setTimeout(init, 200);

})();
