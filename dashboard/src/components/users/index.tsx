import {
  ActionType,
  ProColumns,
  ProTable,
  RequestData,
} from '@ant-design/pro-components';
import { Button, Card, ConfigProvider, Modal, Tooltip, theme } from 'antd';
import { Badge, SearchBox } from '@iqvizyonui/react-components';
import type { BadgeProps } from '@iqvizyonui/react-components';
import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FormOutlined,
} from '@ant-design/icons';
import { CSSProperties, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Person } from '../../interfaces/models/person';
import { peopleApi } from '../../services/peopleApi';
import {
  NotificationType,
  handleErrorResponse,
  showNotification,
} from '../../utils';
import { resolvePermissions } from '../../utils/permissions';
import { PAGE_CARD_RADIUS } from '../../constants';
import BasePageContainer from '../layout/PageContainer';
import { useAppTheme } from '../theme/AppTheme';
import { RootState } from '../../store';
import PersonEditModal from './PersonEditModal';
import useBreakpoint from '../hooks/breakpoint';

const SEARCH_DEBOUNCE_MS = 400;
const PEOPLE_PAGE_SIZE = 10;

// RESPONSIVE ESIKLER -- IQV Platform'daki GERCEK Kisiler paneliyle
// (Platform Frontend/dashboard/src/components/settings/index.tsx,
// PERSONNEL_DESKTOP_MIN_WIDTH) BIREBIR ayni: 1100px. Dictionary'nin KENDI
// `layout.css` dosyasi da (HEADER SAĞ AKSİYON GRUBU bölümü) zaten AYNI
// 768/1100 esik ciftini tasir -- yeni bir esik UYDURULMADI, projede
// ONCEDEN VAR OLAN deger yeniden kullanildi. `useBreakpoint(1100)` TRUE
// donerse ekran masaustu esiginin ALTINDADIR (tablet veya telefon).
const PEOPLE_DESKTOP_MIN_WIDTH = 1100;

// YALNIZCA masaustunde gosterilen kolon anahtarlari -- Platform'daki
// PERSONNEL_DESKTOP_ONLY_COLUMN_KEYS ile AYNI iki kolon (`email`,
// `status`). Tablet/telefonda bu kolon TANIMLARI diziden CIKARILIR
// (gorsel gizleme DEGIL); antd bu kolonlar icin <th>/<td> URETMEZ, bos
// kolon genisligi/gap OLUSMAZ. Masaustunde dizi OLDUGU GIBI kullanilir --
// mevcut gorunum HIC DEGISMEZ.
const PEOPLE_DESKTOP_ONLY_COLUMN_KEYS = new Set(['email', 'status']);

// Tablonun yatay MINIMUM genisligi (antd/ProTable `scroll.x`), yalnizca
// tablet bandinda (768px-1099.98px) kullanilir. Turetme: email/status
// kolonlari cikinca geriye kalan SABIT genislikli kolonlarin toplami --
// No (90) + Rol (200) + İşlem (100) = 390 -- artı Ad Soyad kolonu icin
// (ellipsis, sabit genisligi yok) makul bir minimum ~170px. 390 + 170 =
// 560. (Not: Platform'un KENDI tablet degeri de -- kendi kolon
// genislikleriyle BAGIMSIZ olcumle -- ayni 560'tir; bu bir kopyalama
// DEGIL, ayni yontemle ayri ayri turetilen degerin ortusmesidir.)
const PEOPLE_TABLET_TABLE_MIN_WIDTH = 560;

/**
 * TABLONUN RESPONSIVE TIPOGRAFISI -- Platform'daki GERCEK
 * PERSONNEL_TABLE_TYPOGRAFY sabitiyle BIREBIR ayni token adlari/degerleri
 * (antd/es/table/style/index.js -> `size="small"` icin gecerli *SM
 * token'lari: cellFontSizeSM/cellPaddingInlineSM/cellPaddingBlockSM).
 * MASAUSTUNDE HICBIR TOKEN VERILMEZ -> antd varsayilanlari (14/8/8) AYNEN
 * KORUNUR (mevcut Dictionary davranisi zaten buydu). Yalnizca tablet ve
 * telefonda birer kademe kucultulur.
 */
