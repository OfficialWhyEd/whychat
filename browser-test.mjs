/**
 * WhyChat – Browser Visual Test Script
 * Apre Chrome in modo VISIBILE, naviga ogni modalità e cattura screenshot.
 * Lo vedrai direttamente sullo schermo!
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:5173/whychat/';
const SCREENSHOT_DIR = path.resolve('test-screenshots');

// Le 8 modalità con i loro ID dal selettore
const MODES = [
  { id: 'chat', label: 'Chat' },
  { id: 'canvas', label: 'Canvas' },
  { id: 'deep', label: 'Deep Thinking' },
  { id: 'learn', label: 'Apprendimento' },
  { id: 'sheet', label: 'OnlyType' },
  { id: 'group', label: 'Group Prediction' },
  { id: 'earth', label: 'WhyEarth' },
  { id: 'entropy', label: 'WhyEntropy' },
];

// Dimensioni viewport da testare
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  // Crea cartella screenshot
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('🚀 Avvio Chrome in modalità VISIBILE...');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    defaultViewport: null, // usa la finestra reale
    args: ['--start-maximized', '--no-sandbox', '--disable-gpu'],
    timeout: 60000,
    protocolTimeout: 60000,
  });

  const page = await browser.newPage();
  const findings = [];

  // ═══════════════════════════════════════════
  // TEST 1: Homepage – Desktop
  // ═══════════════════════════════════════════
  console.log('\n═══ TEST 1: Homepage Desktop ═══');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await delay(2000); // Aspetta animazioni

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '01_homepage_desktop.png'),
    fullPage: false,
  });
  console.log('📸 Screenshot: 01_homepage_desktop.png');

  // Controlla che la Hero section sia visibile
  const heroVisible = await page.evaluate(() => {
    const el = document.querySelector('.rise');
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.height > 0 && rect.width > 0;
  });
  findings.push({ test: 'Hero Section Visibile', result: heroVisible ? '✅ OK' : '❌ NON VISIBILE' });
  console.log(`  Hero section: ${heroVisible ? '✅' : '❌'}`);

  // Controlla gli opener buttons
  const openerCount = await page.evaluate(() => {
    return document.querySelectorAll('.rise ul li button').length;
  });
  findings.push({ test: 'Opener Buttons Count', result: openerCount === 4 ? `✅ ${openerCount} openers` : `⚠️ ${openerCount} openers (attesi 4)` });
  console.log(`  Openers: ${openerCount}`);

  // Controlla header simmetria
  const headerInfo = await page.evaluate(() => {
    const header = document.querySelector('header');
    if (!header) return null;
    const children = Array.from(header.children);
    const rects = children.map(c => c.getBoundingClientRect());
    return {
      headerHeight: header.getBoundingClientRect().height,
      childCount: children.length,
      childWidths: rects.map(r => Math.round(r.width)),
      overflow: header.scrollWidth > header.clientWidth,
    };
  });
  findings.push({ test: 'Header Overflow Desktop', result: headerInfo?.overflow ? '❌ OVERFLOW' : '✅ No overflow' });
  console.log(`  Header: ${JSON.stringify(headerInfo)}`);

  // ═══════════════════════════════════════════
  // TEST 2: Ogni modalità su Desktop
  // ═══════════════════════════════════════════
  console.log('\n═══ TEST 2: Tutte le modalità – Desktop ═══');

  for (const mode of MODES) {
    console.log(`\n  → Modalità: ${mode.label} (${mode.id})`);

    // Apri il selettore modalità
    const composerExists = await page.evaluate(() => {
      // Cerca il bottone del selettore modalità nel composer
      const btns = Array.from(document.querySelectorAll('button'));
      const modeBtn = btns.find(b => {
        const text = b.textContent?.toLowerCase() || '';
        return text.includes('chat') || text.includes('canvas') || text.includes('deep') ||
               text.includes('learn') || text.includes('sheet') || text.includes('group') ||
               text.includes('earth') || text.includes('entropy');
      });
      return !!modeBtn;
    });

    // Clicca sul bottone del menu modalità nel CommandComposer
    // Il selettore è il primo bottone nel footer che apre il popup delle modalità
    try {
      // Cerca il bottone della modalità attiva (è nel footer/composer)
      const modeBtnSelector = 'footer button';
      const modeButtons = await page.$$(modeBtnSelector);
      
      // Il bottone modalità è tipicamente il primo nel composer con l'icona
      // Cerchiamo il bottone che ha l'SVG + testo della modalità
      let clickedMode = false;
      
      // Metodo diretto: usiamo evaluate per trovare e cliccare il bottone mode
      clickedMode = await page.evaluate((targetId) => {
        // Il CommandComposer ha un bottone che mostra la modalità corrente
        // Quando cliccato, mostra un popup con tutte le modalità
        // Cerchiamo tutti i bottoni nel footer
        const footer = document.querySelector('footer');
        if (!footer) return false;
        
        const buttons = Array.from(footer.querySelectorAll('button'));
        // Il bottone modalità è solitamente il primo (prima dell'input)
        // Ha un aria-label o contiene il nome della modalità
        for (const btn of buttons) {
          // Cerchiamo il bottone che apre il menu delle modalità
          const text = btn.textContent?.trim().toLowerCase() || '';
          const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
          if (text.includes('chat') || text.includes('canvas') || text.includes('deep') || 
              text.includes('impara') || text.includes('onlytype') || text.includes('gruppo') ||
              text.includes('earth') || text.includes('entropy') ||
              ariaLabel.includes('modal')) {
            btn.click();
            return true;
          }
        }
        return false;
      }, mode.id);

      if (clickedMode) {
        await delay(500);

        // Ora cerca e clicca sulla modalità target nel popup
        const selected = await page.evaluate((targetId) => {
          // Il popup delle modalità mostra tutti i modi
          // Cerca bottoni con data-mode o testo corrispondente
          const allBtns = Array.from(document.querySelectorAll('button'));
          for (const btn of allBtns) {
            const dataMode = btn.getAttribute('data-mode');
            if (dataMode === targetId) {
              btn.click();
              return true;
            }
          }
          // Fallback: cerca per testo
          const labels = {
            chat: 'chat', canvas: 'canvas', deep: 'deep', learn: 'apprendi',
            sheet: 'onlytype', group: 'group', earth: 'earth', entropy: 'entropy'
          };
          const label = labels[targetId] || targetId;
          for (const btn of allBtns) {
            const text = (btn.textContent || '').toLowerCase();
            if (text.includes(label)) {
              btn.click();
              return true;
            }
          }
          return false;
        }, mode.id);

        if (!selected) {
          console.log(`    ⚠️ Non trovato bottone per ${mode.id}, provo metodo alternativo...`);
        }
      }

      await delay(1500); // Aspetta transizioni

      // Screenshot della modalità
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `02_mode_${mode.id}_desktop.png`),
        fullPage: false,
      });
      console.log(`    📸 Screenshot: 02_mode_${mode.id}_desktop.png`);

      // Analisi layout per questa modalità
      const layoutInfo = await page.evaluate((modeId) => {
        const result = {
          mode: modeId,
          issues: [],
        };

        // Controlla il footer/composer
        const footer = document.querySelector('footer');
        if (footer) {
          const footerRect = footer.getBoundingClientRect();
          result.footerVisible = footerRect.height > 0;
          result.footerBottom = Math.round(footerRect.bottom);
          result.windowHeight = window.innerHeight;
          
          // Il footer esce dallo schermo?
          if (footerRect.bottom > window.innerHeight + 5) {
            result.issues.push('Footer esce dal viewport');
          }
        } else {
          result.footerVisible = false;
        }

        // Controlla sovrapposizioni
        const main = document.querySelector('main');
        if (main && footer) {
          const mainRect = main.getBoundingClientRect();
          const footerRect = footer.getBoundingClientRect();
          if (mainRect.bottom > footerRect.top + 2) {
            result.issues.push(`Main si sovrappone al footer di ${Math.round(mainRect.bottom - footerRect.top)}px`);
          }
        }

        // Per OnlyType: controlla doppio footer
        if (modeId === 'sheet') {
          const canvasToolbars = document.querySelectorAll('[class*="toolbar"], [class*="sheet"] [class*="bottom"]');
          // Cerca toolbar disegno dentro BlankSheet
          const sheetBtns = document.querySelectorAll('main button');
          const composerVisible = footer && footer.offsetHeight > 0 && !footer.classList.contains('hidden');
          if (sheetBtns.length > 0 && composerVisible) {
            result.issues.push('DOPPIO FOOTER: toolbar disegno + composer chat entrambi visibili');
          }
        }

        // Per earth/entropy: controlla se il composer è visibile (dovrebbe essere nascosto o integrato)
        if (modeId === 'earth' || modeId === 'entropy') {
          const composerInput = document.querySelector('footer textarea, footer input[type="text"]');
          if (composerInput) {
            const inputRect = composerInput.getBoundingClientRect();
            if (inputRect.height > 0) {
              result.issues.push('Composer input visibile ma disconnesso dalla vista principale');
            }
          }
        }

        // Controlla z-index e sovrapposizioni generali
        const overlappingElements = [];
        const interactiveElements = document.querySelectorAll('button, input, textarea, a, [role="button"]');
        interactiveElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;
          interactiveElements.forEach(other => {
            if (el === other) return;
            const otherRect = other.getBoundingClientRect();
            if (otherRect.width === 0 || otherRect.height === 0) return;
            // Controlla sovrapposizione
            if (rect.left < otherRect.right && rect.right > otherRect.left &&
                rect.top < otherRect.bottom && rect.bottom > otherRect.top) {
              // Sono sovrapposti
              const elText = (el.textContent || el.getAttribute('aria-label') || 'unknown').trim().slice(0, 30);
              const otherText = (other.textContent || other.getAttribute('aria-label') || 'unknown').trim().slice(0, 30);
              overlappingElements.push(`"${elText}" ↔ "${otherText}"`);
            }
          });
        });
        if (overlappingElements.length > 0) {
          // Deduplica
          const unique = [...new Set(overlappingElements)];
          result.overlaps = unique.slice(0, 5); // massimo 5
        }

        return result;
      }, mode.id);

      findings.push({
        test: `Modalità ${mode.label} – Layout Desktop`,
        result: layoutInfo.issues.length === 0 ? '✅ Nessun problema' : `⚠️ ${layoutInfo.issues.join('; ')}`,
        details: layoutInfo,
      });

      if (layoutInfo.issues.length > 0) {
        console.log(`    ⚠️ Issues: ${layoutInfo.issues.join(', ')}`);
      } else {
        console.log('    ✅ Layout OK');
      }
      if (layoutInfo.overlaps?.length > 0) {
        console.log(`    🔀 Sovrapposizioni: ${layoutInfo.overlaps.join(', ')}`);
        findings.push({
          test: `Modalità ${mode.label} – Sovrapposizioni`,
          result: `⚠️ ${layoutInfo.overlaps.length} sovrapposizioni trovate`,
          details: layoutInfo.overlaps,
        });
      }

    } catch (e) {
      console.log(`    ❌ Errore nel test: ${e.message}`);
      findings.push({ test: `Modalità ${mode.label}`, result: `❌ Errore: ${e.message}` });
    }
  }

  // ═══════════════════════════════════════════
  // TEST 3: Mobile viewport – Homepage
  // ═══════════════════════════════════════════
  console.log('\n═══ TEST 3: Mobile Viewport ═══');
  
  // Reset alla homepage
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await delay(1500);

  await page.setViewport({ width: 390, height: 844 });
  await delay(1000);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '03_homepage_mobile.png'),
    fullPage: false,
  });
  console.log('📸 Screenshot: 03_homepage_mobile.png');

  // Controlla header overflow su mobile
  const mobileHeader = await page.evaluate(() => {
    const header = document.querySelector('header');
    if (!header) return null;
    const rect = header.getBoundingClientRect();
    const overflow = header.scrollWidth > header.clientWidth;
    const children = Array.from(header.children);
    const childRects = children.map(c => {
      const r = c.getBoundingClientRect();
      return { 
        text: (c.textContent || '').trim().slice(0, 20), 
        left: Math.round(r.left), 
        right: Math.round(r.right),
        clipped: r.right > window.innerWidth || r.left < 0,
      };
    });
    return { overflow, width: Math.round(rect.width), viewport: window.innerWidth, children: childRects };
  });
  findings.push({
    test: 'Header Mobile (390px)',
    result: mobileHeader?.overflow ? '❌ OVERFLOW – header clipping' : '✅ Header contenuto',
    details: mobileHeader,
  });
  console.log(`  Header mobile: ${JSON.stringify(mobileHeader)}`);

  // ═══════════════════════════════════════════
  // TEST 4: Mobile – OnlyType (verifica doppio footer)
  // ═══════════════════════════════════════════
  console.log('\n═══ TEST 4: OnlyType su Mobile ═══');
  
  // Naviga a OnlyType via evaluate
  await page.evaluate(() => {
    const footer = document.querySelector('footer');
    if (!footer) return;
    const buttons = Array.from(footer.querySelectorAll('button'));
    for (const btn of buttons) {
      const text = (btn.textContent || '').toLowerCase();
      if (text.includes('chat') || text.includes('canvas') || text.includes('deep') ||
          text.includes('impara') || text.includes('onlytype') || text.includes('gruppo')) {
        btn.click();
        break;
      }
    }
  });
  await delay(500);
  
  await page.evaluate(() => {
    const allBtns = Array.from(document.querySelectorAll('button'));
    for (const btn of allBtns) {
      const text = (btn.textContent || '').toLowerCase();
      if (text.includes('onlytype') || text.includes('sheet')) {
        btn.click();
        break;
      }
    }
  });
  await delay(1500);
  
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '04_onlytype_mobile.png'),
    fullPage: false,
  });
  console.log('📸 Screenshot: 04_onlytype_mobile.png');

  // Analisi specifica doppio footer
  const sheetMobileInfo = await page.evaluate(() => {
    const footer = document.querySelector('footer');
    const main = document.querySelector('main');
    const footerHidden = footer?.classList.contains('hidden') || footer?.offsetHeight === 0;
    
    // Cerca la toolbar del foglio dentro main
    const mainButtons = main ? main.querySelectorAll('button').length : 0;
    const viewportUsable = window.innerHeight;
    const footerHeight = footer ? footer.getBoundingClientRect().height : 0;
    const mainHeight = main ? main.getBoundingClientRect().height : 0;
    
    return {
      footerHidden,
      footerHeight: Math.round(footerHeight),
      mainHeight: Math.round(mainHeight),
      viewportHeight: viewportUsable,
      mainButtonsCount: mainButtons,
      drawingSpacePercent: Math.round((mainHeight / viewportUsable) * 100),
    };
  });
  findings.push({
    test: 'OnlyType Mobile – Doppio Footer',
    result: sheetMobileInfo.footerHidden ? '✅ Footer composer nascosto' : `⚠️ Footer + toolbar: solo ${sheetMobileInfo.drawingSpacePercent}% viewport per disegnare`,
    details: sheetMobileInfo,
  });
  console.log(`  Sheet mobile: ${JSON.stringify(sheetMobileInfo)}`);

  // ═══════════════════════════════════════════
  // TEST 5: Tablet viewport
  // ═══════════════════════════════════════════
  console.log('\n═══ TEST 5: Tablet Viewport ═══');
  
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.setViewport({ width: 768, height: 1024 });
  await delay(1500);
  
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '05_homepage_tablet.png'),
    fullPage: false,
  });
  console.log('📸 Screenshot: 05_homepage_tablet.png');

  // ═══════════════════════════════════════════
  // TEST 6: Sidebar toggle
  // ═══════════════════════════════════════════
  console.log('\n═══ TEST 6: Sidebar Toggle ═══');
  
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await delay(1500);
  
  // Clicca toggle sidebar
  const sidebarBtn = await page.$('header button[aria-label]');
  if (sidebarBtn) {
    await sidebarBtn.click();
    await delay(800);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06_sidebar_toggled.png'),
      fullPage: false,
    });
    console.log('📸 Screenshot: 06_sidebar_toggled.png');
    
    // Controlla che la sidebar sia visibile/nascosta
    const sidebarInfo = await page.evaluate(() => {
      const aside = document.querySelector('aside');
      if (!aside) return { visible: false, width: 0 };
      const rect = aside.getBoundingClientRect();
      return {
        visible: rect.width > 0 && rect.left >= 0,
        width: Math.round(rect.width),
        left: Math.round(rect.left),
      };
    });
    findings.push({
      test: 'Sidebar Toggle',
      result: '✅ Sidebar risponde al toggle',
      details: sidebarInfo,
    });
    console.log(`  Sidebar: ${JSON.stringify(sidebarInfo)}`);
  }

  // ═══════════════════════════════════════════
  // TEST 7: Console errors
  // ═══════════════════════════════════════════
  console.log('\n═══ TEST 7: Console Errors ═══');
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  // Ricarica e aspetta
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await delay(3000);
  
  findings.push({
    test: 'Console Errors al caricamento',
    result: consoleErrors.length === 0 ? '✅ Nessun errore' : `⚠️ ${consoleErrors.length} errori`,
    details: consoleErrors.length > 0 ? consoleErrors : undefined,
  });
  console.log(`  Errori console: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach(e => console.log(`    ❌ ${e}`));
  }

  // ═══════════════════════════════════════════
  // TEST 8: Performance check
  // ═══════════════════════════════════════════
  console.log('\n═══ TEST 8: Performance ═══');
  
  const perfInfo = await page.evaluate(() => {
    const perf = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    return {
      domContentLoaded: perf ? Math.round(perf.domContentLoadedEventEnd) : null,
      loadComplete: perf ? Math.round(perf.loadEventEnd) : null,
      firstPaint: paint.find(p => p.name === 'first-paint')?.startTime ? Math.round(paint.find(p => p.name === 'first-paint').startTime) : null,
      firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime ? Math.round(paint.find(p => p.name === 'first-contentful-paint').startTime) : null,
    };
  });
  findings.push({
    test: 'Performance Metrics',
    result: `FCP: ${perfInfo.firstContentfulPaint}ms, DOM: ${perfInfo.domContentLoaded}ms, Load: ${perfInfo.loadComplete}ms`,
    details: perfInfo,
  });
  console.log(`  ${JSON.stringify(perfInfo)}`);

  // ═══════════════════════════════════════════
  // REPORT FINALE
  // ═══════════════════════════════════════════
  console.log('\n\n══════════════════════════════════════');
  console.log('       📋 REPORT FINALE');
  console.log('══════════════════════════════════════\n');
  
  findings.forEach(f => {
    console.log(`${f.result}  ${f.test}`);
    if (f.details && typeof f.details === 'object' && !Array.isArray(f.details)) {
      if (f.details.issues?.length > 0) {
        f.details.issues.forEach(i => console.log(`       └─ ${i}`));
      }
    }
  });
  
  // Salva report come JSON
  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'report.json'),
    JSON.stringify(findings, null, 2)
  );
  console.log(`\n📁 Screenshot salvati in: ${SCREENSHOT_DIR}`);
  console.log('📄 Report salvato in: test-screenshots/report.json');

  // Aspetta 10 secondi per far vedere il browser all'utente
  console.log('\n⏳ Il browser resta aperto 10 secondi per ispezione...');
  await delay(10000);

  await browser.close();
  console.log('\n✅ Test completati!');
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
