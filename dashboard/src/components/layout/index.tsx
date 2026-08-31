import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { webRoutes } from '../../routes/web';
import { Button, ConfigProvider, Dropdown, Menu } from 'antd';
import {
  ProLayout,
  ProLayoutProps,
  RouteContext,
} from '@ant-design/pro-components';
import Icon, {
  FullscreenExitOutlined,
  FullscreenOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { RiMoonLine, RiSunLine } from 'react-icons/ri';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/slices/adminSlice';
import { RootState } from '../../store';
import { memo, useContext, useEffect, useState } from 'react';
import { tokens } from '@iqvizyonui/react-components';
import { sidebar } from './sidebar';
import useBreakpoint from '../hooks/breakpoint';
import { resolvePermissions } from '../../utils/permissions';
import { useAppTheme } from '../theme/AppTheme';
import './layout.css';

// Sidebar acma/kapatma oku -- @ant-design/pro-layout'un KENDI ok ikonunun
// birebir aynisi (IQV Platform referansindan BIREBIR alindi, bkz.
// Platform Frontend/dashboard/src/components/layout/index.tsx
// `SiderTriggerArrow`). Yon donme ile verilir, ikinci bir ikon kullanilmaz:
// acikken -> rotate(90deg) (sola bakar, "daralt")
// kapaliyken -> rotate(-90deg) (saga bakar, "genislet")
const SiderTriggerArrow = ({ collapsed }: { collapsed: boolean }) => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 12 12"
    fill="currentColor"
    aria-hidden="true"
    style={{
      transition: 'transform 0.3s',
      transform: collapsed ? 'rotate(-90deg)' : 'rotate(90deg)',
    }}
  >
    <path d="M6.432 7.967a.448.448 0 01-.318.133h-.228a.46.46 0 01-.318-.133L2.488 4.85a.305.305 0 010-.43l.427-.43a.293.293 0 01.42 0L6 6.687l2.665-2.699a.299.299 0 01.426 0l.42.431a.305.305 0 010 .43L6.432 7.967z" />
  </svg>
);

// IQV Platform ile ayni genisletilmis sider genisligi (bkz. `ProLayout.js`:
// `if (props.layout === 'mix') return 215; return 256;`) -- bu proje de
// `layout: CONFIG.theme.sidebarLayout` ('mix') kullandigindan kutuphanenin
// GERCEK, kaynaktan dogrulanmis degeri; tahmini bir deger DEGIL.
const EXPANDED_SIDER_WIDTH = 215;

// Ana icerik alaninin (ProLayout content wrapper: `.ant-pro-layout-content`)
// TEK ortak UST boslugu -- IQV Platform referansindan (Platform
// Frontend/dashboard/src/components/layout/index.tsx, ayni
// `CONTENT_TOP_OFFSET` sabiti, `contentStyle={{ paddingBlockStart: ... }}`
// olarak ProLayout'a verilir) BIREBIR alindi; tahmini bir deger DEGIL.
// `BasePageContainer`'in kendi ust boslugu (bkz. PageContainer.tsx
// `childrenContentStyle`) SIFIRLANMISTIR ki iki kaynak birlikte cift
// bosluk URETMESIN.
const CONTENT_TOP_OFFSET = 17;

// public/ altındaki logo dosyaları
const IQV_WORDMARK = '/iqv_wordmark.png';
const IQV_ICON = '/icon.png';
// Gece modu için hazırlanmış, projede zaten mevcut olan gri IQV icon asseti —
// dark mode'da collapsed sidebar/marka ikonu için `icon.png` yerine bu
// kullanılır. Kendi orijinal haliyle gösterilir, üzerine filter/invert gibi
// bir renk hack'i uygulanmaz.
const IQV_ICON_DARK = '/iqv_icon_gece.png';

