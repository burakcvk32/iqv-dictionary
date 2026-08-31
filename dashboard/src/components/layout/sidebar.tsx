import { webRoutes } from '../../routes/web';
import { BookOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';

// Dashboard/Users/About routes and components are intentionally kept (not
// deleted) — only removed from this navigation list per this round's scope.
//
// `disabledTooltip: true`: ProLayout'un KENDİ, kütüphane-içi hover/tıklama
// tetiklemeli tooltip'ini (bkz. @ant-design/pro-layout BaseMenu.js
// `MenuItemTooltip` — sidebar collapsed hâldeyken item üzerine gelince veya
// dokununca otomatik gösterdiği isim balonu) devre dışı bırakır. IQV
// Platform'un kendi sidebar.tsx'inde de aynı sebeple, aynı şekilde
// kullanılıyor. İkon/route/active-state/collapse davranışını etkilemez —
// yalnızca bu görsel tooltip katmanını kapatır. Erişilebilirlik için isim,
// menü öğesinin kendi metni/aria-label'ı olarak (ekranda balon şeklinde
// GÖRÜNMEDEN) korunur.
export const sidebar = [
  {
    path: webRoutes.dictionary,
    key: webRoutes.dictionary,
    name: 'Dictionary',
    icon: <BookOutlined />,
    disabledTooltip: true,
  },
  {
    path: webRoutes.settings,
    key: webRoutes.settings,
    name: 'Ayarlar',
    icon: <SettingOutlined />,
    disabledTooltip: true,
  },
  {
    // Reuses the existing Users page/route — label only renamed to "Kişi".
    path: webRoutes.users,
    key: webRoutes.users,
    name: 'Kişi',
    icon: <UserOutlined />,
    disabledTooltip: true,
  },
];
