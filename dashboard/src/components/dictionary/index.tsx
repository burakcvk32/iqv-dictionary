import {
  ActionType,
  ProColumns,
  ProTable,
  RequestData,
} from '@ant-design/pro-components';
import { Card, Col, Modal, Row, Spin, theme } from 'antd';
import { SearchBox } from '@iqvizyonui/react-components';
import {
  ExclamationCircleOutlined,
  RobotOutlined,
  ToolOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  DICTIONARY_GROUP_IQV_OS_AI,
  DICTIONARY_GROUP_INDUSTRIAL,
  DictionaryItem,
  DictionaryStats,
} from '../../interfaces/models/dictionary';
import { dictionaryApi } from '../../services/dictionaryApi';
import {
  NotificationType,
  handleErrorResponse,
  showNotification,
} from '../../utils';
import { resolvePermissions } from '../../utils/permissions';
import BasePageContainer from '../layout/PageContainer';
import { useAppTheme } from '../theme/AppTheme';
import { PAGE_CARD_RADIUS } from '../../constants';
import DictionaryFormModal from './DictionaryFormModal';
import useBreakpoint from '../hooks/breakpoint';
import { RootState } from '../../store';

type ActiveGroupFilter =
  | typeof DICTIONARY_GROUP_IQV_OS_AI
  | typeof DICTIONARY_GROUP_INDUSTRIAL
  | undefined;

const SEARCH_DEBOUNCE_MS = 400;
const DICTIONARY_PAGE_SIZE = 20;

// Projede paylasilan bir tarih formatlama utility'si yok (bkz. src/utils);
// bu yuzden Platform referansindaki DD.MM.YYYY formati burada, sadece
// GORSEL amacli, sifir bagimlilikla uretiliyor. Backend/API ile hicbir
// iliskisi yok.
const formatDdMmYyyy = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