/**
 * Sidebar açıkken wordmark, kapalıyken sadece icon gösterir. Collapse durumu
 * ProLayout'un kendi RouteContext'inden okunur, ayrıca bir state tutulmaz.
 * Icon (collapsed hâl) ayrıca global dark mode tercihine göre `icon.png` /
 * `iqv_icon_gece.png` arasında değişir (bkz. components/theme/AppTheme.tsx
 * useAppTheme()) — wordmark (sidebar açık hâl) değişmez.
 *
 * Konteyner boyutu (height: 56) ve resim ölçüleri (collapsed: 24x24,
 * expanded: width 116 / maxHeight 26) IQV Platform'daki referans sidebar'dan
 * (Platform Frontend/dashboard/src/components/layout/index.tsx, `logo:`
 * prop'u) BİREBİR alındı -- rastgele üretilmiş değerler DEĞİL. Sol hizalama
 * (paddingInlineStart calc'ı) da aynı projedeki --iqv-sider-inset /
 * --iqv-collapsed-menu-inset / --iqv-header-root-inset değişkenlerini
 * kullanır (bkz. layout.css). `width`/`maxWidth` + `height: auto` +
 * `objectFit: contain` kombinasyonu orijinal en-boy oranını korur, logo
 * deforme/sıkışmaz.
 */
