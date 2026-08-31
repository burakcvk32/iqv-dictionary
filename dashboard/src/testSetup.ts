import '@testing-library/jest-dom/vitest';

// antd/rc-* bileşenleri (responsive Grid, Tooltip/Popover konumlandırma,
// ProTable) jsdom'da VARSAYILAN OLARAK bulunmayan birkaç tarayıcı API'sine
// güvenir -- bunlar eksik olduğunda antd genellikle bir hata FIRLATMAZ,
// bunun yerine ilgili hook sessizce hiç çözülmeyen bir duruma düşer (test
// çalıştırması "asılı kalır"). Bu, GERÇEK proje kodunun bir kusuru DEĞİL,
// yalnızca jsdom'un tarayıcı API yüzeyinin bilinen, standart bir eksikliği
// -- bu yüzden burada, uygulama mantığına DOKUNMADAN, yalnızca test
// altyapısı seviyesinde polyfill'leniyor.
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }

  if (!('ResizeObserver' in window)) {
    class ResizeObserverPolyfill {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    // @ts-expect-error -- jsdom polyfill, gercek tip tanimina gerek yok
    window.ResizeObserver = ResizeObserverPolyfill;
  }

  if (!('IntersectionObserver' in window)) {
    class IntersectionObserverPolyfill {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    // @ts-expect-error -- jsdom polyfill, gercek tip tanimina gerek yok
    window.IntersectionObserver = IntersectionObserverPolyfill;
  }

  if (!window.getComputedStyle) {
    // no-op: jsdom zaten saglar, burada yalnizca guvenlik amacli kontrol
  }
}
