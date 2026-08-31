/*
 * IQV Dictionary -- Swagger UI iki seviyeli gruplama.
 *
 * REFERANS: IQV Flex ERP (kardes proje) ->
 * backend/src/config/swagger-assets/iqv-swagger-groups.js (kendisi de IQV
 * Platform'daki AYNI ilkeyi uygular). Bu dosya, ERP'de CALISAN mekanizma
 * BIREBIR ayni ilkeyle burada uygulanir; Dictionary'e ozgu FARKLI bir
 * cozum URETILMEZ (yalnizca metinler -- baslik/aciklama -- ve
 * siniflandirma etiketleri -- OUTPUT yerine EXTERNAL -- Dictionary'e
 * uyarlanir).
 *
 * NEDEN GEREKLI?
 *   Swagger UI'in tag sistemi TEK SEVIYELIDIR: bir operasyon yalnizca duz
 *   bir tag listesine girer, "grup -> alt grup" hiyerarsisi YOKTUR.
 *
 * NASIL CALISIR?
 *   OpenAPI tag adlari `<KOK GRUP> / <ALAN>` bicimindedir
 *   (ör. "TOTAL APIs / Dictionary", "SYSTEM APIs / Health") -- bkz. backend
 *   `src/docs/swagger.ts` -> `applyIqvTaxonomy()`. Bu betik Swagger UI
 *   cizimini bitirdikten SONRA olusan bolumleri (`.opblock-tag-section`)
 *   kok gruplarina gore 4 acilir baslik altinda TOPLAR.
 *
 * ONEMLI TASARIM KURALLARI
 *   - Bolumler TASINIR (appendChild), YENIDEN OLUSTURULMAZ. Swagger UI'in
 *     React agaci bozulmaz; "Try it out", "Execute", "Authorize" ve
 *     ornekler AYNEN calisir.
 *   - Harici dosya olarak yuklenir; satir ici script DEGILDIR.
 *   - Spec'e DOKUNMAZ; ag istegi YAPMAZ (sayaclar Swagger UI'nin KENDI
 *     Redux durumundan okunur).
 *   - Betik yuklenmezse sayfa yine calisir; yalnizca gruplar duz listelenir.
 *   - Konsola HICBIR sey YAZMAZ (gelistirme/debug log'u degildir).
 */
