import { Button, Card, Form, Modal, theme } from 'antd';
import { DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import {
  Input as IqvInput,
  Label,
  Select as IqvSelect,
  SearchBox,
  Textarea as IqvTextarea,
  makeStyles,
  useId,
} from '@iqvizyonui/react-components';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSelector } from 'react-redux';
import {
  DICTIONARY_GROUP_IQV_OS_AI,
  DICTIONARY_GROUP_INDUSTRIAL,
  DICTIONARY_GROUP_OPTIONS,
  DictionaryFormValues,
  DictionaryItem,
} from '../../interfaces/models/dictionary';
import { dictionaryApi } from '../../services/dictionaryApi';
import {
  NotificationType,
  SAVE_BUTTON_STYLE,
  handleErrorResponse,
  showNotification,
} from '../../utils';
import { resolvePermissions } from '../../utils/permissions';
import { PAGE_CARD_RADIUS } from '../../constants';
import BasePageContainer from '../layout/PageContainer';
import { RootState } from '../../store';

// IQV Platform'un GERÇEK PersonnelFormModal.tsx bileşeninde (Platform
// Frontend/dashboard/src/components/settings/PersonnelFormModal.tsx) ve
// Dictionary'nin KENDİ PersonEditModal.tsx'inde (Personel ekranı için
// daha önce BİREBİR aynı şekilde taşınmıştı) kullanılan AYNI ölçü: IQV
// `Input` root border (1px) + input slot padding (spacingHorizontalM =
// 12px) = 13px. `Form.Item` KENDİ `label` prop'unu KULLANMAZ -- IQV
// `Label` ile ÇİFT etiket oluşmasın diye.
const FIELD_LABEL_INSET = '13px';

const useFieldStyles = makeStyles({
  field: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
  },
  label: {
    paddingInlineStart: FIELD_LABEL_INSET,
    color: '#808080',
  },
  control: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  controlInput: {
    color: '#808080',
  },
});

interface FieldErrorDetail {
  field: string;
  message: string;
}

const SEARCH_DEBOUNCE_MS = 400;

// ALT GRUP -- `Grup = Endüstriyel` icin SABİT, guvenilir secenek listesi.
// `dictionaryApi.subgroups()` (canli DB'deki distinct `subgroup` degerleri)
// bu ekranda GUVENILIR sonuc vermedi -- Ayarlar ekranindaki gercek
// kullanicilarin permission/veri durumuna bagli olarak dropdown bos
// kalabiliyordu. Bu YUZDEN bu ekranda ARTIK API'YE BAGIMLI DEGIL: 8
// Endustriyel alt grubu burada acik/sabit bir liste olarak tanimlanir.
// Degerler kullanicinin kendisinin ONAYLADIGI, sistemde GERCEKTEN var
// olan tam listedir (bkz. Dictionary ana sayfasindaki "Endustriyel Alt
// Gruplar" ile AYNI 8 isim). IQV `Select`, GERCEK bir native <select>
// render eder (bkz. @iqvizyonui/react-select -> SelectSlots.select) ve
// `options` PROP'U DEGIL, `<option>` COCUKLARI bekler -- bu yuzden bu
// dizi asagida dogrudan `.map()` ile `<option>` uretmek icin kullanilir
// (antd Select'teki gibi bir `options` prop'una VERILMEZ). `value` =
// backend'e gonderilen GERCEK `subgroup` string'i (Turkce label ile
// birebir ayni -- ayri bir id/key UYDURULMADI, cunku mevcut backend
// `subgroup` alani zaten duz bir metin degeri olarak saklaniyor, bkz.
// backend/src/modules/dictionary/dictionary.types.ts `subgroup?: string`).
const INDUSTRIAL_SUBGROUP_OPTIONS = [
  'Temel Makine, Proses ve Sensör Terimi',
  'Üretim',
  'Bakım',
  'Kalite',
  'Veri, Yapay Zekâ ve Analitik',
  'Yazılım, Sistem ve Siber Güvenlik',
  'Endüstriyel Haberleşme ve Otomasyon',
  'Enerji ve Sürdürülebilirlik',
].map((label) => ({ label, value: label }));

