import { useEffect, useState } from 'react';

// Ekran genisligi yalnizca `resize` olayinda DEGIL, ekran yon degisiminde
// (`orientationchange` -- bazi eski mobil tarayicilarda `resize` yon
// degisiminde guvenilir sekilde tetiklenmeyebilir) ve sekme arka plandan/
// gecmis onbellekten (bfcache) geri geldiginde de (`pageshow`) YENIDEN
// OKUNUR. Ikinci durum onemlidir: React state'i (`width`) bfcache
// dondurulmus bir sekmede EN SON deger ile bellekte kalir; sekme geri
// donerken (ozellikle ekran yonu degismisse veya farkli bir cihaza/
// pencereye tasinmissa) `resize` tetiklenmeyebilir, bu yuzden `pageshow`
// GENISLIGI ACIKCA yeniden okur. Uc olay da AYNI tek handler'i kullanir --
// gereksiz render dongusu olusturmadan (yalnizca genislik GERCEKTEN
// degismisse `setWidth` state'i degistirir, React zaten ayni deger icin
// re-render tetiklemez).
//
// NOT: Bu davranis IQV Platform projesindeki GERCEK
// `components/hooks/breakpoint.tsx` ile BIREBIR aynidir (Platform
// Frontend/dashboard/src/components/hooks/breakpoint.tsx) -- Dictionary'nin
// onceki surumu yalnizca `resize` dinliyordu, bu TURN'de Platform'un
// gercek implementasyonuna gore tamamlandi.
const useBreakpoint = (breakPoint = 768) => {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const recalculate = () => setWidth(window.innerWidth);

    window.addEventListener('resize', recalculate);
    window.addEventListener('orientationchange', recalculate);
    window.addEventListener('pageshow', recalculate);

    return () => {
      window.removeEventListener('resize', recalculate);
      window.removeEventListener('orientationchange', recalculate);
      window.removeEventListener('pageshow', recalculate);
    };
  }, []);

  return width < breakPoint;
};

export default useBreakpoint;