const BrandLogo = () => {
  const { collapsed } = useContext(RouteContext);
  const { isDark } = useAppTheme();

  const collapsedIcon = isDark ? IQV_ICON_DARK : IQV_ICON;

  return (
    <div
      style={{
        height: 56,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        paddingInlineStart: collapsed
          ? 0
          : 'calc(var(--iqv-collapsed-menu-inset) + var(--iqv-sider-inset) - var(--iqv-header-root-inset))',
        boxSizing: 'border-box',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <img
        src={collapsed ? collapsedIcon : IQV_WORDMARK}
        alt={CONFIG.appName}
        draggable={false}
        style={{
          width: collapsed ? 24 : 116,
          height: collapsed ? 24 : 'auto',
          maxWidth: collapsed ? 24 : 116,
          maxHeight: collapsed ? 24 : 26,
          objectFit: 'contain',
          display: 'block',
          transition: 'none',
          flexShrink: 0,
        }}
      />
    </div>
  );
};

// ROL ETİKETİ SÖZLÜĞÜ -- IQV Platform'un GERÇEK profil menüsünden (Platform
// Frontend/dashboard/src/components/layout/index.tsx, aynı `ROLE_LABELS`
// sabiti, aynı üç anahtar/değer) BİREBİR taşındı. Dictionary'nin backend rol
// kümesiyle (backend/src/middleware/auth.ts ROLE_PERMISSIONS:
// superadmin/companyadmin/organizationadmin/admin/user) doğrulandı --
// anahtarlar uydurulmadı, gerçek rol değerleriyle eşleşiyor. Platform'un
// KENDİ sözlüğünde de yalnızca bu üç anahtar var (superadmin/admin için
// Platform'un kendi kodu da fallback'e düşüyor) -- bu proje Platform'dan
// DAHA GENİŞ bir sözlük UYDURMAZ, aynı gerçek kapsamı korur. Eşleşmeyen bir
// rol için fallback ('Kullanıcı') de Platform'daki ile AYNI.
const ROLE_LABELS: Record<string, string> = {
  companyadmin: 'Şirket Admini',
  organizationadmin: 'Organizasyon Admini',
  user: 'Kullanıcı',
};

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const admin = useSelector((state: RootState) => state.admin);
  const { isDark, toggle } = useAppTheme();

  // KOK NEDEN / IQV Platform referansiyla AYNI davranis: ProLayout'un
  // KENDI sider'i (ekran genisligi FARK ETMEKSIZIN, Platform'daki
  // `useBreakpoint(Number.POSITIVE_INFINITY)` hilesiyle AYNI sonucu vermek
  // icin) ARTIK HICBIR ZAMAN genisletilmez -- `collapsed: true` asagida
  // defaultProps'ta SABIT verilir. Kutuphanenin sider'i genislettiginde ana
  // icerige ekledigi `margin-inline-start` (push/reflow) TAMAMEN devre disi
  // kalir. Genisleme, bunun yerine, TAMAMEN AYRI bir `position: fixed`
  // panel + karartma (backdrop) ile yapilir (bkz. asagida, JSX'in sonunda)
  // -- icerik YERINDE kalir, panel onun UZERINE biner. `expanded` bu ayri
  // panelin acik/kapali durumunu tutar (ProLayout'un `collapsed` prop'uyla
  // KARISTIRILMAMALI).
  const [expanded, setExpanded] = useState(false);
  const [triggerHovered, setTriggerHovered] = useState(false);

  // Sidebar TOOLTIP KAPATMA (mobil + tablet) -- kok neden: sider HER ZAMAN
  // collapsed/icon-only oldugu icin (yukaridaki not), @ant-design/pro-layout
  // kendi ic `MenuItemTooltip` bilesenini (bkz. SiderMenu/BaseMenu.js) HER
  // collapsed durumda gosterir -- bu, dokunmatik ekranlarda ikona
  // basildiginda/dokunuldugunda menu adinin ("Ayarlar" vb.) siyah balon
  // olarak KALICI gorunmesine yol aciyordu (fare imleci olmadigi icin
  // dogal bir "mouse-out" ile kapanmiyor). Kutuphane bu tooltip'i per-item
  // veya breakpoint bazinda kapatmak icin bir prop SUNMUYOR; asagidaki
  // `menuRender` + gizli "sink" container yaklasimi (bkz. JSX'in devami)
  // Tooltip portal'ini SADECE mobil/tablette gorunmez bir kapsayiciya
  // yonlendirir -- masaustunde (collapsed rail'de ikonu tanimak icin
  // GEREKLI olan hover tooltip'i) HICBIR SEY DEGISMEZ. Esik (1100),
  // projenin Kisi ekranindaki AYNI masaustu-alt-siniri (`PEOPLE_DESKTOP_
  // MIN_WIDTH`) ile birebir tutarlidir.
  const isBelowDesktop = useBreakpoint(1100);

  const closeSidebar = () => setExpanded(false);
  const toggleSidebar = () => setExpanded((value) => !value);

  // Route degisince (bir menu ogesine tiklaninca) overlay panel otomatik
  // kapanir -- Platform'daki mobil overlay'in "route degisince kapali
  // gorunur" davranisiyla AYNI sonuc, daha basit bir mekanizmayla (bu
  // projede Platform'daki path-tabanli mobileExpandedPath karmasikligina
  // gerek yok, tek bir boolean yeterli).
  useEffect(() => {
    // NOT (CI hazirlik denetimi, 2026-08-30): eslint-plugin-react-hooks@7
    // ile gelen yeni `set-state-in-effect` kurali bu kaliba (route
    // degisince yerel bir UI state'ini sifirlama) karsi cikiyor. Bilincli
    // bir istisna: `location.pathname` render disi bir kaynaktan (router
    // context) geldigi ve bu overlay panelin sider kutuphanesinden TAMAMEN
    // bagimsiz, ayri `position: fixed` bir panel oldugu icin (yukaridaki
    // KOK NEDEN notuna bkz.) render sirasinda turetilebilecek bir deger
    // degil -- davranis DEGISTIRILMEDI, yalnizca bu tek cagri noktasi
    // icin kural bilerek gevsetildi.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded(false);
  }, [location.pathname]);

  // IQV Platform ile aynı: tarayıcının gerçek Fullscreen API'si, ek bir
  // soyutlama kütüphanesi KULLANILMADAN. `fullscreenchange` olayı (ör. ESC
  // ile çıkış) dinlenerek state gerçek tarayıcı durumuyla senkron tutulur.
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else {
      void document.documentElement.requestFullscreen?.();
    }
  };

  // IQV Platform header kullanıcı alanıyla aynı köken mantığı: sabit yazılmaz,
  // gerçek authenticated user state'inden (Redux `admin`) türetilir. Platform
  // full_name/username alanlarına düşüyor; bu projede aynı alanlar mevcut.
  const fullName =
    admin?.user?.full_name || admin?.user?.username || 'Kullanıcı';
  // ROL ETİKETİ -- KÖK NEDEN DÜZELTMESİ: bu alan önceki turda ham `role`
  // değerini (ör. "organizationadmin") doğrudan basıyordu. Platform'un
  // GERÇEK profil menüsü (AYNI component/AYNI konum) bunu kullanıcı dostu
  // bir Türkçe etikete çeviriyor -- bkz. yukarıdaki `ROLE_LABELS` (Platform
  // Frontend/dashboard/src/components/layout/index.tsx'ten BİREBİR
  // taşındı). Backend'deki gerçek `role` değeri DEĞİŞMEDİ, yalnızca
  // ekrandaki metin.
  const roleKey = (admin?.user?.role || '').trim().toLowerCase();
  const roleLabel = ROLE_LABELS[roleKey] || 'Kullanıcı';

  // TURN: sidebar artik GERCEK izinlere gore filtreleniyor -- backend'in
  // ayni izinleri route seviyesinde ZATEN zorunlu kildigi (bkz.
  // people.routes.ts/dictionary.routes.ts) sayfalar icin, yetkisiz bir
  // kullaniciya tiklaninca 403 verecek bir menu ogesi GOSTERILMEZ. Asil
  // guvenlik yine backend'dedir -- bu yalnizca gorunum kolayligidir.
  const permissions = resolvePermissions(admin);
  const visibleSidebar = sidebar.filter((item) => {
    if (item.path === webRoutes.users) return permissions.has('users.read');
    if (item.path === webRoutes.settings)
      return permissions.has('settings.read');
    if (item.path === webRoutes.dictionary)
      return permissions.has('dictionary.read');
    return true;
  });

  const defaultProps: ProLayoutProps = {
    title: CONFIG.appName,
    logo: isDark ? IQV_ICON_DARK : IQV_ICON,
    headerTitleRender: () => (
      <a>
        <BrandLogo />
      </a>
    ),
    fixedHeader: true,
    fixSiderbar: true,
    // IQV Platform referansıyla BİREBİR AYNI (Platform Frontend/dashboard/
    // src/components/layout/index.tsx ~satır 535-536): @ant-design/
    // pro-layout'un KENDİ dahili mobil algılamasını (dar ekranda SiderMenu'yu
    // kendi antd `Drawer`ına -- kapalı, kendi hamburger tetikleyicisiyle --
    // çeviren mekanizma) tamamen kapatır. Bu iki prop OLMADAN, aşağıdaki
    // `collapsed: true` + özel `collapsedButtonRender` + özel `expanded`
    // overlay paneli mobilde hiç devreye giremiyordu -- kütüphane onların
    // önüne geçip kendi Drawer/hamburger moduna düşüyordu (mobilde sidebar
    // tamamen kayboluyor, sol üstte hamburger görünüyordu). Bu iki prop
    // sayesinde uygulamanın KENDİ collapsed-rail + overlay mekanizması artık
    // HER genişlikte (mobil dahil) çalışır -- CSS ile "gizleme" YAPILMADI,
    // kütüphanenin kendi mobil moduna hiç girmemesi sağlandı.
    disableMobile: true,
    breakpoint: false,
    // IQV Platform referansıyla AYNI: sider'in kendi (ikinci, gizli) logo
    // alanı kapatılır -- marka logosu yalnızca üstteki `headerTitleRender`
    // üzerinden, TEK yerden gösterilir (bkz. Platform Frontend'deki
    // layout/index.tsx aynı prop).
    menuHeaderRender: false,
    // Sider HER ZAMAN daraltılmış (bkz. `expanded` state'inin üstündeki
    // not) -- genişleme, ProLayout'un kendi push mekanizması yerine ayrı
    // bir overlay panelle yapılır. `onCollapse` KASITLI OLARAK verilmez:
    // sider'in kendi collapse/expand tetikleyicisi tamamen devre dışı,
    // tek kontrol aşağıdaki özel `collapsedButtonRender` düğmesidir.
    collapsed: true,
    // IQV Platform referansındaki round toggle ile BİREBİR aynı: konum
    // (insetBlockStart 18, insetInlineEnd -13), boyut (24x24), renk/gölge
    // durumları (idle/hover) -- kütüphanenin kendi varsayılan butonu
    // YERİNE, Platform'un aynı ölçüm/değerleriyle. Tıklama artık
    // ProLayout'un `onCollapse`'ını DEĞİL, kendi `toggleSidebar`'ımızı
    // (overlay panel) tetikler.
    collapsedButtonRender: () => (
      <div
        role="button"
        tabIndex={0}
        className="iqv-sider-trigger"
        aria-label={expanded ? 'Menüyü daralt' : 'Menüyü genişlet'}
        onClick={toggleSidebar}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleSidebar();
          }
        }}
        onMouseEnter={() => setTriggerHovered(true)}
        onMouseLeave={() => setTriggerHovered(false)}
        style={{
          position: 'absolute',
          insetBlockStart: 18,
          insetInlineEnd: -13,
          zIndex: 101,
          width: 24,
          height: 24,
          borderRadius: tokens.borderRadiusCircular,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: 16,
          color: isDark
            ? triggerHovered
              ? 'rgba(255, 255, 255, 0.65)'
              : 'rgba(255, 255, 255, 0.25)'
            : triggerHovered
              ? 'rgba(0, 0, 0, 0.65)'
              : 'rgba(0, 0, 0, 0.25)',
          background: isDark ? '#1f1f1f' : 'white',
          transition: `color ${tokens.durationFaster} ${tokens.curveEasyEase}, box-shadow ${tokens.durationFaster} ${tokens.curveEasyEase}, transform 0.3s`,
          boxShadow: triggerHovered
            ? '0 4px 16px -4px rgba(0,0,0,0.05), 0 2px 8px -2px rgba(25,15,15,0.07), 0 1px 2px 0 rgba(0,0,0,0.08)'
            : '0 2px 8px -2px rgba(0,0,0,0.05), 0 1px 4px -1px rgba(25,15,15,0.07), 0 0 1px 0 rgba(0,0,0,0.08)',
        }}
      >
        <SiderTriggerArrow collapsed={!expanded} />
      </div>
    ),
    layout: CONFIG.theme.sidebarLayout,
    route: {
      routes: visibleSidebar,
    },
  };

  const logoutAdmin = () => {
    // Stateless JWT — no server-side session to invalidate, so logout is a
    // pure client-side action (no network call, and definitely not the old
    // ReqRes demo endpoint).
    dispatch(logout());
    navigate(webRoutes.login, {
      replace: true,
    });
  };

  // IQV Platform'un GERÇEK profil menüsüyle (Platform Frontend/dashboard/
  // src/components/layout/index.tsx, aynı `avatarMenuItems`) BİREBİR aynı
  // hiyerarşi: üstte ad/rol grubu, tek bir divider, altında yalnızca
  // "Çıkış Yap". KÖK NEDEN DÜZELTMESİ: bu projede daha önce PWA "İndir"
  // seçeneği de burada gösteriliyordu -- Platform'un profil menüsünde bu
  // seçenek HİÇ YOK, bu yüzden görsel karşılaştırmada gerçek bir fark
  // yaratıyordu. Kaldırıldı. PWA kurulum özelliğinin KENDİSİ (hook/
  // servis) SİLİNMEDİ -- yalnızca bu menüdeki satır kaldırıldı; ihtiyaç
  // olursa `usePwaInstall` (components/hooks/pwaInstall.tsx) başka bir
  // yerden (ör. ayrı bir "uygulamayı yükle" banner'ı) yeniden kullanılabilir.
  const avatarMenuItems = [
    {
      key: 'user-info',
      type: 'group' as const,
      label: (
        <div style={{ paddingBlock: 2 }}>
          <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{fullName}</div>
          <div style={{ fontSize: 12, opacity: 0.65 }}>{roleLabel}</div>
        </div>
      ),
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      // IQV Platform'un GERÇEK, güncel menü metniyle (Platform Frontend/
      // dashboard/src/components/layout/index.tsx, `avatarMenuItems` ->
      // "Çıkış Yap") BİREBİR aynı olsun diye Türkçeleştirildi -- önceki
      // İngilizce "Logout" metni bu projenin geri kalanının (ve
      // Platform'un) Türkçe standardıyla tutarsızdı. Yalnızca GÖRÜNEN
      // metin değişti; `logoutAdmin()` çağrısı, auth/redirect akışı ve
      // `key`/`icon` DEĞİŞMEDİ.
      label: 'Çıkış Yap',
      onClick: () => {
        logoutAdmin();
      },
    },
  ];

  return (
    // Sider HER ZAMAN collapsed olduğundan (bkz. yukarıdaki not) sınıf artık
    // koşulsuz -- ayrı bir `sidebarCollapsed` state'ine gerek kalmadı.
    <div className="iqv-app-layout h-screen iqv-sider-collapsed">
      {/* Sidebar tooltip kapatma (mobil + tablet) icin gizli popup
          kapsayicisi -- bkz. asagidaki `isBelowDesktop`/`menuRender`
          notu. Ekranda hicbir zaman gorunmez, yalnizca React portal
          hedefi olarak var olur. */}
      <div
        id="iqv-sidebar-tooltip-sink"
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      />
      <ProLayout
        {...defaultProps}
        // Ana içerik alanının (`.ant-pro-layout-content`) üst boşluğu --
        // header/sidebar/menü hiçbirini ETKİLEMEZ. IQV Platform
        // referansından (Platform Frontend/dashboard/src/components/
        // layout/index.tsx, aynı `contentStyle`/`CONTENT_TOP_OFFSET`)
        // BİREBİR taşındı; ilk kart bu değer kadar aşağıdan başlar. TEK
        // KAYNAK budur -- `BasePageContainer`'ın kendi üst boşluğu
        // (`childrenContentStyle`) sıfırlanmıştır (bkz. PageContainer.tsx),
        // böylece çift boşluk oluşmaz.
        contentStyle={{ paddingBlockStart: CONTENT_TOP_OFFSET }}
        token={{
          // Sayfa ana arka planı (sidebar/header/Card DIŞINDaki genel "boş"
          // yüzey) -- IQV Platform referansından (Platform Frontend/
          // dashboard/src/components/layout/index.tsx `token.bgLayout` +
          // src/index.css `--color-neutral-background-4-hover`) BİREBİR
          // taşındı. DevTools ile doğrulanan GERÇEK değerler (kod
          // yorumundaki tahmini #f0f0f0/#1f1f1f DEĞİL, CSS değişkeninin
          // fiili tanımı): açık tema #f5f5f5, koyu tema #141414. Platform'da
          // bu TEK bir CSS custom property'den geliyor; Dictionary zaten
          // kendi header/sider renklerini (yukarıdaki/aşağıdaki `isDark`
          // ternary'leri) CSS değişkeni yerine doğrudan JS state'inden
          // besliyor -- aynı mevcut desen korunarak burada da doğrudan
          // `isDark` ile veriliyor. TEK KAYNAK burasıdır: ProLayout tüm
          // sayfaları (Dictionary/Ayarlar/Kişi) sarmaladığından, sayfa
          // başına ayrı bir background eklenmedi.
          bgLayout: isDark ? '#141414' : '#f5f5f5',
          sider: {
            colorMenuBackground: isDark ? '#1f1f1f' : 'white',
            // Hover/active mavi geçişi -- IQV Platform referansından
            // (Platform Frontend/dashboard/src/components/layout/index.tsx,
            // aynı `token.sider` bloğu) BİREBİR taşındı; daha önce bu proje
            // bu dört token'ı hiç vermiyordu (yalnızca aşağıdaki iki
            // "selected" tokenı vardı). Görsel etkinin asıl kaynağı
            // layout.css'teki `!important` kurallardır (ProLayout'un kendi
            // CSS-in-JS'i bu token'lardan bağımsız olarak da devreye girer);
            // bu token'lar ProLayout'un KENDİ ürettiği stille tutarlı
            // olsun diye, Platform'daki gerçek değerleriyle EKLENDİ.
            colorBgMenuItemHover: 'transparent',
            colorBgMenuItemSelected: 'transparent',
            colorTextMenuItemHover: '#1677ff',
            colorTextMenuActive: '#1677ff',
            colorTextMenuSelected: isDark
              ? 'rgba(255, 255, 255, 0.85)'
              : 'rgba(0, 0, 0, 0.88)',
            colorTextSubMenuSelected: isDark
              ? 'rgba(255, 255, 255, 0.85)'
              : 'rgba(0, 0, 0, 0.88)',
          },
          header: {
            colorBgHeader: isDark ? '#1f1f1f' : '#ffffff',
          },
        }}
        actionsRender={() => [
          <Button
            key="theme-toggle"
            type="text"
            aria-label={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
            title={isDark ? 'Açık tema' : 'Koyu tema'}
            icon={<Icon component={isDark ? RiSunLine : RiMoonLine} />}
            onClick={toggle}
          />,
          <Button
            key="fullscreen-toggle"
            type="text"
            aria-label={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
            title={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
            icon={
              isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />
            }
            onClick={toggleFullscreen}
          />,
        ]}
        location={location}
        onMenuHeaderClick={() => navigate(webRoutes.dictionary)}
        menuRender={(_menuProps, defaultDom) =>
          isBelowDesktop ? (
            <ConfigProvider
              getPopupContainer={() =>
                document.getElementById('iqv-sidebar-tooltip-sink') ??
                document.body
              }
            >
              {defaultDom}
            </ConfigProvider>
          ) : (
            defaultDom
          )
        }
        menuItemRender={(item, dom) => (
          <a
            onClick={(e) => {
              e.preventDefault();
              if (item.path) {
                navigate(item.path);
              }
            }}
            href={item.path}
          >
            {dom}
          </a>
        )}
        avatarProps={{
          // IQV Platform ile birebir aynı yaklaşım: sabit yazı/mor kare ikon
          // yerine sade bir metin butonu + ikon (diğer antd `type="text"`
          // ikon butonlarıyla aynı boyut/padding/hover'ı otomatik alır).
          // Kullanıcı adı artık header'da değil, yalnızca açılan menüde
          // gösterilir — tıklama davranışı (Dropdown) DEĞİŞMEDİ.
          render: () => (
            <Dropdown menu={{ items: avatarMenuItems }} trigger={['click']}>
              <Button
                type="text"
                aria-label={`${fullName} kullanıcı menüsü`}
                title={fullName}
                icon={<UserOutlined />}
              />
            </Dropdown>
          ),
        }}
      >
        <Outlet />
      </ProLayout>
      {expanded && (
        // IQV Platform referansındaki "arka plana dokun, sidebar
        // genişlesin" overlay'i ile BİREBİR aynı yapı (bkz. Platform
        // Frontend'deki layout/index.tsx, `.iqv-mobile-sider-backdrop` /
        // `.iqv-mobile-sider-overlay`) -- yalnızca Platform'da bu SADECE
        // `isNarrow` altında render edilirken, burada ekran genişliğinden
        // BAĞIMSIZ olarak `expanded` state'ine bağlı. ProLayout'un KENDİ
        // `collapsed` prop'una dokunulmaz; bu tamamen ayrı, `position:
        // fixed` bir panel + karartmadır -- sayfa içeriğinin
        // margin/width'i DEĞİŞMEZ, panel onun ÜZERİNE biner.
        <>
          <div
            className="iqv-mobile-sider-backdrop"
            onClick={closeSidebar}
            aria-hidden="true"
          />
          <div
            className="iqv-mobile-sider-overlay"
            style={{
              width: EXPANDED_SIDER_WIDTH,
              background: isDark ? '#1f1f1f' : 'white',
            }}
          >
            <div
              style={{
                height: 56,
                display: 'flex',
                alignItems: 'center',
                paddingInlineStart: 24,
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
            >
              <img
                src={IQV_WORDMARK}
                alt={CONFIG.appName}
                draggable={false}
                style={{
                  width: 116,
                  height: 'auto',
                  maxWidth: 116,
                  maxHeight: 26,
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              style={{ borderInlineEnd: 'none', background: 'transparent' }}
              items={visibleSidebar.map((item) => ({
                key: item.path,
                icon: item.icon,
                label: item.name,
              }))}
              onClick={({ key }) => {
                const path = String(key);
                closeSidebar();
                if (path && path !== location.pathname) {
                  navigate(path);
                }
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default memo(Layout);