// GRUP ESLESTIRME KOK NEDEN DUZELTMESI -- backend'deki group-normalize.ts
// (bkz. backend/src/modules/dictionary/group-normalize.ts) yorumlarinda
// ACIKCA belirtildigi gibi, eski/legacy kayitlarda `group` alani kanonik
// degerlerden ("IQV OS AI" / "Endüstriyel") FARKLI yazim varyantlariyla
// saklanmis olabilir (ör. "Industrial", "Endustriyel", "iqv-os-ai",
// "IQVOSAI"). Backend'in `toRecord()`'u bu degeri OLDUGU GIBI dondurur --
// normalizasyon backend'de yalnizca FILTRELEME icin kullanilir, API
// yanitina yansitilmaz. Asagidaki Grup `<Select>` ise SABIT iki
// `<option>` render eder; native <select>'e eslesmeyen bir `value`
// verildiginde secim GORUNMEZ/bos kalir -- arama sonucundan yuklenirken
// Grup'un (ve ona bagli Alt Grup secenek listesinin) bos gorunmesinin
// GERCEK kok nedeni budur. Backend'deki AYNI kucuk-harf + Turkce
// diakritik sadelestirme + bosluk/tire silme kuraliyla, YALNIZCA FORM'A
// YUKLERKEN, kanonik iki degerden birine eslestirilir; taninmayan bir
// deger DEGISTIRILMEDEN (trim disinda) oldugu gibi birakilir -- yeni/
// bilinmeyen bir grup UYDURULMAZ.
const stripDiacriticsForGroupMatch = (value: string): string =>
  value
    .replace(/[İI]/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u');

const simplifyGroupForMatch = (value: string): string =>
  stripDiacriticsForGroupMatch(value.toLowerCase()).replace(/[\s_-]+/g, '');

const canonicalizeGroupForForm = (rawGroup: string): string => {
  const simplified = simplifyGroupForMatch(rawGroup);
  if (simplified === 'iqvosai') {
    return DICTIONARY_GROUP_IQV_OS_AI;
  }
  if (simplified === 'endustriyel' || simplified === 'industrial') {
    return DICTIONARY_GROUP_INDUSTRIAL;
  }
  return rawGroup.trim();
};

// "Ayarlar" doubles as the Dictionary quick-add screen from the old
// standalone app: search an existing term to load it into the form, or
// fill the form from scratch and save — both go through the same
// dictionaryApi.create used by the main Dictionary page, no second API.
const Settings = () => {
  const [form] = Form.useForm<DictionaryFormValues>();
  const { token } = theme.useToken();
  // Silme onayi -- users/index.tsx'teki requestDeletePerson() ile BIREBIR
  // AYNI, projede zaten var olan GERCEK confirm deseni (antd
  // `Modal.useModal()` + `modal.confirm(...)`); yeni bir onay bileseni
  // UYDURULMADI.
  const [modal, modalContextHolder] = Modal.useModal();
  const selectedGroup = Form.useWatch('group', form);
  // PLACEHOLDER RENGI ICIN: Platform'daki GERCEK desenle (bkz.
  // components/notes/NoteFormModal.tsx -> `moduleValue` / "Konu" IQV
  // Select'i) BIREBIR AYNI mekanizma. Form state'ine YAZMAZ,
  // dogrulama/submit akisina KARISMAZ -- salt okuma; yalnizca "placeholder
  // mi, gercek secim mi" ayrimini yapip asagidaki Select'in `select`
  // slotuna kosullu bir class eklemek icin kullanilir.
  const subgroupValue = Form.useWatch('subgroup', form);
  // Platform'daki PersonnelFormModal.tsx (ve Dictionary'nin kendi
  // PersonEditModal.tsx'i) ile BİREBİR aynı desen: griffel `useFieldStyles`
  // + `useId` (etiket-girdi bağlantısı).
  const fieldStyles = useFieldStyles();
  const groupFieldId = useId('dictionary-group');
  const subgroupFieldId = useId('dictionary-subgroup');
  const turkishFieldId = useId('dictionary-turkish');
  const englishFieldId = useId('dictionary-english');
  const descriptionFieldId = useId('dictionary-description');
  const [submitting, setSubmitting] = useState(false);
  const admin = useSelector((state: RootState) => state.admin);
  const permissions = resolvePermissions(admin);
  // NOT: Ayarlar'in kendi backend route'u yok -- gercekte
  // dictionaryApi.list/create'i (GET/POST /api/v1/dictionary) cagirir. Bu
  // yuzden backend'de bu iki route settings.read/settings.update VEYA
  // dictionary.read/dictionary.create ile enforce edilir (bkz.
  // backend/src/modules/dictionary/dictionary.routes.ts). Buradaki gorunum
  // kontrolu settings.* iznini ONCELIKLI GOSTERIR (Ayarlar'a ozel yetki
  // ayrimi yapmak isteyen bir yoneticiye anlamli gelsin diye) ama
  // dictionary.read/dictionary.create'e sahip bir kullanici da ayni
  // GERCEK backend yetkisine sahiptir.
  const canReadSettings =
    permissions.has('settings.read') || permissions.has('dictionary.read');
  const canUpdateSettings =
    permissions.has('settings.update') || permissions.has('dictionary.create');
  // DELETE /api/v1/dictionary/:id backend'de YALNIZCA 'dictionary.delete'
  // ister (bkz. dictionary.routes.ts) -- diger route'lardaki
  // settings.read/settings.update alternatifi bu route'ta YOKTUR. Bu
  // bayrak backend'deki GERCEK zorunlulugu degistirmeden, oldugu gibi
  // yansitir.
  const canDeleteSettings = permissions.has('dictionary.delete');

  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<DictionaryItem[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const searchBlurTimer = useRef<ReturnType<typeof setTimeout>>();
  // Mevcut bir Dictionary kaydi arama sonucundan secildiginde bu kaydin
  // gercek `_id`'si burada tutulur (React state, YENI bir backend/route
  // UYDURULMADI). `null` = "create modu" (form bos/yeni kayit), dolu
  // deger = "update modu" (Kaydet, dictionaryApi.update(id, ...) cagirir,
  // mevcut DictionaryFormModal.tsx'teki `isEditMode = Boolean(record)`
  // deseniyle AYNI mantik). Yalnizca: (a) bir arama sonucu secildiginde,
  // (b) kayit basariyla create/update edildiginde, (c) kullanici arama
  // kutusunu MANUEL olarak (gercek SearchBox onChange olayiyla) bosalttiginda
  // degisir -- handleTermSelect icindeki programatik `setSearchValue('')`
  // BUNU TETIKLEMEZ (bkz. asagidaki SearchBox onChange).
  const [selectedDictionaryId, setSelectedDictionaryId] = useState<
    string | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    const trimmed = searchValue.trim();

    searchTimer.current = setTimeout(() => {
      if (!trimmed) {
        setSearchResults([]);
        return;
      }

      dictionaryApi
        .list({ page: 1, limit: 8, search: trimmed })
        .then((res) => setSearchResults(res.data))
        .catch(() => setSearchResults([]));
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, [searchValue]);

  useEffect(() => {
    return () => {
      if (searchBlurTimer.current) {
        clearTimeout(searchBlurTimer.current);
      }
    };
  }, []);

  const handleTermSelect = (item: DictionaryItem) => {
    form.setFieldsValue({
      group: canonicalizeGroupForForm(item.group),
      subgroup: item.subgroup ?? '',
      turkish_term: item.turkish_term,
      english_term: item.english_term,
      description: item.description,
    });
    setSelectedDictionaryId(item._id);
    setSearchValue(item.turkish_term);
    setSearchResults([]);
  };

  const requestDeleteDictionaryItem = () => {
    if (!selectedDictionaryId || deleting) {
      return;
    }
    const idToDelete = selectedDictionaryId;

    modal.confirm({
      title: 'Terimi Sil',
      icon: <ExclamationCircleOutlined />,
      content: 'Bu terimi silmek istediğinizden emin misiniz?',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'İptal',
      onOk: () => {
        // users/index.tsx'teki requestDeletePerson() ile AYNI: loading
        // durumu YALNIZCA kullanici onay dialogunda GERCEKTEN "Sil"e
        // bastiginda (onOk icinde) baslar -- dialog acildigi anda DEGIL.
        setDeleting(true);
        return dictionaryApi
          .remove(idToDelete)
          .then(() => {
            showNotification(
              'Başarılı',
              NotificationType.SUCCESS,
              'Sözlük kaydı başarıyla silindi.',
            );
            // Basarili silme sonrasi: create moduna donulur, arama ve
            // form tamamen temizlenir -- silinen kayit artik aramada da
            // GORUNMEZ (SearchBox zaten bos, bir sonraki arama backend'e
            // yeniden sorar).
            setSelectedDictionaryId(null);
            form.resetFields();
            setSearchValue('');
            setSearchResults([]);
          })
          .catch((error) => {
            // Sessiz `.catch(() => {})` YAPILMAZ -- mevcut hata/notification
            // standardi (handleErrorResponse) kullanilir; form ve
            // selectedDictionaryId (update modu) OLDUGU GIBI KORUNUR ki
            // kullanici tekrar deneyebilsin.
            handleErrorResponse(error);
          })
          .finally(() => setDeleting(false));
      },
    });
  };

  const handleSubmit = async (values: DictionaryFormValues) => {
    setSubmitting(true);

    const payload: DictionaryFormValues = {
      ...values,
      subgroup:
        values.group === DICTIONARY_GROUP_IQV_OS_AI
          ? undefined
          : values.subgroup?.trim() || undefined,
    };

    try {
      // Arama sonucundan mevcut bir kayit secilmisse (selectedDictionaryId
      // dolu) GUNCELLEME yapilir -- projede zaten var olan GERCEK update
      // endpoint'i uzerinden (bkz. dictionaryApi.update -> PUT
      // /api/v1/dictionary/:id, ayni cagri deseni
      // DictionaryFormModal.tsx'teki `isEditMode` daliyla BIREBIR ayni).
      // Aksi halde (create modu) mevcut davranis DEGISMEDEN korunur.
      if (selectedDictionaryId) {
        await dictionaryApi.update(selectedDictionaryId, payload);
        showNotification(
          'Başarılı',
          NotificationType.SUCCESS,
          'Sözlük kaydı başarıyla güncellendi.',
        );
      } else {
        await dictionaryApi.create(payload);
        showNotification(
          'Başarılı',
          NotificationType.SUCCESS,
          'Sözlük kaydı başarıyla oluşturuldu.',
        );
      }
      // Basarili kayittan sonra (create VEYA update) form create moduna
      // doner -- create akisinin ONCEKI davranisiyla (form.resetFields())
      // BIREBIR ayni, artik ayrica secili kaydi da temizler.
      setSelectedDictionaryId(null);
      form.resetFields();
    } catch (error) {
      const fieldErrors = (
        error as { response?: { data?: { errors?: FieldErrorDetail[] } } }
      )?.response?.data?.errors;

      if (Array.isArray(fieldErrors)) {
        form.setFields(
          fieldErrors.map((fieldError) => ({
            // QA TURU / build FIX: backend'in dondugu `field` degeri
            // (dinamik bir string) antd `FieldData<DictionaryFormValues>`
            // ile TS seviyesinde eslesmiyordu (tsc: TS2345) -- `npm run
            // build` bunun yuzunden BASARISIZ oluyordu. Backend'in
            // dondugu alan adlari (dictionary.validation.ts) GERCEKTEN bu
            // formun alan adlariyla BIREBIR eslesir (is kurali/invariant);
            // bu yuzden minimal, guvenli bir tip donusumu yeterlidir --
            // calisma zamani davranisi DEGISMEZ, sadece derleme zamani
            // tip uyusmazligi cozulur.
            name: fieldError.field as keyof DictionaryFormValues,
            errors: [fieldError.message],
          })),
        );
      }

      handleErrorResponse(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canReadSettings) {
    return (
      <BasePageContainer transparent>
        <div style={{ padding: 24 }}>Bu sayfayı görüntüleme yetkiniz yok.</div>
      </BasePageContainer>
    );
  }

  return (
    <BasePageContainer transparent>
      {modalContextHolder}
      <Card
        bordered
        style={{ borderRadius: PAGE_CARD_RADIUS }}
        // Dış Card sol/sağ iç boşluğunun gerçek kaynağı: Personel
        // (users/index.tsx) tarafındaki BİREBİR ayni dış Card,
        // bodyStyle={{ paddingInline: 32, paddingBlock: 24 }} kullaniyor --
        // yani yatayda 32px, dikeyde 24px. Burada ise sadece `padding: 24`
        // (yatay da 24px) verilmisti; bu da başlığı ve alttaki form
        // Card'ını Personel'e göre 8px daha sola, dış Card kenarına daha
        // yakın başlatıyordu. Dikey (24px) zaten aynıydı, yalnızca yatay
        // paddingInline: 32 olarak Personel ile eşitlenir.
        bodyStyle={{ paddingInline: 32, paddingBlock: 24 }}
      >
        {/* HEADER -> FORM CARD dikey boşluğunun gerçek kaynağı: bu
           wrapper'daki Tailwind `mb-5` (1.25rem = 20px) idi (Card'in
           kendi bodyStyle.padding'i veya alttaki Card'da fazladan bir
           margin-top YOK -- devtools'ta da görüldüğü gibi ikinci
           ant-card-body padding: 0px). Personel (users/index.tsx)
           tarafındaki BİREBİR ayni header wrapper, aynı işi
           marginBottom: 12 (Tailwind'in mb-3'üne karşılık gelir) ile
           yapıyor; uygulamanın standardı 12px, 20px degil. Burada da
           ayni 12px'e cekiliyor -- gap-3, items-center, justify-between
           DEGISMEDEN. */}
        <div
          className="flex flex-wrap items-center justify-between gap-3"
          style={{ marginBottom: 12 }}
        >
          {/* Kart üst kenarı <-> başlık mesafesi: Card bodyStyle.padding
             (24px) Personel tarafıyla (paddingBlock: 24) zaten AYNI --
             fazladan boşluğun gerçek kaynağı buradaki `text-xl`in
             Tailwind varsayılan line-height'i (1.75rem/28px) idi; Personel
             tarafındaki başlık span'i lineHeight: 1.2 (24px) kullanıyor.
             O 4px'lik fazlalığı gidermek için burada da BİREBİR ayni
             lineHeight: 1.2 uygulanir -- font boyutu/kalinligi/rengi
             (text-xl font-semibold) DEGISMEDEN. */}
          <h1 className="text-xl font-semibold m-0" style={{ lineHeight: 1.2 }}>
            Ayarlar
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative" style={{ width: 240 }}>
              <SearchBox
                value={searchValue}
                onChange={(_event, data) => {
                  setSearchValue(data.value);
                  // Kullanici, bir kayit SECILIYKEN arama kutusunu KENDISI
                  // (gercek input olayiyla) bosaltirsa update modundan
                  // cikilir ve form create moduna doner. `handleTermSelect`
                  // icindeki programatik `setSearchValue('')` bu onChange
                  // UZERINDEN GECMEDIGI icin (dogrudan state set'i) burayi
                  // TETIKLEMEZ -- yani bir kayit secildigi anda yanlislikla
                  // hemen update modundan cikilmaz.
                  if (!data.value && selectedDictionaryId) {
                    setSelectedDictionaryId(null);
                    form.resetFields();
                  }
                }}
                onFocus={() => {
                  if (searchBlurTimer.current) {
                    clearTimeout(searchBlurTimer.current);
                  }
                  setSearchFocused(true);
                }}
                onBlur={() => {
                  // Delay the close so a click on a result below can still
                  // register before the dropdown unmounts.
                  searchBlurTimer.current = setTimeout(() => {
                    setSearchFocused(false);
                  }, 150);
                }}
                placeholder="Terim ara"
                style={{ width: '100%' }}
              />
              {searchFocused && searchResults.length > 0 && (
                <div
                  className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-auto bg-white shadow-md"
                  style={{
                    borderRadius: PAGE_CARD_RADIUS,
                    border: '1px solid #d9d9d9',
                  }}
                >
                  {searchResults.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => handleTermSelect(item)}
                      className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {item.english_term} — {item.turkish_term}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <Card
          bordered
          style={{ borderRadius: PAGE_CARD_RADIUS }}
          bodyStyle={{ padding: 0 }}
        >
          <div className="p-5 md:p-6">
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              onFinish={handleSubmit}
              initialValues={{
                group: DICTIONARY_GROUP_INDUSTRIAL,
                // Native <select> tabanlı IQV Select, "seçim yok" durumunu
                // yalnızca boş DEĞERLİ ("") bir <option> ile gösterebilir
                // (bkz. aşağıdaki Alt Grup placeholder option'ı); bu yüzden
                // `undefined` DEĞİL, açıkça `''` ile başlatılır (Platform'daki
                // NoteFormModal.tsx `NOTE_FORM_RESET_VALUES = { module_id: '',
                // ... }` ile AYNI gerekçe/desen).
                subgroup: '',
                // KOK NEDEN DUZELTMESI: bu 3 alan IQV `Input`/`Textarea`
                // kullanıyor (Select DEĞİL) ve bu bileşenler kendi
                // `useControllableState`'i ile "controlled/uncontrolled"
                // kararını YALNIZCA İLK RENDER'DA verip kalıcı olarak
                // kilitliyor (bkz. @iqvizyonui/react-utilities
                // useControllableState.js -- doğrulandı). `undefined`
                // İLK DEĞER verilirse bileşen SONSUZA KADAR "uncontrolled"
                // kalıyor ve sonraki `form.setFieldsValue()` çağrıları
                // GÖRSEL olarak hiç yansımıyordu -- arama sonucundan kayıt
                // seçildiğinde Türkçe/İngilizce/Açıklama'nın placeholder'da
                // takılı kalmasının GERÇEK nedeni buydu. `subgroup` ile
                // AYNI gerekçeyle: `undefined` değil, açıkça `''`.
                turkish_term: '',
                english_term: '',
                description: '',
              }}
            >
              {/* KOK NEDEN DUZELTMESI: onceki turda margin-bottom AZALTILARAK
                  sol kolonu sagdaki SABIT textarea yuksekligine sigdirmaya
                  calisilmisti -- bu yalnizca yaklasik bir deger oldugu icin
                  Ingilizce alani hala tasiyordu. Gercek cozum: iki kolon artik
                  bir CSS GRID satirinin hucreleri (grid varsayilani
                  `align-items: stretch` ile CROSS-AXIS'te birbirine ESITLENIR).
                  Sol kolonun GERCEK (icerik kaynakli) yuksekligi grid satirinin
                  yuksekligini belirler; sag hucre bu yuksekligi otomatik
                  DEVRALIR, icindeki textarea da flex-1 ile o yuksekligin
                  TAMAMINI doldurur -- boylece Ingilizce input'un alt siniri ile
                  textarea'nin alt siniri HER ZAMAN esitlenir (sabit bir piksel
                  degerine bagli degil). */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                <div>
                  {/* GRUP -- IQV Platform'un GERÇEK PersonnelFormModal.tsx
                      "Rol"/"Durum" alanlarıyla BİREBİR aynı desen: `Form.Item`
                      KENDİ `label`'ını KULLANMAZ (çift etiket olmasın diye),
                      onun yerine IQV `Label` + native `<select>` render eden
                      IQV `Select` kullanılır. IQV Select imzası:
                      `onChange(event, data) -> data.value` -- `Form.Item`
                      value/onChange'i ENJEKTE eder, native <select> olduğu
                      için varsayılan `getValueFromEvent` (event.target.value)
                      DOĞRU çalışır (bkz. Platform'daki aynı yorum). */}
                  <div className={fieldStyles.field}>
                    <Label
                      htmlFor={groupFieldId}
                      className={fieldStyles.label}
                      required
                    >
                      Grup
                    </Label>
                    <Form.Item
                      name="group"
                      rules={[{ required: true, message: 'Grup zorunludur.' }]}
                    >
                      <IqvSelect
                        id={groupFieldId}
                        className={fieldStyles.control}
                        // Kullanici Grup'u degistirirse ve yeni grubun alt
                        // grup kavrami YOKSA (IQV OS AI), formda kalmis ESKI
                        // bir Alt Grup secimi birakilmaz (gorev geregi).
                        // Senkron temizleme, State degisikligine sebep olan
                        // GERCEK kullanici olayinin (onChange) icinde yapilir
                        // -- bir useEffect'te DEGIL (React'in onerdigi
                        // "olayin kendisinde guncelle" deseni). Deger ARTIK
                        // `undefined` DEGIL `''` -- Alt Grup'un placeholder
                        // option'i ("") ile AYNI bos-deger sozlesmesi.
                        onChange={(_event, data) => {
                          if (data.value === DICTIONARY_GROUP_IQV_OS_AI) {
                            form.setFieldValue('subgroup', '');
                          }
                        }}
                      >
                        {DICTIONARY_GROUP_OPTIONS.map((group) => (
                          <option key={group} value={group}>
                            {group}
                          </option>
                        ))}
                      </IqvSelect>
                    </Form.Item>
                  </div>

                  <div className={fieldStyles.field}>
                    <Label
                      htmlFor={subgroupFieldId}
                      className={fieldStyles.label}
                    >
                      Alt Grup
                    </Label>
                    {/* ALT GRUP -- Grup ile AYNI IQV Select bileseni. Secenekler
                        SABİT `INDUSTRIAL_SUBGROUP_OPTIONS` listesinden gelir
                        (API'ye bagimli DEGIL). `disabled` onceki antd Select
                        ile BIREBIR AYNI kosul (IQV OS AI grubunun alt grubu
                        yoktur). PLACEHOLDER: native <select>'te `placeholder`
                        prop'u/attribute'u YOKTUR -- Platform'daki GERCEK
                        cozum (bkz. components/notes/NoteFormModal.tsx,
                        "Modül Seçiniz" secenegi) `disabled hidden` isaretli
                        bos degerli (`value=""`) bir <option>'dir: secim
                        yokken kutuda GORUNUR, ancak acilan listede HIC
                        LISTELENMEZ/secilemez. antd'nin `allowClear` prop'u
                        IQV Select'te YOKTUR (native select'in boyle bir
                        kavrami yok) -- bu yuzden KALDIRILDI; "temizleme"
                        zaten yukaridaki Grup onChange'i ile KOD TARAFINDAN
                        yapiliyor. */}
                    <Form.Item name="subgroup">
                      <IqvSelect
                        id={subgroupFieldId}
                        className={fieldStyles.control}
                        disabled={selectedGroup === DICTIONARY_GROUP_IQV_OS_AI}
                        // PLACEHOLDER METIN RENGI -- Platform'daki GERCEK
                        // cozumle (NoteFormModal.tsx, "Konu" IQV Select'i)
                        // BIREBIR AYNI: secim yokken (deger "") native
                        // <select>'in metni Fluent'in normal
                        // `colorNeutralForeground1` kuralindan geliyordu ve
                        // GERCEK bir secilmis deger gibi KOYU gorunuyordu.
                        // Yalnizca O DURUMDA `iqv-select-placeholder` sinifi
                        // eklenir; sinif src/index.css'te TEK KAYNAK
                        // `--iqv-placeholder-color` degiskeninden renk alir
                        // (Platform'daki ayni degiskenin BIREBIR aynisi).
                        // Gercek bir alt grup seciliyken sinif HIC eklenmez,
                        // yani mevcut normal (koyu) metin rengi AYNEN
                        // korunur. `select` slotu native <select> elemanina
                        // denk gelir (bkz. @iqvizyonui/react-select ->
                        // SelectSlots.select); border/height/padding/ikon/
                        // hover/focus ve acilan listedeki secenek stilleri
                        // DEGISTIRILMEDI -- yalnizca kapali kutudaki metnin
                        // `color`i.
                        select={
                          subgroupValue
                            ? undefined
                            : { className: 'iqv-select-placeholder' }
                        }
                      >
                        <option value="" disabled hidden>
                          Alt grup seçin
                        </option>
                        {(selectedGroup === DICTIONARY_GROUP_INDUSTRIAL
                          ? INDUSTRIAL_SUBGROUP_OPTIONS
                          : []
                        ).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </IqvSelect>
                    </Form.Item>
                  </div>

                  <div className={fieldStyles.field}>
                    <Label
                      htmlFor={turkishFieldId}
                      className={fieldStyles.label}
                      required
                    >
                      Türkçe
                    </Label>
                    {/* TÜRKÇE -- Platform'daki PersonnelFormModal.tsx
                        `textField` yardımcısıyla BİREBİR aynı desen: IQV
                        `Input`, placeholder DEĞİŞMEDİ. */}
                    <Form.Item
                      name="turkish_term"
                      rules={[
                        {
                          required: true,
                          message: 'Türkçe karşılık zorunludur.',
                        },
                      ]}
                    >
                      <IqvInput
                        id={turkishFieldId}
                        placeholder="Örn. Kestirimci Bakım"
                        maxLength={200}
                        className={fieldStyles.control}
                        input={{ className: fieldStyles.controlInput }}
                      />
                    </Form.Item>
                  </div>

                  <div className={fieldStyles.field}>
                    <Label
                      htmlFor={englishFieldId}
                      className={fieldStyles.label}
                      required
                    >
                      İngilizce
                    </Label>
                    {/* İNGİLİZCE -- Türkçe ile AYNI IQV `Input` deseni.
                        `!mb-0`: bu sütundaki SON alan olduğu için antd
                        `Form.Item`in kendi alt boşluğu iptal edilir --
                        ÖNCEKİ davranışla BİREBİR AYNI (yalnızca antd
                        `Form.Item` artık bir üst `Label`'sız, doğrudan
                        `IqvInput` sarmalıyor). */}
                    <Form.Item
                      name="english_term"
                      rules={[
                        {
                          required: true,
                          message: 'İngilizce terim zorunludur.',
                        },
                      ]}
                      className="!mb-0"
                    >
                      <IqvInput
                        id={englishFieldId}
                        placeholder="Örn. Predictive Maintenance"
                        maxLength={200}
                        className={fieldStyles.control}
                        input={{ className: fieldStyles.controlInput }}
                      />
                    </Form.Item>
                  </div>
                </div>

                <div className={`${fieldStyles.field} h-full`}>
                  {/* AÇIKLAMA / KULLANIM ALANI -- KOK NEDEN ARASTIRMASI:
                      Platform'un KENDI kod tabaninda hicbir yerde IQVizyon
                      UI'in cok satirli bir bileseni KULLANILMIYOR --
                      Platform'un TEK uzun serbest metin alani (Not icerigi,
                      components/notes/NoteFormModal.tsx) da antd
                      `Input.TextArea` kullaniyor, IQV DEGIL. Ancak
                      `@iqvizyonui/react-components` paketi (Dictionary'nin
                      Grup/Alt Grup/Türkçe/İngilizce icin ZATEN kullandigi
                      AYNI paket) GERCEKTEN bir `Textarea` bileseni EXPORT
                      EDIYOR (bkz. node_modules/@iqvizyonui/react-textarea) --
                      Platform'un kendi ekranlarinda henuz KULLANILMAMIS
                      olsa da, uydurulmus/sahte bir component DEGIL, ayni
                      IQVizyon UI ailesinin GERCEK bir parcasi. Bu alan zaten
                      diger 4 alanla (Grup/Alt Grup/Türkçe/İngilizce) AYNI
                      IQVizyon standardina gecirildigi icin, tutarlilik
                      adina raw antd TextArea yerine bu GERCEK IQV `Textarea`
                      kullanilir -- CSS ile antd'yi IQV gibi GOSTERMEK
                      YERINE, gercek bir IQV bileseni. */}
                  <Label
                    htmlFor={descriptionFieldId}
                    className={fieldStyles.label}
                    required
                  >
                    Açıklama / Kullanım Alanı
                  </Label>
                  <Form.Item
                    name="description"
                    rules={[
                      { required: true, message: 'Açıklama zorunludur.' },
                    ]}
                    className="!mb-0 flex-1 flex flex-col [&_.ant-form-item-row]:flex-1 [&_.ant-form-item-control]:flex-1 [&_.ant-form-item-control-input]:h-full [&_.ant-form-item-control-input-content]:h-full"
                  >
                    {/* `resize` -- IQV Textarea'nin KENDI, ozel bir prop'u
                        ('none'|'horizontal'|'vertical'|'both'); antd'deki
                        gibi raw CSS `resize` stiliyle TAKLIT EDILMEDI.
                        Yukseklik: bilesenin KENDI dokumantasyonuna gore
                        ROOT slotu (kenarlik sarmalayicisi) yalnizca
                        `className`/`style` alir, diger butun native
                        prop'lar (placeholder, maxLength, id) `textarea`
                        slotuna gider -- bu yuzden gercek `<textarea>`
                        elemaninin da tam yukseklik doldurmasi icin AYRICA
                        `textarea={{ style: { height: '100%' } }}` ile
                        birincil slot ACIKCA hedeflenir (Dictionary'nin
                        kendi Input kullanimindaki `input={{ className }}`
                        deseniyle AYNI mekanizma). Onceki antd TextArea'nin
                        `style={{height:'100%', resize:'vertical'}}`
                        DAVRANISIYLA gorsel olarak AYNI sonuc hedeflenir. */}
                    <IqvTextarea
                      id={descriptionFieldId}
                      placeholder="Terimin açıklamasını, kullanım alanını ve gerekli notları yazın."
                      maxLength={2000}
                      resize="vertical"
                      className={fieldStyles.control}
                      style={{ height: '100%' }}
                      textarea={{ style: { height: '100%' } }}
                    />
                  </Form.Item>
                </div>
              </div>

              <div className="flex justify-end items-center gap-2 mt-2">
                {/* SIL -- yalnizca UPDATE modunda (bir kayit secili) VE
                    gercek `dictionary.delete` iznine sahip kullanicida
                    gorunur; create modunda hic render EDILMEZ (gorev
                    geregi). Platform'daki ModuleFormModal.tsx'in GERCEK
                    Sil butonuyla BIREBIR AYNI: antd `danger` prop'u
                    (dinlenmede kirmizi border + kirmizi ikon, seffaf
                    zemin -- custom SVG/renk UYDURULMADI), boyut antd'nin
                    kendi icon-only buton olcusunden gelir (Kaydet ile
                    AYNI varsayilan yukseklik). Hover'da zemin dolar/ikon
                    beyaza doner, active'te bir kademe daha koyulasir --
                    bkz. index.css `.iqv-platform-modal-delete-btn`
                    (Dictionary'nin kendi Vazgec/Guncelle butonlariyla
                    AYNI kapsamsiz desen). Kirmizinin GERCEK kaynagi
                    tema tokeni `token.colorError`dir, CSS degiskeni
                    olarak bilesende verilir. */}
                {selectedDictionaryId && canDeleteSettings && (
                  <Button
                    danger
                    className="iqv-platform-modal-delete-btn"
                    style={
                      { '--iqv-btn-danger': token.colorError } as CSSProperties
                    }
                    icon={<DeleteOutlined />}
                    loading={deleting}
                    onClick={requestDeleteDictionaryItem}
                    aria-label="Seçili sözlük terimini sil"
                  />
                )}
                {/* IQV Platform'un GERÇEK "Personeli Güncelle" submit
                    butonuyla (PersonnelFormModal.tsx) AYNI component
                    mantığı: antd `Button` (type="default") + Platform'un
                    mevcut mavi aksiyon rengi (bkz. src/index.css
                    `.iqv-platform-modal-submit-btn`) + paylaşılan
                    `SAVE_BUTTON_STYLE` ölçüsü. htmlType/loading/disabled ve
                    submit davranışı DEĞİŞMEDİ. */}
                <Button
                  htmlType="submit"
                  type="default"
                  className="iqv-platform-modal-submit-btn"
                  loading={submitting}
                  disabled={!canUpdateSettings}
                  style={SAVE_BUTTON_STYLE}
                >
                  Kaydet
                </Button>
              </div>
            </Form>
          </div>
        </Card>
      </Card>
    </BasePageContainer>
  );
};

export default Settings;