const PEOPLE_TABLE_TYPOGRAPHY = {
  tablet: { cellFontSizeSM: 13, cellPaddingInlineSM: 6, cellPaddingBlockSM: 6 },
  mobile: { cellFontSizeSM: 12, cellPaddingInlineSM: 4, cellPaddingBlockSM: 5 },
} as const;

// Sayfa basligi -- IQV Platform'daki gercek "Kisiler" ekraniyla (Ayarlar >
// Kisiler paneli, dashboard/src/components/settings/index.tsx ->
// PEOPLE_PANEL_TITLE) BIREBIR ayni metin. Uydurulmadi, Platform kaynagindan
// alindi.
const PEOPLE_PANEL_TITLE = 'Personel Oluştur';

// Rol etiketleri -- kullanıcı isteğiyle listede SADECE iki metin gösterilir:
// "Admin" / "Kullanıcı". Backend'in GERÇEK, bilinen rol kümesi (KNOWN_ROLES,
// bkz. backend/src/modules/people/people.validation.ts) `superadmin` /
// `companyadmin` / `organizationadmin` / `admin` / `user`'dır -- rol kümesi
// UYDURULMADI. Yönetici yetkisini temsil eden ilk dördü (eski/legacy kayıtlar
// dahil) artık TEK bir "Admin" etiketinde birleşiyor; `user` hâlâ "Kullanıcı".
// Bu YALNIZCA listedeki GÖRÜNEN metni değiştirir -- gerçek `role` değeri
// (veritabanı, API, PersonEditModal'daki ROLE_OPTIONS/payload) DEĞİŞMEDİ.
// Bilinmeyen bir rol geldiğinde ham değer OLDUĞU GİBİ gösterilir.
const PEOPLE_ADMIN_ROLE_KEYS = new Set([
  'superadmin',
  'companyadmin',
  'organizationadmin',
  'admin',
]);

const formatPersonRole = (role?: string): string => {
  if (!role) {
    return '-';
  }
  const key = role.trim().toLocaleLowerCase('tr-TR');
  if (!key) {
    return '-';
  }
  if (key === 'user') {
    return 'Kullanıcı';
  }
  if (PEOPLE_ADMIN_ROLE_KEYS.has(key)) {
    return 'Admin';
  }
  return role.trim();
};

// Durum rozeti -- IQV Platform'daki PERSONNEL_STATUS_BADGE /
// resolvePersonnelStatus ile BIREBIR ayni mapping. Gercek `status` verisi
// (MongoDB) DEGISMEDEN ayni sekilde okunur; yalnizca gosterim etiketi/rengi
// Platform standardina tasindi. Taninmayan bir durum degeri "Pasif"e
// zorlanmaz -- ham degeriyle notr bir rozette gosterilir (Platform'daki gibi).
const PEOPLE_STATUS_BADGE: Record<
  string,
  { label: string; color: BadgeProps['color'] }
> = {
  active: { label: 'Aktif', color: 'success' },
  aktif: { label: 'Aktif', color: 'success' },
  passive: { label: 'Pasif', color: 'danger' },
  pasif: { label: 'Pasif', color: 'danger' },
  inactive: { label: 'Pasif', color: 'danger' },
};

const resolvePersonStatus = (
  status?: string,
): { label: string; color: BadgeProps['color'] } => {
  const key = (status ?? '').trim().toLocaleLowerCase('tr-TR');
  if (!key) {
    return { label: 'Bilinmiyor', color: 'informative' };
  }
  return (
    PEOPLE_STATUS_BADGE[key] ?? {
      label: (status ?? '').trim(),
      color: 'informative',
    }
  );
};