(function () {
  'use strict';

  var SEPARATOR = ' / ';
  var ROOT_GROUPS = ['TOTAL APIs', 'INTERNAL APIs', 'EXTERNAL APIs', 'SYSTEM APIs'];
  var STYLE_ID = 'iqv-swagger-groups-style';
  var ROOT_CLASS = 'iqv-root-group';

  var GROUP_DESCRIPTIONS = {
    'TOTAL APIs': 'IQV Dictionary üzerinde tanımlı tüm API operasyonları.',
    'INTERNAL APIs':
      'IQV Dictionary uygulamasının kendi iş süreçlerinde kullandığı API operasyonları.',
    'EXTERNAL APIs':
      'Harici sistemler/istemciler tarafından kullanılabilen API operasyonları.',
    'SYSTEM APIs': 'Kimlik doğrulama, sağlık kontrolü ve teknik servisler.',
  };

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.' + ROOT_CLASS + '{border-bottom:1px solid rgba(59,65,81,.2);margin:0 0 12px}',
      '.' + ROOT_CLASS + '__head{display:flex;align-items:center;gap:12px;',
      '  cursor:pointer;padding:14px 20px;background:#fafafa;',
      '  border:1px solid rgba(59,65,81,.2);border-radius:4px;user-select:none}',
      '.' + ROOT_CLASS + '__head:hover{background:#f0f0f0}',
      '.' + ROOT_CLASS + '__title{font-family:sans-serif;font-size:22px;',
      '  font-weight:700;color:#3b4151;margin:0}',
      '.' + ROOT_CLASS + '__count{font-family:sans-serif;font-size:14px;',
      '  font-weight:600;color:#fff;background:#4990e2;border-radius:12px;padding:2px 10px}',
      '.' + ROOT_CLASS + '__desc{font-family:sans-serif;font-size:13px;color:#3b4151;flex:1}',
      '.' + ROOT_CLASS + '__arrow{font-family:sans-serif;font-size:16px;color:#3b4151}',
      '.' + ROOT_CLASS + '__body{padding:6px 0 0 18px;border-left:2px solid rgba(73,144,226,.35);margin-left:20px}',
      '.' + ROOT_CLASS + '[data-open="false"] .' + ROOT_CLASS + '__body{display:none}',
    ].join('\n');
    document.head.appendChild(style);
  }

  /** "TOTAL APIs / Dictionary" -> { group:"TOTAL APIs", domain:"Dictionary" } */
  function splitTagName(name) {
    var index = name.indexOf(SEPARATOR);
    if (index === -1) return null;
    return {
      group: name.slice(0, index),
      domain: name.slice(index + SEPARATOR.length),
    };
  }

  /**
   * Kok grup basina OPERASYON sayisini Swagger UI'in kendi spec
   * secicisinden okur.
   *
   * NEDEN DOM'dan sayilmaz? `docExpansion: 'none'` ile bolumler kapali
   * gelir ve Swagger UI operasyon satirlarini (`.opblock`) HENUZ CIZMEZ;
   * DOM'dan sayim 0 verirdi. `window.ui` yoksa sayac gizlenir, gruplama
   * yine calisir.
   */
  function operationCounts() {
    var result = {};
    try {
      var tagged = window.ui.specSelectors.taggedOperations();
      tagged.forEach(function (value, tagName) {
        var parsed = splitTagName(String(tagName));
        if (!parsed) return;
        var operations = value.get('operations');
        var size = operations && operations.size ? operations.size : 0;
        result[parsed.group] = (result[parsed.group] || 0) + size;
      });
      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Bir alan (domain) bolumunu ACAR -- Swagger UI'in KENDI durumunu
   * kullanarak.
   *
   * ONCE `window.ui.layoutActions.show(['operations-tag', <tag>], true)`
   * denenir; bu Swagger UI'in gercek state'idir, sahte CSS DEGILDIR.
   * `window.ui` erisilemezse bolum ZATEN KAPALIYSA basligina TIKLANIR --
   * yani yine Swagger'in kendi kontrolu calisir.
   *
   * Zaten acik bolume DOKUNULMAZ (tekrar tiklayip kapatmaz). OPERASYON
   * detaylari BU FONKSIYONDA ACILMAZ; yalnizca tag bolumu acilir.
   */
  function openTagSection(section) {
    if (section.classList.contains('is-open')) return;

    var heading = section.querySelector('.opblock-tag');
    var tagName = heading ? heading.getAttribute('data-tag') : null;

    if (tagName) {
      try {
        window.ui.layoutActions.show(['operations-tag', tagName], true);
        return;
      } catch (error) {
        /* window.ui yok/degisti -> asagidaki yedege dusulur */
      }
    }

    if (heading) heading.click();
  }

  /** Kok grup govdesindeki TUM alan bolumlerini acar. */
  function openAllDomains(body) {
    var sections = body.querySelectorAll('.opblock-tag-section');
    for (var i = 0; i < sections.length; i += 1) {
      openTagSection(sections[i]);
    }
  }

  /** Bolumun tag adini DOM'dan okur. */
  function readTagName(section) {
    var heading = section.querySelector('.opblock-tag');
    if (!heading) return null;
    var explicit = heading.getAttribute('data-tag');
    if (explicit) return explicit;
    var anchor = heading.querySelector('a span');
    if (anchor && anchor.textContent) return anchor.textContent.trim();
    return heading.textContent ? heading.textContent.trim().split('\n')[0] : null;
  }

  function buildRootGroup(groupName) {
    var wrapper = document.createElement('section');
    wrapper.className = ROOT_CLASS;
    wrapper.setAttribute('data-group', groupName);
    wrapper.setAttribute('data-open', 'false');

    var head = document.createElement('div');
    head.className = ROOT_CLASS + '__head';
    head.setAttribute('role', 'button');
    head.setAttribute('tabindex', '0');
    head.setAttribute('aria-expanded', 'false');

    var arrow = document.createElement('span');
    arrow.className = ROOT_CLASS + '__arrow';
    arrow.textContent = '▶';

    var title = document.createElement('h3');
    title.className = ROOT_CLASS + '__title';
    title.textContent = groupName;

    var count = document.createElement('span');
    count.className = ROOT_CLASS + '__count';

    var description = document.createElement('span');
    description.className = ROOT_CLASS + '__desc';
    description.textContent = GROUP_DESCRIPTIONS[groupName] || '';

    head.appendChild(arrow);
    head.appendChild(title);
    head.appendChild(count);
    head.appendChild(description);

    var body = document.createElement('div');
    body.className = ROOT_CLASS + '__body';

    function toggle() {
      var wasOpen = wrapper.getAttribute('data-open') === 'true';
      var willOpen = !wasOpen;

      wrapper.setAttribute('data-open', willOpen ? 'true' : 'false');
      head.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      arrow.textContent = willOpen ? '▼' : '▶';

      // KOK grup ACILDIGI ANDA icindeki TUM alan gruplari otomatik acilir.
      // Bu YALNIZCA acilma gecisinde olur; kullanici bir alani sonradan
      // kapatirsa KENDILIGINDEN tekrar ACILMAZ. Kok kapatilip yeniden
      // acilirsa hepsi YENIDEN acilir (istenen davranis).
      if (willOpen) openAllDomains(body);
    }

    head.addEventListener('click', toggle);
    head.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });

    wrapper.appendChild(head);
    wrapper.appendChild(body);
    wrapper._iqvBody = body;
    wrapper._iqvCount = count;
    return wrapper;
  }

  function regroup() {
    var sections = document.querySelectorAll('.swagger-ui .opblock-tag-section');
    if (!sections.length) return false;

    // Zaten gruplanmis mi? (Swagger UI yeniden cizerse tekrar calisiriz.)
    var first = sections[0];
    if (first.parentElement && first.parentElement.className.indexOf(ROOT_CLASS) !== -1) {
      return true;
    }

    var parent = first.parentElement;
    if (!parent) return false;

    injectStyle();

    var wrappers = {};
    var sectionCounts = {};
    var anchor = first;

    for (var i = 0; i < ROOT_GROUPS.length; i += 1) {
      var groupName = ROOT_GROUPS[i];
      // ONCE mevcut sarmalayici aranir: Swagger UI bolumleri yeniden
      // cizerse IKINCI bir kok grup OLUSTURULMAZ ve acik/kapali durum
      // KORUNUR.
      var existingWrapper = document.querySelector('.' + ROOT_CLASS + '[data-group="' + groupName + '"]');
      wrappers[groupName] = existingWrapper || buildRootGroup(groupName);
      sectionCounts[groupName] = 0;
      if (!existingWrapper) parent.insertBefore(wrappers[groupName], anchor);
    }

    for (var j = 0; j < sections.length; j += 1) {
      var section = sections[j];
      var tagName = readTagName(section);
      var parsed = tagName ? splitTagName(tagName) : null;
      if (!parsed || !wrappers[parsed.group]) continue;

      // Alt grup basliginda yalnizca ALAN adi kalsin ("TOTAL APIs / " silinir).
      var heading = section.querySelector('.opblock-tag a span');
      if (heading && heading.textContent) {
        heading.textContent = parsed.domain;
      }

      sectionCounts[parsed.group] += 1;
      wrappers[parsed.group]._iqvBody.appendChild(section);
    }

    var operations = operationCounts();
    for (var k = 0; k < ROOT_GROUPS.length; k += 1) {
      var name = ROOT_GROUPS[k];
      if (operations && typeof operations[name] === 'number') {
        wrappers[name]._iqvCount.textContent = String(operations[name]);
      } else {
        wrappers[name]._iqvCount.style.display = 'none';
      }
      // Kok grup YALNIZCA hic alt bolumu yoksa gizlenir.
      if (sectionCounts[name] === 0) wrappers[name].style.display = 'none';
    }

    return true;
  }

  /**
   * Swagger UI, spec'i AG UZERINDEN cektigi icin cizim gecikmeli olur.
   * Kisa araliklarla dener; basarinca durur. Ayrica sonraki yeniden
   * cizimleri yakalamak icin MutationObserver kurulur.
   */
  function start() {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (regroup() || attempts > 100) {
        clearInterval(timer);
        observe();
      }
    }, 150);
  }

  function observe() {
    var root = document.getElementById('swagger-ui');
    if (!root || typeof MutationObserver === 'undefined') return;
    var scheduled = false;
    new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      setTimeout(function () {
        scheduled = false;
        regroup();
      }, 120);
    }).observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