// Üstteki 3 istatistik kartından biri -- IQV Platform Deneme referansından
// (Platform Deneme/dashboard/src/components/api-docs/index.tsx `SummaryCard`
// + pageFrame.ts sabitleri) BİREBİR taşınan layout/tipografi/ölçü:
//   - icon solda, sabit `clamp(24px, 2vw, 30px)` yuva, ikon<->metin gap'i
//     `tokens.spacingHorizontalXXXL` (32px, DevTools/kaynak kod ile
//     doğrulandı -- kod yorumundaki eski "12px" ifadesi YANLIŞTI, gerçek
//     değer buydu).
//   - başlık üstte (`clamp(13px, 1vw, 14px)`), sayı altta, belirgin şekilde
//     daha büyük ve kalın (`clamp(22px, 1.9vw, 28px)`, fontWeight 600).
//   - kart gövde iç boşluğu: yatay `spacingHorizontalXXXL` (32px), dikey
//     `spacingVerticalXXL` (24px) -- Platform Deneme'nin
//     `API_MIDDLEWARE_KPI_BODY_STYLE`'ı ile birebir aynı.
//
// SEÇİLİ/HOVER GÖRÜNÜMÜ -- Platform Deneme'nin `SummaryCard`'ından BİREBİR
// taşındı (bkz. o dosyadaki "NÖTR PALET: mavi/primary vurgu KULLANILMAZ"
// yorumu): mor/mavi kenarlık YOK, yalnızca nötr `token.colorBorder` kenarlık
// + `token.colorFillQuaternary` açık gri zemin, seçili VE hover'da AYNI.
// Önceki turda kullanılan `CONFIG.theme.accentColor` mor kenarlığı BURADAN
// KALDIRILDI. Dictionary'nin kendi click/filter mantığı (`handleCardSelect`,
// `activeGroup`) DEĞİŞMEDİ -- yalnızca hangi kartın "seçili" olduğunu
// gösteren `active` boolean'ı buraya prop olarak geliyor, görsel karar
// (renk/hover) tamamen bu bileşenin içinde, Platform Deneme ile aynı.
const StatCard = ({
  icon,
  label,
  value,
  loading,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading?: boolean;
  active: boolean;
  onClick?: () => void;
}) => {
  const { token } = theme.useToken();
  const [hovered, setHovered] = useState(false);

  const borderColor = active
    ? token.colorBorder
    : hovered
      ? token.colorBorder
      : undefined;
  const background = active
    ? token.colorFillQuaternary
    : hovered
      ? token.colorFillQuaternary
      : undefined;

  return (
    <Card
      style={{
        cursor: onClick ? 'pointer' : undefined,
        borderRadius: PAGE_CARD_RADIUS,
        height: '100%',
        borderColor,
        background,
        transition: 'border-color .2s, background .2s',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      bodyStyle={{
        paddingInline: 32,
        paddingBlock: 24,
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div className="flex items-center" style={{ gap: 32 }}>
        <span
          aria-hidden
          className="flex items-center justify-center"
          style={{
            width: 'clamp(24px, 2vw, 30px)',
            height: 'clamp(24px, 2vw, 30px)',
            flex: '0 0 auto',
            color: token.colorTextSecondary,
            fontSize: 'clamp(17px, 1.4vw, 21px)',
          }}
        >
          {icon}
        </span>
        <span className="flex flex-col">
          <span
            style={{
              fontSize: 'clamp(13px, 1vw, 14px)',
              lineHeight: 1.4,
              color: token.colorTextSecondary,
            }}
          >
            {label}
          </span>
          <span
            className="tabular-nums"
            style={{
              fontSize: 'clamp(22px, 1.9vw, 28px)',
              lineHeight: 1.25,
              fontWeight: 600,
              color: token.colorText,
            }}
          >
            {loading ? <Spin size="small" /> : value}
          </span>
        </span>
      </div>
    </Card>
  );
};

// ENDÜSTRİYEL alt gruplar -- settings/index.tsx'teki (Ayarlar ekranı)
// `INDUSTRIAL_SUBGROUP_OPTIONS` ile BİREBİR AYNI 8 değer/sıra (kullanıcının
// kendi onayladığı, sistemde GERÇEKTEN var olan tam liste). Ayarlar
// dosyasına dokunmadan bağımsız bir kopya -- bkz. yukarıdaki not.
const INDUSTRIAL_ALT_GRUPLAR = [
  'Temel Makine, Proses ve Sensör Terimi',
  'Üretim',
  'Bakım',
  'Kalite',
  'Veri, Yapay Zekâ ve Analitik',
  'Yazılım, Sistem ve Siber Güvenlik',
  'Endüstriyel Haberleşme ve Otomasyon',
  'Enerji ve Sürdürülebilirlik',
];

// ENDÜSTRİYEL ALT GRUP KARTI -- StatCard'in seçili/hover mantığıyla
// BİREBİR AYNI (yukarıdaki StatCard yorumuna bkz.), yalnızca ikon/sayı
// olmayan, tek satırlık bir etiket kartı için sadeleştirilmiş hali.
const SubgroupOptionCard = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => {
  const { token } = theme.useToken();
  const [hovered, setHovered] = useState(false);

  const borderColor = active || hovered ? token.colorBorder : undefined;
  const background = active || hovered ? token.colorFillQuaternary : undefined;

  return (
    <Card
      size="small"
      // KOK NEDEN DUZELTMESI: kartlarin TAMAMEN AYNI boyutta olmasi
      // (metin uzunlugundan BAGIMSIZ) gerektigi icin dis sarmalayici
      // artik bir CSS Grid (asagida `grid-cols-...` + `gridAutoRows:
      // '1fr'`) -- her kart otomatik olarak AYNI hucre genisligini/
      // yuksekligini alir, ayrica bir flex-basis/grow degeri
      // GEREKMEZ (bir onceki turun `flex-[1_1_160px]` cozumu, metin
      // uzunluguna gore KUCULEBILEN bir min-content tabanina izin
      // veriyordu -- grid hucresi bunu tamamen ORTADAN KALDIRIR).
      style={{
        cursor: 'pointer',
        borderRadius: PAGE_CARD_RADIUS,
        height: '100%',
        borderColor,
        background,
        transition: 'border-color .2s, background .2s',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      bodyStyle={{
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingInline: 16,
        paddingBlock: 10,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1.4,
        textAlign: 'center',
        color: token.colorText,
      }}
    >
      {label}
    </Card>
  );
};

const Dictionary = () => {
  const actionRef = useRef<ActionType>();
  const [modal, modalContextHolder] = Modal.useModal();
  const { token } = theme.useToken();
  const { isDark } = useAppTheme();
  const admin = useSelector((state: RootState) => state.admin);
  const permissions = resolvePermissions(admin);
  const canReadDictionary = permissions.has('dictionary.read');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bkz. 'KALDIRILMADI' notu asagida
  const canUpdateDictionary = permissions.has('dictionary.update');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bkz. 'KALDIRILMADI' notu asagida
  const canDeleteDictionary = permissions.has('dictionary.delete');

  // Mobil başlık kısaltma -- kök neden: 'Açıklama / Kullanım Alanı'
  // başlığı telefon genişliğinde satır kırılıp gereksiz uzun/kötü
  // görünüyordu. SADECE görünen başlık metni değişir (varsayılan 768px
  // eşiği, projenin genelinde kullanılan mobil eşiğiyle AYNI); kolon
  // verisi/dataIndex/genişlik/tablet-desktop görünümü DEĞİŞMEZ.
  const isMobile = useBreakpoint();

  // Salt-okunur, tiklanamaz tarih metni -- Platform header referansindaki
  // gibi. State/filter/API'ye BAGLI DEGIL, bir kez hesaplanir.
  const todayLabel = useMemo(() => formatDdMmYyyy(new Date()), []);

  const [stats, setStats] = useState<DictionaryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [activeGroup, setActiveGroup] = useState<ActiveGroupFilter>(undefined);
  const [activeSubgroup, setActiveSubgroup] = useState<string | undefined>(
    undefined,
  );
  const [searchInput, setSearchInput] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DictionaryItem | null>(
    null,
  );

  // ProTable'in kendi sayfa state'i disariya acilmiyor; global "No" hesabi
  // (Users ekranindaki Sira No deseniyle AYNI: (page - 1) * pageSize + index
  // + 1) icin mevcut sayfa burada tutulur.
  const [currentPage, setCurrentPage] = useState(1);

  // Refs mirror the filter state so the ProTable `request` closure always
  // reads the latest values without needing to recreate the callback.
  const groupRef = useRef<string | undefined>(undefined);
  const subgroupRef = useRef<string | undefined>(undefined);
  const searchRef = useRef<string>('');
  const isFirstSearchRender = useRef(true);

  const loadStats = () => {
    return Promise.resolve()
      .then(() => setStatsLoading(true))
      .then(() => dictionaryApi.stats())
      .then((res) => setStats(res.data))
      .catch((error) => handleErrorResponse(error))
      .finally(() => setStatsLoading(false));
  };

  useEffect(() => {
    loadStats();
  }, []);

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

  const handleCardSelect = (group: ActiveGroupFilter) => {
    setActiveGroup(group);
    groupRef.current = group;
    setActiveSubgroup(undefined);
    subgroupRef.current = undefined;
    actionRef.current?.reloadAndRest?.();
  };

  const handleSubgroupSelect = (subgroup: string | undefined) => {
    setActiveSubgroup(subgroup);
    subgroupRef.current = subgroup;
    actionRef.current?.reloadAndRest?.();
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bkz. 'KALDIRILMADI' notu asagida
  const openEditModal = (record: DictionaryItem) => {
    setEditingRecord(record);
    setFormOpen(true);
  };

  const refreshAfterMutation = () => {
    actionRef.current?.reload();
    loadStats();
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bkz. 'KALDIRILMADI' notu asagida
  const showDeleteConfirmation = (record: DictionaryItem) => {
    modal.confirm({
      title: 'Sözlük Kaydını Sil',
      icon: <ExclamationCircleOutlined />,
      content: `"${record.english_term}" terimini silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'İptal',
      onOk: () => {
        return dictionaryApi
          .remove(record._id)
          .then(() => {
            showNotification(
              'Başarılı',
              NotificationType.SUCCESS,
              'Sözlük kaydı başarıyla silindi.',
            );
            refreshAfterMutation();
          })
          .catch((error) => handleErrorResponse(error));
      },
    });
  };

  // NOT: Bu, ana liste tablosunda GORUNEN kolon setidir -- `group`,
  // `subgroup` ve duzenle/sil aksiyonlari veri modelinden/backend'den
  // KALDIRILMADI (bkz. openEditModal/showDeleteConfirmation/
  // canUpdateDictionary/canDeleteDictionary/DictionaryFormModal asagida,
  // aynen duruyor); sadece bu tabloda GORUNMUYORLAR.
  const columns: ProColumns<DictionaryItem>[] = [
    {
      title: 'No',
      key: 'index',
      align: 'center',
      width: '7%',
      sorter: false,
      render: (_, __, index) =>
        String((currentPage - 1) * DICTIONARY_PAGE_SIZE + index + 1).padStart(
          2,
          '0',
        ),
    },
    {
      title: 'İngilizce',
      dataIndex: 'english_term',
      align: 'left',
      width: '15%',
      sorter: false,
    },
    {
      title: 'Türkçe',
      dataIndex: 'turkish_term',
      align: 'left',
      width: '18%',
      sorter: false,
    },
    {
      title: isMobile ? 'Açıklama' : 'Açıklama / Kullanım Alanı',
      dataIndex: 'description',
      align: 'left',
      sorter: false,
    },
  ];

  if (!canReadDictionary) {
    return (
      <BasePageContainer title="Dictionary">
        <div style={{ padding: 24 }}>Bu sayfayı görüntüleme yetkiniz yok.</div>
      </BasePageContainer>
    );
  }

  return (
    <BasePageContainer transparent>
      <Card
        bordered
        style={{ borderRadius: PAGE_CARD_RADIUS }}
        bodyStyle={{ padding: 24 }}
      >
        {/* Header (baslik + SearchBox) artik TEK genel Card'in EN USTUNDE:
            ikinci/harici bir Card veya wrapper YOK -- stats+table'i saran
            ayni Card'in ic gövdesinde ilk blok olarak render edilir. */}
        <div
          className="flex flex-wrap items-center justify-between"
          style={{
            gap: 12,
            marginBottom: 20,
            minHeight: 32,
            paddingBottom: 16,
            // Ince, sade ayirici cizgi -- projede zaten kullanilan ayni
            // border token'i (bkz. users/index.tsx content border'i ve
            // PersonEditModal.tsx borderBottom'i: token.colorBorderSecondary).
            // Yeni bir renk/CSS uretilmedi.
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <span
            style={{
              fontSize: 20,
              fontWeight: 500,
              lineHeight: 1.2,
              color: isDark ? token.colorText : 'rgba(0, 0, 0, 0.80)',
            }}
          >
            Dictionary
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox
              value={searchInput}
              onChange={(_event, data) => setSearchInput(data.value)}
              placeholder="Ara..."
              style={{ width: 240 }}
            />
            {/* Platform header referansindaki gibi salt-okunur tarih metni:
                input/DatePicker DEGIL, tiklanamaz, border/background yok,
                search/filter/API'ye BAGLI DEGIL. */}
            <span
              style={{
                fontSize: 13,
                lineHeight: 1.2,
                color: token.colorTextTertiary,
                whiteSpace: 'nowrap',
              }}
            >
              {todayLabel}
            </span>
          </div>
        </div>

        {/* Kartlar arası boşluk -- IQV Platform Deneme'deki gerçek KPI grid
            değerleriyle (columnGap/rowGap) birebir: yatay 32px, dikey 24px
            (bkz. yukarıdaki StatCard yorumu). Row/Col grid yapısı (3 eşit
            kolon, mobilde alt alta) DEĞİŞMEDİ -- yalnızca `gutter` gerçek
            referans ölçüsüne güncellendi. */}
        <Row gutter={[32, 24]} style={{ marginBottom: 16 }}>
          {/* Kart sırası: Toplam - Endüstriyel - IQV OS AI (soldan sağa).
            Count/filter mantığı DEĞİŞMEDİ -- yalnızca görünen sıra ve
            "Tüm Terimler" -> "Toplam" başlık metni güncellendi. */}
          <Col xl={8} lg={8} md={8} sm={24} xs={24}>
            <StatCard
              icon={<UnorderedListOutlined />}
              label="Toplam"
              value={stats?.total ?? 0}
              loading={statsLoading}
              active={activeGroup === undefined}
              onClick={() => handleCardSelect(undefined)}
            />
          </Col>
          <Col xl={8} lg={8} md={8} sm={24} xs={24}>
            <StatCard
              icon={<ToolOutlined />}
              label={DICTIONARY_GROUP_INDUSTRIAL}
              value={stats?.industrial ?? 0}
              loading={statsLoading}
              active={activeGroup === DICTIONARY_GROUP_INDUSTRIAL}
              onClick={() => handleCardSelect(DICTIONARY_GROUP_INDUSTRIAL)}
            />
          </Col>
          <Col xl={8} lg={8} md={8} sm={24} xs={24}>
            <StatCard
              icon={<RobotOutlined />}
              label={DICTIONARY_GROUP_IQV_OS_AI}
              value={stats?.iqv_os_ai ?? 0}
              loading={statsLoading}
              active={activeGroup === DICTIONARY_GROUP_IQV_OS_AI}
              onClick={() => handleCardSelect(DICTIONARY_GROUP_IQV_OS_AI)}
            />
          </Col>
        </Row>

        {activeGroup === DICTIONARY_GROUP_INDUSTRIAL && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: token.colorText,
                marginBottom: 8,
              }}
            >
              Endüstriyel Alt Gruplar
            </div>
            <div
              className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3"
              style={{ width: '100%', gridAutoRows: '1fr' }}
            >
              {INDUSTRIAL_ALT_GRUPLAR.map((subgroup) => (
                <SubgroupOptionCard
                  key={subgroup}
                  label={subgroup}
                  active={activeSubgroup === subgroup}
                  onClick={() =>
                    handleSubgroupSelect(
                      activeSubgroup === subgroup ? undefined : subgroup,
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}

        <ProTable<DictionaryItem>
          columns={columns}
          cardBordered={false}
          bordered
          showSorterTooltip={false}
          scroll={{ x: true }}
          tableLayout="fixed"
          rowSelection={false}
          pagination={{
            showQuickJumper: true,
            pageSize: DICTIONARY_PAGE_SIZE,
            onChange: (page) => setCurrentPage(page),
          }}
          actionRef={actionRef}
          search={false}
          options={{ search: false }}
          toolBarRender={false}
          dateFormatter="string"
          rowKey="_id"
          locale={{
            emptyText: searchInput.trim()
              ? 'Arama kriterlerine uygun kayıt bulunamadı.'
              : 'Sözlük kaydı bulunamadı.',
          }}
          request={(params) => {
            const page = params.current ?? 1;
            setCurrentPage(page);
            return dictionaryApi
              .list({
                page,
                limit: params.pageSize ?? DICTIONARY_PAGE_SIZE,
                search: searchRef.current || undefined,
                group: groupRef.current,
                subgroup: subgroupRef.current,
              })
              .then((response) => {
                return {
                  data: response.data,
                  success: response.success,
                  total: response.pagination.total,
                } as RequestData<DictionaryItem>;
              })
              .catch((error) => {
                handleErrorResponse(error);

                return {
                  data: [],
                  success: false,
                } as RequestData<DictionaryItem>;
              });
          }}
        />
      </Card>

      <DictionaryFormModal
        open={formOpen}
        record={editingRecord}
        onClose={() => setFormOpen(false)}
        onSuccess={refreshAfterMutation}
      />

      {modalContextHolder}
    </BasePageContainer>
  );
};

export default Dictionary;