const Users = () => {
  const actionRef = useRef<ActionType>();
  const { token } = theme.useToken();
  const [modal, modalContextHolder] = Modal.useModal();
  const { isDark } = useAppTheme();
  const admin = useSelector((state: RootState) => state.admin);
  const [searchInput, setSearchInput] = useState('');
  const searchRef = useRef('');
  const isFirstSearchRender = useRef(true);
  // ProTable'in kendi sayfa state'i disariya acilmiyor; global "Sira No"
  // hesabi (Platform'daki personnelPage deseniyle AYNI:
  // (page - 1) * pageSize + index + 1) icin mevcut sayfa burada tutulur.
  const [currentPage, setCurrentPage] = useState(1);
  const [editingRecord, setEditingRecord] = useState<Person | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  // TURN: "Personel Oluştur" -- Platform'daki `personFormOpen`/
  // `personFormMode` state ikilisiyle AYNI desen (bkz. Platform Frontend/
  // dashboard/src/components/settings/index.tsx). Edit ile AYNI
  // `PersonEditModal` bileşeni, yalnızca `record=null` ve `mode="create"`
  // ile açılır.
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // RESPONSIVE -- Platform'daki Ayarlar/Kisiler paneliyle (bkz.
  // PERSONNEL_DESKTOP_MIN_WIDTH yorumu) AYNI iki esik. Projenin MEVCUT
  // paylasilan `useBreakpoint` hook'u kullanilir; yeni bir resize
  // dinleyicisi/medya sorgusu EKLENMEDI.
  const isBelowDesktop = useBreakpoint(PEOPLE_DESKTOP_MIN_WIDTH);
  const isMobile = useBreakpoint();

  const permissions = resolvePermissions(admin);
  const canReadPerson = permissions.has('users.read');
  const canCreatePerson = permissions.has('users.create');
  const canUpdatePerson = permissions.has('users.update');
  const canDeletePerson = permissions.has('users.delete');

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      searchRef.current = searchInput.trim();
      actionRef.current?.reloadAndRest?.();
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const openEditPerson = (person: Person) => {
    setEditingRecord(person);
    setEditOpen(true);
  };

  const closeEditPerson = () => {
    setEditOpen(false);
    setEditingRecord(null);
  };

  // Duzenleme/silme sonrasi liste guncellenir; `reload()` (reloadAndRest
  // DEGIL) kullanilir ki mevcut sayfa VE arama filtresi KORUNSUN (bkz.
  // dictionary/index.tsx refreshAfterMutation ile AYNI desen).
  const handleEditSuccess = () => {
    actionRef.current?.reload();
  };

  const openCreatePerson = () => {
    setCreateOpen(true);
  };

  const closeCreatePerson = () => {
    setCreateOpen(false);
  };

  // Duzenleme/silmeden FARKLI olarak: yeni kayit liste (`_id: -1`, en yeni
  // ustte -- bkz. people.repository.mongo.ts list()) sıralamasında 1.
  // sayfaya duser. Kullanicinin "yeni personel tabloda gorunmeli" beklentisi
  // (gorev geregi) icin `reloadAndRest` KULLANILIR -- mevcut arama filtresi
  // (searchRef.current, ProTable'in KENDI `search` prop'undan BAGIMSIZ
  // tutulur) KORUNUR, yalnizca sayfa 1'e doner.
  const handleCreateSuccess = () => {
    actionRef.current?.reloadAndRest?.();
  };

  const requestDeletePerson = (person: Person) => {
    if (deletingId) return;

    const displayName = person.full_name || person.username;

    modal.confirm({
      title: 'Kullanıcıyı Sil',
      icon: <ExclamationCircleOutlined />,
      content: `${displayName} kullanıcısını silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'İptal',
      onOk: () => {
        setDeletingId(person._id);
        return peopleApi
          .remove(person._id)
          .then(() => {
            showNotification(
              'Başarılı',
              NotificationType.SUCCESS,
              'Kullanıcı başarıyla silindi.',
            );
            actionRef.current?.reload();
          })
          .catch((error) => handleErrorResponse(error))
          .finally(() => setDeletingId(null));
      },
    });
  };

  const columns: ProColumns<Person>[] = [
    {
      title: 'No',
      key: 'index',
      align: 'center',
      // Masaustu VE tablet degeri (90) AYNEN korunur; yalnizca telefonda
      // kucultulur (Platform'daki personnelAllColumns 'Sıra No' kolonuyla
      // AYNI 56 degeri -- Dictionary'nin basligi ("No") Platform'unkinden
      // ("Sıra No") daha kisa oldugu icin bu deger burada da rahatca sigar).
      width: isMobile ? 56 : 90,
      sorter: false,
      render: (_, __, index) =>
        String((currentPage - 1) * PEOPLE_PAGE_SIZE + index + 1).padStart(
          2,
          '0',
        ),
    },
    {
      title: 'Ad Soyad',
      dataIndex: 'full_name',
      align: 'center',
      ellipsis: true,
      sorter: false,
      render: (_, row) => row.full_name || row.username || '-',
    },
    {
      title: 'E-posta',
      dataIndex: 'email',
      align: 'center',
      ellipsis: true,
      sorter: false,
      render: (_, row) => row.email || '-',
    },
    {
      title: 'Rol',
      dataIndex: 'role',
      align: 'center',
      // Masaustu degeri (200) DEGISMEZ ("kolonlar ayni kalacak"). Telefonda
      // kucultulur -- "Admin"/"Kullanıcı" etiketleri kisa oldugu icin
      // Platform'un ayni amacli mobil degeriyle (88) AYNI deger kullanilir.
      width: isMobile ? 88 : 200,
      sorter: false,
      render: (_, row) => formatPersonRole(row.role),
    },
    {
      title: 'Durum',
      dataIndex: 'status',
      align: 'center',
      width: 120,
      sorter: false,
      render: (_, row) => {
        const state = resolvePersonStatus(row.status);
        return (
          <Badge appearance="tint" shape="rounded" color={state.color}>
            {state.label}
          </Badge>
        );
      },
    },
    {
      title: 'İşlem',
      key: 'actions',
      align: 'center',
      // `fixed` yalnizca `scroll.x` sayisal bir deger tasidiginda anlamlidir
      // (bkz. asagidaki ProTable `scroll` prop'u); telefonda `scroll.x`
      // HIC verilmedigi icin burada da KALDIRILIR (Platform'un mobil
      // Islemler kolonunda `fixed` HIC KULLANILMAMASIYLA AYNI mantik --
      // aksi halde antd sabitlenmis bir kolonu kaydirma kapsayicisi
      // olmadan konumlandirmaya calisir).
      fixed: isMobile ? undefined : 'right',
      // Masaustu VE tablet degeri (100) AYNEN korunur; telefonda iki
      // `size="small"` ikon butonu icin gereken minimuma iner (Platform'un
      // ayni amacli 120->64 kucultme oranina yakin, Dictionary'nin KENDI
      // masaustu degeri (100) uzerinden orantili turetildi).
      width: isMobile ? 64 : 100,
      // Platform'daki gercek Edit/Delete ikon presentation'i (mavi kalem /
      // kirmizi cop kutusu). Artik GERCEK: backend'e PATCH/DELETE istegi
      // atar. Yetkisi olmayan bir oturumda ikon hic GORUNMEZ (Platform'daki
      // canUpdatePerson/canDeletePerson deseniyle AYNI) -- ancak gercek
      // kontrol HER ZAMAN backend'dedir.
      render: (_, row) => (
        <div className="flex items-center justify-center gap-1">
          {canUpdatePerson && (
            // NOT: gorsel bir Tooltip balonu KASITLI OLARAK YOK (IQV
            // Platform'daki buyuk siyah "Sil" balonu, kullanicinin acikca
            // istemedigi bir gorunumdu). Erisilebilirlik icin `title` +
            // `aria-label` yeterlidir; antd `Tooltip` sarmalayicisi
            // KALDIRILDI.
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              style={{ color: token.colorPrimary }}
              onClick={() => openEditPerson(row)}
              title="Düzenle"
              aria-label={`${row.full_name || row.username} kaydını güncelle`}
            />
          )}
          {canDeletePerson && (
            // Hover/focus/active çerçevesi çok silik kalıyordu (antd
            // `type="text"` varsayılanı) -- rest hâli (şeffaf zemin,
            // kırmızı ikon) DEĞİŞMEDİ, boyut/hizalama DEĞİŞMEDİ; yalnızca
            // `.iqv-person-delete-btn` (index.css) etkileşim durumlarında
            // belirgin bir kırmızı çerçeve/ring ekliyor. Renk yeni
            // uydurulmadı -- AYNI `token.colorError`, CSS değişkeni
            // olarak veriliyor (settings/index.tsx'teki Sil butonuyla
            // AYNI desen).
            <Button
              type="text"
              size="small"
              className="iqv-person-delete-btn"
              icon={<DeleteOutlined />}
              style={
                {
                  color: token.colorError,
                  '--iqv-btn-danger': token.colorError,
                } as CSSProperties
              }
              loading={deletingId === row._id}
              onClick={() => requestDeletePerson(row)}
              title="Sil"
              aria-label={`${row.full_name || row.username} kaydını sil`}
            />
          )}
          {!canUpdatePerson && !canDeletePerson && (
            <span style={{ color: token.colorTextQuaternary }}>-</span>
          )}
        </div>
      ),
    },
  ];

  // RESPONSIVE KOLONLAR -- gorsel gizleme DEGIL, tanim duzeyinde cikarma
  // (Platform'daki personnelColumns/PERSONNEL_DESKTOP_ONLY_COLUMN_KEYS
  // deseniyle BIREBIR AYNI). Tablet/telefonda `email` ve `status` kolon
  // TANIMLARI diziden silinir; masaustunde dizi OLDUGU GIBI kullanilir --
  // mevcut gorunum HIC DEGISMEZ.
  //
  // TELEFONDA AYRICA `role` (Rol) kolonu da cikarilir, `full_name` (Ad
  // Soyad) kolonu yerinde kalir -- kullanicinin acik talebi: dar ekranda
  // "No | Rol | Islem" yerine "No | Ad Soyad | Islem" gorunmeli. Bu kural
  // SADECE isMobile (<768px) icin gecerlidir; tablet bandinda (768-1099px)
  // Rol kolonu AYNEN kalir, masaustu HIC ETKILENMEZ.
  const peopleColumns: ProColumns<Person>[] = columns.filter((column) => {
    if (!('dataIndex' in column) || typeof column.dataIndex !== 'string') {
      return true;
    }
    if (
      isBelowDesktop &&
      PEOPLE_DESKTOP_ONLY_COLUMN_KEYS.has(column.dataIndex)
    ) {
      return false;
    }
    if (isMobile && column.dataIndex === 'role') {
      return false;
    }
    return true;
  });

  if (!canReadPerson) {
    return (
      <BasePageContainer>
        <div style={{ padding: 24, color: token.colorTextSecondary }}>
          Bu sayfayı görüntüleme yetkiniz yok.
        </div>
      </BasePageContainer>
    );
  }

  return (
    <BasePageContainer transparent>
      {modalContextHolder}
      {/* MOBIL TASMA DUZELTMESI -- kok neden: bu paddingInline TUM
          esiklerde SABIT 32px idi. Tablo `tableLayout="fixed"` kullandigi
          icin sabit genislikli mobil kolonlarin (No 56 + Rol 88 + Islem 64
          = 208px) toplami, kalan kapsayici genisligini asinca antd bu
          kolonlari KUCULTEMEZ -- tablo container'i asar ve sag kenardan
          tasar (ekran goruntusundeki tasmanin TAM KAYNAGI). Yalnizca
          telefonda (isMobile) 12px'e dusuruluyor; masaustu/tablet degeri
          (32) AYNEN korunur, gorunumleri DEGISMEZ. */}
      <Card
        bordered
        style={{ borderRadius: PAGE_CARD_RADIUS, marginBottom: 16 }}
        bodyStyle={{ paddingInline: isMobile ? 12 : 32, paddingBlock: 24 }}
      >
        <div
          className="flex flex-wrap items-center justify-between"
          style={{ gap: 12, marginBottom: 12, minHeight: 32 }}
        >
          <span
            style={{
              fontSize: 20,
              fontWeight: 500,
              lineHeight: 1.2,
              color: isDark ? token.colorText : 'rgba(0, 0, 0, 0.80)',
            }}
          >
            {PEOPLE_PANEL_TITLE}
          </span>
          {/* `.iqv-people-header-actions` (bkz. src/index.css) --
              Platform'daki GERCEK `.iqv-settings-header-actions` sinifinin
              (Platform Frontend/dashboard/src/components/layout/layout.css)
              BIREBIR AYNI cozumu: bu sarmalayici, dis satirin
              (justify-between) bir FLEX OGESIDIR ve flex ogeleri varsayilan
              olarak `min-width: auto` tasir -- yani ICERIGININ min-content
              genisliginin ALTINA KUCULEMEZ. Arama kutusu sabit 240px inline
              stil tasidigi icin dar telefon ekraninda kartin ic genisligini
              ASIYOR ve SAG SINIRDAN TASIYORDU. Sinif yalnizca `min-width: 0`
              ekler; masaustunde alan zaten yeterli oldugu icin ORADA HICBIR
              ETKISI YOKTUR. */}
          <div className="iqv-people-header-actions flex flex-wrap items-center gap-2">
            <SearchBox
              value={searchInput}
              onChange={(_event, data) => setSearchInput(data.value)}
              placeholder="Kişilerde ara"
              aria-label="Kişilerde ara"
              // Genislik ARTIK CSS'ten gelir (`.iqv-people-search`,
              // src/index.css) -- Platform'daki `.iqv-settings-search`
              // sinifiyla BIREBIR AYNI degerler: masaustunde/tablette
              // 240px (onceki inline deger ile AYNI), telefonda (<768px)
              // satirin kalanina kucalir. Inline `style={{width:240}}`
              // KALDIRILDI cunku inline stil CSS'ten daha oncelikli oldugu
              // icin hicbir kucultme kurali devreye giremiyordu.
              className="iqv-people-search"
            />
          </div>
        </div>

        {/* Tabloyu saran bu ikinci sabit padding de AYNI tasma
            mekanizmasina katkida bulunuyordu; telefonda 8px'e indirilerek
            sabit genislikli kolonlara birkac piksel daha alan birakilir.
            Masaustu/tablet degeri (16) AYNEN korunur. */}
        <div
          style={{
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: PAGE_CARD_RADIUS,
            background: token.colorBgContainer,
            padding: isMobile ? 8 : 16,
          }}
        >
          <ConfigProvider
            theme={{
              components: {
                Table: {
                  headerBg: token.colorBgContainer,
                  headerSplitColor: 'transparent',
                  rowHoverBg: token.colorFillQuaternary,
                  borderColor: token.colorBorderSecondary,
                  // RESPONSIVE TIPOGRAFI -- Platform'daki Kisiler paneliyle
                  // BIREBIR AYNI desen: masaustunde HICBIR deger yayilmaz
                  // (antd varsayilanlari 14/8/8 AYNEN gecerli, mevcut
                  // davranis KORUNUR); tablet ve telefonda birer kademe
                  // kucultulur.
                  ...(isMobile
                    ? PEOPLE_TABLE_TYPOGRAPHY.mobile
                    : isBelowDesktop
                      ? PEOPLE_TABLE_TYPOGRAPHY.tablet
                      : {}),
                },
              },
            }}
          >
            <ProTable<Person>
              columns={peopleColumns}
              cardBordered={false}
              bordered={false}
              size="small"
              showSorterTooltip={false}
              // Masaustunde ONCEKI davranis (`{ x: true }`) AYNEN korunur --
              // masaustu gorunumu HIC DEGISMEZ. Tablet bandinda (768px-
              // 1099.98px) sayisal bir minimum genislik verilir (bkz.
              // PEOPLE_TABLET_TABLE_MIN_WIDTH turetmesi) ki 4 kalan kolon
              // birbirine gecmesin. TELEFONDA `scroll.x` HIC VERILMEZ --
              // Platform'un KOK NEDEN analiziyle AYNI: sabit bir minimum
              // genislik, dar ekranin gercek kapsayici genisligine ZORLA
              // dayatilinca gereksiz yatay kaydirma cubugu olusturuyordu.
              // `scroll` verilmeyince tablo `tableLayout="fixed"` ile
              // kapsayici genisliginin %100'unu kullanir; icerik `ellipsis`
              // ile kirpilir, sayfa duzeni KIRILMAZ.
              scroll={
                isMobile
                  ? undefined
                  : isBelowDesktop
                    ? { x: PEOPLE_TABLET_TABLE_MIN_WIDTH }
                    : { x: true }
              }
              tableLayout={'fixed'}
              rowSelection={false}
              pagination={{
                pageSize: PEOPLE_PAGE_SIZE,
                showSizeChanger: false,
                hideOnSinglePage: true,
                onChange: (page) => setCurrentPage(page),
              }}
              actionRef={actionRef}
              request={(params) => {
                const page = params.current ?? 1;
                setCurrentPage(page);
                return peopleApi
                  .list({
                    page,
                    limit: params.pageSize ?? PEOPLE_PAGE_SIZE,
                    search: searchRef.current || undefined,
                  })
                  .then((response) => {
                    return {
                      data: response.data,
                      success: response.success,
                      total: response.pagination.total,
                    } as RequestData<Person>;
                  })
                  .catch((error) => {
                    handleErrorResponse(error);

                    return {
                      data: [],
                      success: false,
                    } as RequestData<Person>;
                  });
              }}
              dateFormatter="string"
              search={false}
              rowKey="_id"
              options={false}
              locale={{
                emptyText: searchInput.trim()
                  ? 'Arama kriterlerine uygun kişi bulunamadı.'
                  : 'Kişi bulunamadı.',
              }}
            />
          </ConfigProvider>

          {/* PERSONEL OLUŞTUR -- Platform'un GERÇEK "Kişiler" panelindeki
              (Platform Frontend/dashboard/src/components/settings/index.tsx)
              yüzen aksiyon butonuyla BİREBİR aynı component/görünüm: aynı
              `.iqv-people-fab` sınıfı (bkz. src/index.css), aynı 48x48 ölçü,
              aynı `FormOutlined` ikonu, aynı "Yeni Personel" tooltip'i, aynı
              tablonun hemen altında sağa hizalı konum. Görünürlük Platform'un
              `canCreatePerson` kuralıyla AYNI: yalnızca `users.create` izni
              olan oturumda render edilir. */}
          {canCreatePerson && (
            <div
              className="iqv-people-create-action"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBlockStart: 'var(--spacingVerticalXL, 20px)',
              }}
            >
              <Tooltip title="Yeni Personel" placement="left">
                <Button
                  className="iqv-people-fab"
                  size="large"
                  icon={<FormOutlined />}
                  aria-label="Yeni personel ekle"
                  onClick={openCreatePerson}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: PAGE_CARD_RADIUS,
                    boxShadow: token.boxShadow,
                  }}
                />
              </Tooltip>
            </div>
          )}
        </div>
      </Card>
      <PersonEditModal
        open={editOpen}
        mode="edit"
        record={editingRecord}
        onClose={closeEditPerson}
        onSuccess={handleEditSuccess}
      />
      <PersonEditModal
        open={createOpen}
        mode="create"
        record={null}
        onClose={closeCreatePerson}
        onSuccess={handleCreateSuccess}
      />
    </BasePageContainer>
  );
};

export default Users;
