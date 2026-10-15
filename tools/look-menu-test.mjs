// Оформление: стиль доступен сразу, настройки раскрываются, кнопки удобны пальцем.
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const [name,width,height,mobile] of [['phone',390,844,true],['tablet',820,1180,true],['desk',1440,900,false]]) {
    const page = await browser.newPage({ viewport:{width,height},isMobile:mobile,hasTouch:mobile });
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:4180/'); await page.waitForFunction(()=>window.__app?.state?.lastEp);
    await page.click('#tabs button[data-t="look"]');
    const first = await page.evaluate(()=>({
      sections:[...document.querySelectorAll('#t-look > details > summary')].map(e=>e.firstChild.textContent.trim()),
      open:[...document.querySelectorAll('#t-look > details[open]')].map(e=>e.id),
      styles:[...document.querySelectorAll('#styles button')].map(e=>{const r=e.getBoundingClientRect();return [r.top,r.bottom];}),
      scroll:document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    if (first.sections.join('|') !== 'Цвета и шрифты|Надписи|Логотип|Экраны ролика|Карта') throw new Error(`${name}: неверные группы ${first.sections}`);
    if (mobile && (first.open.length || first.styles.some(([top,bottom])=>top<0 || bottom>height))) throw new Error(`${name}: до выбора стиля нужна прокрутка ${JSON.stringify(first)}`);
    if (first.scroll) throw new Error(`${name}: горизонтальная прокрутка`);
    for (const id of ['appearanceBox','labelsBox','logoBox','screensBox','mapBox']) {
      await page.evaluate(id=>{for(const e of document.querySelectorAll('#t-look > details'))e.open=e.id===id;},id);
      const small = await page.evaluate(()=>[...document.querySelectorAll('#t-look button,#t-look summary')].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.width<44 || r.height<44;}).map(e=>e.textContent.trim().slice(0,30)));
      if (small.length) throw new Error(`${name}/${id}: мелкие кнопки ${small}`);
    }
    await page.locator('#mapSettings input[data-k="relief"]').check();
    if (!await page.evaluate(()=>__app.state.relief && __app.state.show.relief)) throw new Error('Выбор карты перестал работать');
    await page.locator('#mapSettings input[data-k="relief"]').uncheck();
    await page.evaluate(mobile=>{for(const e of document.querySelectorAll('#t-look > details'))e.open=!mobile && e.id==='appearanceBox';document.getElementById('tabs').scrollIntoView({block:'start'});},mobile);
    await page.screenshot({path:`out/look-${name}.png`});
    if(errors.length)throw new Error(errors.join('\n'));
    console.log('OK',name,'стиль без прокрутки; 5 групп, кнопки ≥44×44, выбор карты работает');
    await page.close();
  }
} finally {await browser.close();}
