import { Button, Col, Form, Modal, Row, theme } from 'antd';
import type { Rule } from 'antd/es/form';
import {
  Checkbox,
  Combobox as IqvCombobox,
  Input as IqvInput,
  IqvizyonProvider,
  Label,
  Select as IqvSelect,
  Switch as IqvSwitch,
  makeStyles,
  useId,
} from '@iqvizyonui/react-components';
import type { SwitchOnChangeData } from '@iqvizyonui/react-components';
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  Person,
  PersonCreateInput,
  PersonUpdateInput,
} from '../../interfaces/models/person';
import { peopleApi } from '../../services/peopleApi';
import useBreakpoint from '../hooks/breakpoint';
import { isAdminTierRole } from '../../utils/permissions';
import {
  NotificationType,
  PAGE_CARD_RADIUS,
  SAVE_BUTTON_STYLE,
  handleErrorResponse,
  showNotification,
} from '../../utils';

// KULLANICI ADI / ŞİFRE / AD SOYAD / E-POSTA / TELEFON / TELEGRAM ID --
// IQV Platform'un GERÇEK PersonnelFormModal.tsx bileşeninde (Platform
// Frontend/dashboard/src/components/settings/PersonnelFormModal.tsx)
// bu 6 alan `Form.Item`in KENDİ `label` prop'u ile DEĞİL, IQV `Label` +
// `Input` ikilisiyle çizilir (aşağıdaki `useFieldStyles`/`FIELD_LABEL_INSET`
// Platform'daki dosyayla BİREBİR aynı ölçü: IQV Input root border (1px) +
// input slot padding (spacingHorizontalM = 12px) = 13px). Şifre alanında
// Platform'un GERÇEK kodunda (ve projenin BAŞKA hiçbir yerinde) bir göz/
// görünürlük ikonu YOKTUR -- IQV `Input` bileşeni böyle bir slot/state
// sunmaz; bu yüzden burada da antd `Input.Password` DEĞİL, düz IQV
// `Input` (type="password") kullanılır.
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

// "Yetkileri Düzenle" popup'ındaki DÜZ satır deseni -- IQV Platform'un
// GERÇEK referans bileşeninden (Platform Frontend/dashboard/src/components/
// settings/PlatformPermissionsModal.tsx, `pageAccessRow`/`pageAccessLabel`)
// BİREBİR aynı değerlerle taşınmıştır (Notlar/Ayarlar satırlarıyla aynı
// desen: satır kendi `<label>` kapsayıcısıdır, etiket SOLDA, checkbox
// SAĞDA, `justify-content: space-between` ile dağıtılır -- IQV/Fluent
// Checkbox kök elemanının `max-width: fit-content` taşımasından kaynaklanan
// sağ boşluk sorunu bu yüzden CSS yamasıyla değil, dışarıda kurulan
// düzenle çözülür). Platform'un manuel `borderBottom` divider'ı BİLEREK
// KULLANILMAZ -- Platform'un gerçek Notlar/Ayarlar satırları arasında da
// divider YOKTUR, yalnızca hover vurgusu vardır.
const usePermissionRowStyles = makeStyles({
  pageAccessRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: '12px',
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '36px',
    paddingBlock: '4px',
    paddingInline: '16px',
    borderRadius: '4px',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'var(--colorNeutralBackground1Hover)',
    },
  },
  pageAccessLabel: {
    minWidth: '0',
    fontWeight: '600',
    fontSize: '14px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

// ---------------------------------------------------------------------------
// "Personeli Güncelle" -- IQV Platform'un GERCEK referans bileseninden
// (Platform Frontend/dashboard/src/components/settings/PersonnelFormModal.tsx)
// birebir taninan tasarim: 720px genislik, 2 kolonlu (Row/Col xs=24 md=12)
// alan yerlesimi, ayni footer buton metinleri (Vazgec / Guncelle). Alan
// SIRASI: Kullanici Adi+Sifre / Ad Soyad+E-posta / Telefon+Telegram ID /
// Firma+Rol / Erisim ve Yetkiler+Durum -- son satirdaki Erisim ve
// Yetkiler <-> Durum sirasi kullanici istegiyle SONRADAN degistirildi
// (Platform'daki orijinal Durum+Erisim ve Yetkiler sirasindan farklidir).
//
// "Erisim ve Yetkiler" Platform'da Select DEGIL, uzerinde nested bir modal
// acan bir tetikleyici alandir (PlatformPermissionsModal). Nested modal
// ("Yetkileri Düzenle") backend/src/middleware/auth.ts'teki GERCEK,
// PermissionKey/ALL_PERMISSIONS ile BIREBIR ayni 3 bolumden olusur: Kisi
// (users.read/create/update/delete), Ayarlar (settings.read/update),
// Dictionary (dictionary.read/create/update/delete). Platform'un UX DESENI
// (tetikleyici + ozet + nested modal, Vazgec/Uygula) korunuyor; ICERIK
// Dictionary'nin GERCEK izin kumesine gore olusturuldu -- Platform'un cok-
// sayfali/cok-platformlu izin ekrani KOPYALANMADI (boyle bir kavram
// Dictionary'de yok).
// ---------------------------------------------------------------------------

// TURN: "Rol" dropdown'ı kullanıcı isteğiyle 2 seçeneğe sadeleştirildi
// (Kullanıcı / Admin) ve sıralama Admin, Kullanıcı olacak şekilde
// BİLİNÇLİ olarak belirlendi. `value`'lar (backend'in beklediği GERÇEK
// role değerleri: 'admin' / 'user') DEĞİŞMEDİ -- yalnızca 'admin'
// değerinin ekranda gösterilen etiketi (önceki "Yönetici") kullanıcının
// açık isteğiyle "Admin" olarak güncellendi. Kaldırılan
// organizationadmin/companyadmin/superadmin seçenekleri backend'de
// GEÇERSİZ hale gelmedi; yalnızca bu formdaki seçim listesinden çıkarıldı.
const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'Kullanıcı' },
];

// "Yetkileri Düzenle" popup'inin 3 bolumu -- backend/src/middleware/
// auth.ts'teki PermissionKey/ALL_PERMISSIONS ile BIREBIR ayni izin
// dizeleri (tek kaynak budur). Baska bir izin adi UYDURULMADI.
interface PermissionOption {
  value: string;
  label: string;
}

interface PermissionSection {
  title: string;
  options: PermissionOption[];
}

// TURN: sıra kesin olarak Dictionary > Ayarlar > Kişi (kullanıcı isteği).
// İzin KEY'leri DEĞİŞMEDİ, yalnızca görüntüleme sırası değişti.
const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    title: 'Dictionary',
    options: [
      { value: 'dictionary.read', label: 'Sözlüğü Görüntüleme' },
      { value: 'dictionary.create', label: 'Sözlüğe Kayıt Ekleme' },
      { value: 'dictionary.update', label: 'Sözlüğü Düzenleme' },
      { value: 'dictionary.delete', label: 'Sözlükten Kayıt Silme' },
    ],
  },
  {
    title: 'Ayarlar',
    options: [
      { value: 'settings.read', label: 'Ayarları Görüntüleme' },
      { value: 'settings.update', label: 'Ayarları Düzenleme' },
    ],
  },
  {
    title: 'Kişi',
    options: [
      { value: 'users.read', label: 'Kişileri Görüntüleme' },
      { value: 'users.create', label: 'Kişi Oluşturma' },
      { value: 'users.update', label: 'Kişi Düzenleme' },
      { value: 'users.delete', label: 'Kişi Silme' },
    ],
  },
];

interface FieldErrorDetail {
  field: string;
  message: string;
}

interface PersonFormValues {
  username: string;
  password?: string;
  full_name: string;
  email: string;
  phone?: string;
  telegram_id?: string;
  company_name?: string;
  role: string;
  status: string;
  permissions: string[];
}

// TURN: "Personel Oluştur" -- Platform'un GERÇEK PersonnelFormModal.tsx
// deseniyle BİREBİR aynı: TEK bileşen, `mode` prop'uyla ayrışan iki mod.
// `record` create'te `null`dur; `mode` parent'ta AÇIKÇA tutulur (Platform'un
// `personFormMode` state'iyle aynı yaklaşım) -- `record`'un null olmasından
// DOLAYLI olarak çıkarılmaz.
export interface PersonEditModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  record: Person | null;
  onClose: () => void;
  onSuccess: (person: Person) => void;
}

const PersonEditModal = ({
  open,
  mode,
  record,
  onClose,
  onSuccess,
}: PersonEditModalProps) => {
  const isEdit = mode === 'edit';
  const admin = useSelector((state: RootState) => state.admin);
  // KOK NEDEN / BU TURUN EKLEDIGI KURAL: kendi hesabinda yetki yukseltme
  // (self privilege escalation) engeli -- SADECE giris yapan kullanici
  // KENDI kaydini duzenliyorsa (id karsilastirmasi, Ad Soyad/username
  // DEGIL) VE rolu admin-tier DEGILSE (guvenli varsayilan: 'user' ve
  // taninmayan roller) uygulanir. Bu yalnizca bir UI kolayligidir --
  // gercek, sahtelenemez kontrol backend'de (people.service.ts update())
  // zaten var; burasi sadece devtools/API'siz normal kullanimda alanlarin
  // tiklanamaz gorunmesini saglar.
  const isEditingOwnRecord =
    isEdit && !!record && !!admin?.user?._id && admin.user._id === record._id;
  const restrictSelfPrivilegeEscalation =
    isEditingOwnRecord && !isAdminTierRole(admin);
  const { token } = theme.useToken();
  const [form] = Form.useForm<PersonFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);

  // NESTED "Yetkileri Düzenle" modalinin genislik davranisi -- IQV
  // Platform'daki GERCEK PlatformPermissionsModal.tsx ile BIREBIR ayni
  // desen: `isNarrow = useBreakpoint()` (varsayilan esik 768px, projenin
  // paylasilan mobil siniri) ve `width={isNarrow ? '100%' : <masaustu
  // deger>}`. Platform'un DIS modali (PersonnelFormModal, width={720}, bu
  // dosyadaki "Personeli Güncelle/Yeni Personel" modaliyle AYNI) boyle bir
  // ozel override TASIMAZ -- cunku antd'nin KENDI Modal CSS'i zaten
  // `@media (max-width: 767.98px)` altinda `max-width: calc(100vw - 16px)`
  // uygular (node_modules/antd/es/modal/style/index.js, dogrulandi); bu
  // yuzden DIS modal BURADA DEGISTIRILMEDI. NESTED izin modali ise
  // Platform'da BILINCLI olarak bu varsayilanin USTUNE '%100' zorlar --
  // Dictionary'nin nested modali (asagida, width={480}) ayni ozel
  // override'dan YOKSUNDU; bu TURN'de eklenir.
  const isMobile = useBreakpoint();

  // Platform'daki PersonnelFormModal.tsx ile BİREBİR aynı: griffel
  // `useFieldStyles` + `useId` (etiket-girdi bağlantısı).
  const fieldStyles = useFieldStyles();
  const permissionRowStyles = usePermissionRowStyles();
  const usernameFieldId = useId('person-username');
  const passwordFieldId = useId('person-password');
  const fullNameFieldId = useId('person-fullname');
  const emailFieldId = useId('person-email');
  const phoneFieldId = useId('person-phone');
  const telegramFieldId = useId('person-telegram');
  const companyFieldId = useId('person-company');
  const roleFieldId = useId('person-role');
  const platformPermsFieldId = useId('person-platform-permissions');

  // Platform'daki `textField` yardımcısıyla AYNI desen (IQV `Label` +
  // `Form.Item` [kendi `label`'ı OLMADAN] + IQV `Input`). Tek fark:
  // Dictionary'nin MEVCUT `rules`/`maxLength` değerleri (validation
  // kuralları DEĞİŞMEDEN) buradan geçirilir; `required` ise yalnızca
  // antd'nin varsayılan Form.Item-label kırmızı yıldızının yerini IQV
  // `Label`in KENDİ `required` slotuyla (react-label paketi) almasi
  // için -- GÖRÜNÜM aynı kalsın diye -- açıkça verilir.
  const iqvField = (
    id: string,
    name: keyof PersonFormValues,
    label: string,
    options: {
      rules?: Rule[];
      placeholder?: string;
      type?: 'text' | 'password' | 'email';
      autoComplete?: string;
      maxLength?: number;
      required?: boolean;
    } = {},
  ) => (
    <div className={fieldStyles.field}>
      <Label
        htmlFor={id}
        className={fieldStyles.label}
        required={options.required}
      >
        {label}
      </Label>
      {/* `Form.Item` KENDİ `label` prop'unu KULLANMAZ -- yukarıdaki IQV
          `Label` ile ÇİFT etiket oluşmasın diye (Platform'daki
          PersonnelFormModal.tsx ile BİREBİR aynı desen). */}
      <Form.Item name={name} rules={options.rules}>
        <IqvInput
          id={id}
          type={options.type ?? 'text'}
          autoComplete={options.autoComplete}
          placeholder={options.placeholder}
          maxLength={options.maxLength}
          className={fieldStyles.control}
          input={{ className: fieldStyles.controlInput }}
        />
      </Form.Item>
    </div>
  );
  // Yetkiler AYRI bir React state olarak degil, formun KENDI alani olarak
  // tutulur (gizli, Form.Item render etmeyen bir "permissions" degeri) --
  // boylece acilis senkronizasyonu TEK bir `form.setFieldsValue` cagrisiyla
  // yapilir, ayri bir setState+effect kombinasyonu GEREKMEZ
  // (react-hooks/set-state-in-effect kuraliyla celismez).
  //
  // KOK NEDEN DUZELTMESI: `Form.useWatch`, Form `initialValues` ile
  // SEED edilen bir alanin degerini ILK mount'ta YANSITMIYOR (yalnizca
  // GERCEK bir degisiklikten SONRA guncelleniyor) -- bu yuzden popup
  // acildiginda "Erisim ve Yetkiler" hep bos gorunuyordu. Duzeltme:
  // `watchedPermissions` henuz tanimsizken (ilk acilis), dogrudan
  // `record.permissions`'a (user_dictionary.permissions'tan gelen GERCEK
  // veri) DUS -- `Uygula`'dan SONRA ise watchedPermissions zaten GERCEK
  // bir degisiklikle guncellendigi icin onu kullan.
  const watchedPermissions = Form.useWatch('permissions', form);
  const permissions = useMemo(
    () => watchedPermissions ?? record?.permissions ?? [],
    [watchedPermissions, record],
  );

  // KOK NEDEN DUZELTMESI: onceki surumde form degerleri bir
  // `useEffect(() => form.setFieldsValue(...), [open, record])` ile
  // IMPERATIF olarak yaziliyordu. `Modal`'daki `destroyOnClose` ile
  // birlikte bu, Form'un ic kayit/mount zamanlamasina bagimli kaliyordu
  // ve pratikte kayit acildiginda TUM alanlar BOS geliyordu (kullanicinin
  // bildirdigi hata). Cozum: `initialValues`'i HER render'da `record`'dan
  // dogrudan hesapla, ve `<Form>`'a `key={record?._id ?? 'new'}` ver --
  // boylece FARKLI bir kisi duzenlenmek istendiginde (veya modal yeniden
  // acildiginda) React, Form'u SIFIRDAN, doğru `initialValues` ile
  // MONTE eder. Imperatif setFieldsValue/useEffect'e artik GEREK YOK.
  // "Yeni Personel" (create) -- Platform'un GERÇEK EMPTY_PERSONNEL_FORM
  // varsayılanlarıyla BİREBİR aynı: role 'user', status 'active', hiçbir
  // yetki seçili değil (güvenli varsayılan). Backend de aynı varsayılanı
  // uygular (bkz. people.validation.ts validatePeopleCreatePayload) --
  // burada TEKRAR edilmesinin nedeni yalnızca Select/Switch'in boş/tanımsız
  // açılmaması (kullanıcı deneyimi), gerçek kaynak yine backend'dir.
  const CREATE_DEFAULT_VALUES: PersonFormValues = {
    username: '',
    password: '',
    full_name: '',
    email: '',
    phone: '',
    telegram_id: '',
    company_name: '',
    role: 'user',
    status: 'active',
    permissions: [],
  };

  const initialValues: PersonFormValues = record
    ? {
        username: record.username,
        password: '',
        full_name: record.full_name ?? '',
        email: record.email ?? '',
        phone: record.phone ?? '',
        telegram_id: record.telegram_id ?? '',
        company_name: record.company_name ?? '',
        role: record.role ?? 'user',
        status:
          record.status === 'passive' || record.status === 'inactive'
            ? 'passive'
            : 'active',
        permissions: record.permissions ?? [],
      }
    : CREATE_DEFAULT_VALUES;

  // IQV Switch'in `label` slotuna "Aktif"/"Pasif" metnini REAKTIF olarak
  // baglamak icin -- `watchedPermissions` ile AYNI, dosyanin kendi
  // `Form.useWatch` deseni (yukarida birkac satir once). Ilk acilista
  // (henuz gercek bir degisiklik olmamisken) `initialValues.status`e
  // duser -- bu deger zaten yukarida record'tan dogru sekilde normalize
  // edilmis ('passive'/'inactive' -> 'passive', aksi halde 'active').
  const watchedStatus = Form.useWatch('status', form);
  const isStatusActive = (watchedStatus ?? initialValues.status) === 'active';

  // Kullanıcı isteği: tetikleyici alanda ARTIK seçili yetki sayısı/durumu
  // GÖSTERİLMEZ -- metin her zaman sabit "Yetki seçin"dir (0/3/8 fark
  // etmez). Gerçek seçim durumu `permissions`/`draftPermissions`
  // state'inde ve nested "Yetkileri Düzenle" modalındaki checkbox'larda
  // aynen kalır; bu yalnızca bu metnin GÖRÜNÜMÜdür.
  const permissionSummary = 'Yetki seçin';

  const openPermissionsPopup = () => {
    // Belt-and-suspenders: Buton zaten `disabled` render edilir (asagida),
    // ama bu erken donus, herhangi bir sekilde (orn. programatik tetikleme)
    // cagrilma ihtimaline karsi nested "Yetkileri Duzenle" modalinin KENDI
    // kaydinda yetki yukseltmeye izin veren bir yol acmadigini garanti eder.
    if (restrictSelfPrivilegeEscalation) return;
    setDraftPermissions(permissions);
    setPermissionsOpen(true);
  };

  const cancelPermissionsPopup = () => {
    // Platform'daki nested modal deseniyle AYNI: "Vazgeç" yalnızca taslağı
    // atar, ana formun state'ine (permissions) HİÇBİR ŞEY yazmaz.
    setPermissionsOpen(false);
  };

  const applyPermissionsPopup = () => {
    form.setFieldValue('permissions', draftPermissions);
    setPermissionsOpen(false);
  };

  const handleCancel = () => {
    if (submitting) return;
    form.resetFields();
    onClose();
  };

  const handleSubmit = async () => {
    if (isEdit && !record) return;

    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (!isEdit) {
        // "Personel Oluştur" -- Platform'un GERÇEK create semantiğiyle
        // BİREBİR aynı: Şifre burada ZORUNLU (aşağıdaki `iqvField` rule'u
        // zaten `form.validateFields()`te bunu garanti eder), payload'a
        // HER ZAMAN konur (edit'teki "boşsa gönderme" istisnası YOKTUR --
        // o istisna yalnızca "mevcut parolayı koru" edit senaryosu içindir).
        const createPayload: PersonCreateInput = {
          username: values.username.trim(),
          password: (values.password ?? '').trim(),
          full_name: values.full_name.trim(),
          email: values.email.trim(),
          phone: values.phone?.trim() || null,
          telegram_id: values.telegram_id?.trim() || null,
          company_name: values.company_name?.trim() || '',
          role: values.role,
          status: values.status,
          permissions: values.permissions ?? [],
        };

        const response = await peopleApi.create(createPayload);
        showNotification(
          'Başarılı',
          NotificationType.SUCCESS,
          'Kullanıcı başarıyla oluşturuldu.',
        );

        form.resetFields();
        onSuccess(response.data);
        onClose();
        return;
      }

      if (!record) return;

      const payload: PersonUpdateInput = {
        username: values.username.trim(),
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        phone: values.phone?.trim() || null,
        telegram_id: values.telegram_id?.trim() || null,
        company_name: values.company_name?.trim() || '',
        // KOK NEDEN / BU TURUN EKLEDIGI KURAL: kendi hesabinda yetki
        // yukseltme engeli -- kisitlama gecerliyse role/status/permissions
        // payload'a HIC KONULMAZ (validatePeopleUpdatePayload'da alan
        // gonderilmezse "degistirme" anlamina gelir). Bu SADECE bir
        // kolayliktir (payload filtreleme) -- TEK guvenlik onlemi DEGILDIR;
        // gercek, sahtelenemez kontrol backend'de (people.service.ts
        // update()) zaten var ve DevTools/dogrudan API cagrisina karsi da
        // gecerlidir.
        ...(restrictSelfPrivilegeEscalation
          ? {}
          : {
              role: values.role,
              status: values.status,
              permissions: values.permissions ?? [],
            }),
      };

      // Platform'un GERCEK semantigiyle BIREBIR ayni: Sifre alani BOS
      // birakildiysa payload'a HIC KONULMAZ (backend mevcut hash'i korur).
      // Sadece kullanici GERCEKTEN bir sey yazdiysa gonderilir.
      const trimmedPassword = values.password?.trim();
      if (trimmedPassword) {
        payload.password = trimmedPassword;
      }

      const response = await peopleApi.update(record._id, payload);
      showNotification(
        'Başarılı',
        NotificationType.SUCCESS,
        'Kullanıcı başarıyla güncellendi.',
      );

      form.resetFields();
      onSuccess(response.data);
      onClose();
    } catch (error) {
      // Antd form validation rejects with { errorFields }, not an API error.
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }

      const fieldErrors = (
        error as { response?: { data?: { errors?: FieldErrorDetail[] } } }
      )?.response?.data?.errors;

      if (Array.isArray(fieldErrors)) {
        form.setFields(
          fieldErrors.map((fieldError) => ({
            // QA TURU / build FIX: DictionaryFormModal.tsx'teki AYNI
            // build-kirici tip uyusmazligi (tsc: TS2345) -- backend'in
            // dondugu `field` degeri GERCEKTEN bu formun alan adlarindan
            // biridir (people.validation.ts), bu yuzden minimal bir tip
            // donusumu yeterlidir; calisma zamani davranisi DEGISMEZ.
            name: fieldError.field as keyof PersonFormValues,
            errors: [fieldError.message],
          })),
        );
      }

      handleErrorResponse(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        // Buton durum kuralları için kapsam sınıfı (bkz. src/index.css) --
        // Platform'un GERÇEK "Personeli Güncelle" modaliyla (PersonnelFormModal.tsx)
        // AYNI görünüm standardı.
        className="iqv-platform-modal"
        title={isEdit ? 'Personeli Güncelle' : 'Yeni Personel'}
        open={open}
        onCancel={handleCancel}
        maskClosable={false}
        destroyOnClose
        width={720}
        footer={
          <div className="flex items-center justify-end">
            <span className="flex gap-2">
              <Button
                className="iqv-platform-modal-cancel-btn"
                disabled={submitting}
                onClick={handleCancel}
              >
                Vazgeç
              </Button>
              <Button
                type="default"
                className="iqv-platform-modal-submit-btn"
                style={SAVE_BUTTON_STYLE}
                loading={submitting}
                onClick={handleSubmit}
              >
                {isEdit ? 'Güncelle' : 'Kaydet'}
              </Button>
            </span>
          </div>
        }
      >
        <IqvizyonProvider style={{ display: 'contents' }}>
          {/* Modal içeriği `document.body` altına PORTAL'lanır; IQV tema
            değişkenleri sağlayıcının KENDİ sınıfı üzerinden DOM ile miras
            alındığı için portal alt ağacında ikinci bir sağlayıcı gerekir
            (Platform'daki PersonnelFormModal.tsx ile BİREBİR aynı çözüm:
            "theme" prop'u BİLEREK verilmez -> üst temayı aynen devralır). */}
          <Form
            key={record?._id ?? 'new'}
            form={form}
            layout="vertical"
            preserve={false}
            initialValues={initialValues}
          >
            {/* Gizli alan: "Erişim ve Yetkiler" değeri burada, forma bağlı
              olarak tutulur; kullanıcıya ayrı bir kontrol olarak
              gösterilmez (aşağıdaki tetikleyici buton onun yerine geçer). */}
            <Form.Item name="permissions" hidden>
              <input type="hidden" />
            </Form.Item>
            <Row gutter={[32, 0]}>
              <Col xs={24} md={12}>
                {iqvField(usernameFieldId, 'username', 'Kullanıcı Adı', {
                  autoComplete: 'off',
                  maxLength: 100,
                  required: true,
                  rules: [
                    { required: true, message: 'Kullanıcı adı zorunludur.' },
                  ],
                })}
              </Col>
              <Col xs={24} md={12}>
                {/* Platform'un GERÇEK kuralı: CREATE'te ZORUNLU (minimum
                  karakter sayısı kuralı YOKTUR -- tek karakter de geçerli);
                  EDIT'te alan HER ZAMAN boş açılır, boş bırakılırsa
                  "değiştirme" anlamına gelir (zorunlu DEĞİL). */}
                {iqvField(passwordFieldId, 'password', 'Şifre', {
                  type: 'password',
                  autoComplete: 'new-password',
                  placeholder: isEdit
                    ? 'Değiştirmek istemiyorsanız boş bırakın'
                    : 'Şifrenizi girin',
                  required: !isEdit,
                  rules: isEdit
                    ? undefined
                    : [{ required: true, message: 'Şifre zorunludur.' }],
                })}
              </Col>

              <Col xs={24} md={12}>
                {iqvField(fullNameFieldId, 'full_name', 'Ad Soyad', {
                  maxLength: 200,
                  required: true,
                  rules: [{ required: true, message: 'Ad Soyad zorunludur.' }],
                })}
              </Col>
              <Col xs={24} md={12}>
                {iqvField(emailFieldId, 'email', 'E-posta', {
                  type: 'email',
                  maxLength: 200,
                  required: true,
                  rules: [
                    { required: true, message: 'E-posta zorunludur.' },
                    {
                      type: 'email',
                      message: 'Geçerli bir e-posta adresi giriniz.',
                    },
                  ],
                })}
              </Col>

              <Col xs={24} md={12}>
                {iqvField(phoneFieldId, 'phone', 'Telefon', {
                  maxLength: 30,
                  placeholder: 'Örn. 5550000000',
                })}
              </Col>
              <Col xs={24} md={12}>
                {iqvField(telegramFieldId, 'telegram_id', 'Telegram ID', {
                  maxLength: 64,
                  placeholder: 'Örn. 123456789',
                })}
              </Col>

              <Col xs={24} md={12}>
                {iqvField(companyFieldId, 'company_name', 'Firma', {
                  maxLength: 200,
                  placeholder: 'Örn. IQ Vizyon',
                })}
              </Col>
              <Col xs={24} md={12}>
                <div className={fieldStyles.field}>
                  <Label htmlFor={roleFieldId} className={fieldStyles.label}>
                    Rol
                  </Label>
                  {/* Platform'daki PersonnelFormModal.tsx ile BİREBİR aynı
                      desen: IQV Select imzası onChange(event, data) ->
                      data.value şeklindedir; `Form.Item` value/onChange
                      enjekte eder, native <select> olduğu için varsayılan
                      `getValueFromEvent` (event.target.value) DOĞRU çalışır.
                      Option değerleri/etiketleri Dictionary'nin KENDİ
                      `ROLE_OPTIONS`'ından (backend'in beklediği role
                      değerleri DEĞİŞMEDEN) üretilir. */}
                  <Form.Item
                    name="role"
                    rules={[{ required: true, message: 'Rol zorunludur.' }]}
                  >
                    <IqvSelect
                      id={roleFieldId}
                      className={fieldStyles.control}
                      disabled={restrictSelfPrivilegeEscalation}
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </IqvSelect>
                  </Form.Item>
                </div>
              </Col>

              <Col xs={24} md={12}>
                {/* Platform'daki GERÇEK PersonnelFormModal.tsx tetikleyici
                    alanıyla BİREBİR aynı desen: `Form.Item`in KENDİ `label`
                    prop'u DEĞİL, IQV `Label` + `div.field` sarmalayıcı (diğer
                    tüm alanlarla -- iqvField -- AYNI kalıp). Tetikleyicinin
                    kendisi artık gerçek bir IQVizyon UI bileşeni (`Combobox`)
                    -- alan genişliği/hizası `fieldStyles.control` ile diğer
                    tüm alanlarla AYNI kalır. */}
                <div className={fieldStyles.field}>
                  <Label
                    htmlFor={platformPermsFieldId}
                    className={fieldStyles.label}
                  >
                    Erişim ve Yetkiler
                  </Label>
                  {/* Gerçek IQVizyon UI `Combobox` bileşeni
                      (`@iqvizyonui/react-components`) -- manuel CSS ile
                      select taklidi yapan eski antd `Button` KULLANILMADI.
                      Bu alanın gerçek etkileşimi (tek değerli native
                      seçim değil) "Yetkileri Düzenle" popup'ını açmaktır;
                      bu yüzden IQV `Select` (native <select>, "Rol"
                      alanında olduğu gibi) yerine, IQV'nin kendi
                      kontrollü-açılır-pencere API'sini (`open`) destekleyen
                      `Combobox`u DAİMA KAPALI (`open={false}`) ve
                      salt-okunur (`readOnly`) bir tetikleyici olarak
                      kullanıyoruz: kendi iç listbox'ı hiç açılmaz, yalnızca
                      doğrudan `onClick` (tek gerçek tetikleyici) AYNEN
                      eskisi gibi `openPermissionsPopup`'a yönlendirilir.
                      BİLİNÇLİ OLARAK `onOpenChange` KULLANILMIYOR: Combobox
                      bunu blur/focus kaynaklı her iç açık/kapalı durum
                      denemesinde de tetikler (ör. popup kapanıp odak bu
                      alana/yakınına döndükten sonra kullanıcı başka bir
                      alana -- Rol, başka bir input -- tıklayınca oluşan
                      blur) -- yön (`data.open`) kontrol edilmeden
                      `openPermissionsPopup` çağrılırsa popup istenmeden
                      tekrar açılır. Metin
                      (`permissionSummary`), `permissions` state'i,
                      `applyPermissionsPopup`/`cancelPermissionsPopup` ve
                      backend'e giden `permissions` alanı BİREBİR
                      korunmuştur -- yalnızca görsel/DOM bileşeni
                      değişmiştir. Açılır ok ikonu artık Combobox'ın
                      KENDİ `expandIcon` slotundan gelir (manuel ikon
                      YOK). */}
                  <IqvCombobox
                    id={platformPermsFieldId}
                    className={fieldStyles.control}
                    value={permissionSummary}
                    placeholder="Yetki seçin"
                    readOnly
                    open={false}
                    onClick={openPermissionsPopup}
                    disabled={restrictSelfPrivilegeEscalation}
                  />
                </div>
              </Col>
              <Col xs={24} md={12}>
                {/* Gerçek IQVizyon UI `Switch` bileşeni
                    (`@iqvizyonui/react-components`) -- antd Switch,
                    Checkbox veya custom CSS switch KULLANILMADI.
                    Form.Item'ın KENDİ `label` prop'u ("Durum") KORUNDU;
                    Switch'in KENDİ `label` slotu ise Durum state'ine göre
                    REAKTİF "Aktif"/"Pasif" metnini gösterir (demo'daki
                    sabit "This is a switch" metni KULLANILMADI). Backend
                    sözleşmesi DEĞİŞMEDİ: form alanı hâlâ STRING
                    ('active'/'passive'). IQV Switch'in gerçek onChange
                    imzası (`node_modules/@iqvizyonui/react-switch/dist/
                    index.d.ts`) antd'den FARKLI: `(ev, data:
                    SwitchOnChangeData) => void` -- ilk parametre artık
                    `checked` boolean'ı DEĞİL, ham change event'i; asıl
                    boolean `data.checked`'ta. `getValueFromEvent` bu
                    yüzden ikinci parametreyi okuyacak şekilde YENİDEN
                    yazıldı (eski antd imzası `(checked: boolean) => ...`
                    burada KOPYALANAMAZDI). `valuePropName="checked"` +
                    `getValueProps` değişmedi: Form.Item, IQV Switch'e de
                    `checked` prop'unu (controlled, IQV Switch'in kendi
                    `checked?: boolean` prop'u) aynı şekilde enjekte eder.
                    `disabled={restrictSelfPrivilegeEscalation}` (kendi
                    hesabını düzenleyen admin-olmayan kullanıcı için
                    değiştirilemez Durum kuralı) DEĞİŞMEDİ -- IQV Switch'te
                    de native `<input>` `disabled` attribute'u olarak
                    aynı şekilde çalışır. Artık antd'ye özel bir renk/
                    track-yüksekliği override'ına (eski `ConfigProvider` +
                    ERP sabitleri) GEREK YOK -- IQV Switch kendi
                    (Griffel/Fluent tabanlı) tasarım tokenlarını kullanır. */}
                <Form.Item
                  name="status"
                  label="Durum"
                  valuePropName="checked"
                  getValueProps={(value) => ({ checked: value === 'active' })}
                  getValueFromEvent={(
                    _ev: unknown,
                    data: SwitchOnChangeData,
                  ) => (data.checked ? 'active' : 'passive')}
                  rules={[{ required: true, message: 'Durum zorunludur.' }]}
                >
                  <IqvSwitch
                    label={isStatusActive ? 'Aktif' : 'Pasif'}
                    disabled={restrictSelfPrivilegeEscalation}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </IqvizyonProvider>
      </Modal>

      {/* NESTED MODAL: personel modalinin UZERINDE acilir (antd varsayilan
          z-index yigilmasi, ikinci Modal montajinda otomatik yukselir).
          "Vazgeç" yalnizca taslağı atar, ana formun state'ini DEĞİŞTİRMEZ;
          "Uygula" seçimleri ana forma taşır, backend'e HİÇBİR istek
          ATMAZ (bkz. Platform'daki PlatformPermissionsModal ile AYNI UX
          sözleşmesi). */}
      <Modal
        className="iqv-platform-modal"
        title={<span style={{ color: '#808080' }}>Yetkileri Düzenle</span>}
        open={permissionsOpen}
        onCancel={cancelPermissionsPopup}
        maskClosable={false}
        destroyOnClose
        // Platform'daki PlatformPermissionsModal.tsx ile BIREBIR ayni
        // desen (`width={isNarrow ? '100%' : 640}`) -- Dictionary'nin
        // kendi masaustu degeri (480) KORUNUR, yalnizca mobilde (<768px)
        // antd'nin varsayilan `calc(100vw - 16px)` daralmasi yerine tam
        // genislik zorlanir (Platform'un GERCEK tercihiyle AYNI).
        width={isMobile ? '100%' : 480}
        zIndex={1100}
        // Platform'daki PlatformPermissionsModal.tsx ile BİREBİR aynı
        // desen: `styles={{ body: { paddingTop: 8 } }}`. Header ARTIK
        // ayrı bir çerçeve/kart İÇİNDE DEĞİL -- yalnızca antd'nin
        // varsayılan modal başlığı olarak üstte durur (kullanıcı isteği:
        // "Header çerçeve içine GİRMEYECEK"). Çerçeve/kart, aşağıda body
        // içinde permission satırlarını VE footer butonlarını birlikte
        // saran TEK bir sarmalayıcı `<div>` ile kurulur (antd `footer`
        // prop'u KULLANILMAZ -- aksi halde footer, body'den ayrı bir DOM
        // kutusu olarak kalır ve TEK bir çerçeve içine alınamaz).
        styles={{ body: { paddingTop: 8 } }}
        // KOK NEDEN: `footer` prop'u HİÇ verilmediğinde antd Modal
        // `undefined`'ı "varsayılan footer'ı kullan" olarak yorumlar ve
        // KENDİ İptal/Tamam butonlarını render eder (bu, aşağıdaki custom
        // Vazgeç/Uygula kartına EK olarak, istenmeyen ikinci bir buton
        // satırı olarak görünüyordu). `footer={null}` bu varsayılan
        // footer'ı tamamen KAPATIR; custom Vazgeç/Uygula butonları zaten
        // body içindeki kartta ayrıca render ediliyor, DEĞİŞMEDİ.
        footer={null}
      >
        {/* Portal alt ağacında IQV tema değişkenleri için ikinci sağlayıcı
            (Platform'daki PlatformPermissionsModal.tsx ile BİREBİR aynı
            çözüm) -- IQV `Checkbox` bileşeni bu sağlayıcı OLMADAN doğru
            temalanmaz. */}
        <IqvizyonProvider style={{ display: 'contents' }}>
          <div style={{ color: token.colorText }}>
            {/* Kullanıcı isteği: header'ın (başlık + X) DIŞINDA, yalnızca
                permission satırlarını VE Vazgeç/Uygula butonlarını saran
                TEK bir framed card. Renk/kalınlık UYDURULMADI: standart
                `token.colorBorderSecondary` (projede zaten kullanılan
                GERÇEK bölücü/kenarlık tokenı) + `PAGE_CARD_RADIUS`
                (Platform'un GERÇEK, projede zaten kullanılan köşe
                yuvarlaklığı sabiti, bkz. utils/index.tsx). antd `footer`
                prop'u yerine butonlar BİLEREK bu kartın İÇİNE, satırların
                altına taşınır -- aksi halde antd footer'ı body'den ayrı
                bir kutu olarak render eder ve tek bir çerçeve içine
                ALINAMAZ. Buton bileşenleri/class'ları/handler'ları
                (Vazgeç/Uygula davranışı) DEĞİŞMEDEN aynen taşınmıştır. */}
            <div
              style={{
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: PAGE_CARD_RADIUS,
                overflow: 'hidden',
              }}
            >
              {/* Her bölüm TEK bir checkbox ile temsil edilir. Checkbox
                  işaretliyse o bölümün backend'deki GERÇEK izin setinin
                  TAMAMI verilir; kaldırılırsa TAMAMI kaldırılır. Ara/kısmi
                  durum "verilmedi" sayılır (en güvenli varsayılan). Satır
                  deseni Platform'daki GERÇEK Notlar/Ayarlar düz satırlarıyla
                  (pageAccessRow/pageAccessLabel) BİREBİR aynı: satır kendi
                  `<label>` kapsayıcısıdır (tüm satır tıklanabilir), IQV
                  `Checkbox` kullanılır (raw `<input type="checkbox">` veya
                  antd Checkbox DEĞİL). */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '8px 8px 0',
                }}
              >
                {PERMISSION_SECTIONS.map((section) => {
                  const groupValues = section.options.map(
                    (option) => option.value,
                  );
                  const hasAll = groupValues.every((value) =>
                    draftPermissions.includes(value),
                  );
                  const inputId = `person-permission-${
                    groupValues[0]?.split('.')[0] ?? section.title
                  }`;

                  const toggleGroup = (checked: boolean) => {
                    const withoutGroup = draftPermissions.filter(
                      (value) => !groupValues.includes(value),
                    );
                    setDraftPermissions(
                      checked
                        ? [...withoutGroup, ...groupValues]
                        : withoutGroup,
                    );
                  };

                  return (
                    <label
                      key={section.title}
                      className={permissionRowStyles.pageAccessRow}
                      htmlFor={inputId}
                    >
                      <span className={permissionRowStyles.pageAccessLabel}>
                        {section.title}
                      </span>
                      <Checkbox
                        id={inputId}
                        checked={hasAll}
                        onChange={(_event, data) =>
                          toggleGroup(data.checked === true)
                        }
                      />
                    </label>
                  );
                })}
              </div>

              {/* Footer: Platform'daki PlatformPermissionsModal.tsx
                  footer'ıyla BİREBİR aynı buton bileşenleri/class'ları
                  (`.iqv-platform-modal-cancel-btn` / `-submit-btn`, bkz.
                  index.css), Uygula `type="default"` + `SAVE_BUTTON_STYLE`
                  (antd `type="primary"` DEĞİL). Yalnızca konumu değişti:
                  antd `footer` prop'u yerine bu kartın içine, satırların
                  altına taşındı. */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 8,
                  padding: `${token.paddingSM}px ${token.paddingMD}px`,
                }}
              >
                <Button
                  className="iqv-platform-modal-cancel-btn"
                  onClick={cancelPermissionsPopup}
                >
                  Vazgeç
                </Button>
                <Button
                  type="default"
                  className="iqv-platform-modal-submit-btn"
                  style={SAVE_BUTTON_STYLE}
                  onClick={applyPermissionsPopup}
                >
                  Uygula
                </Button>
              </div>
            </div>
          </div>
        </IqvizyonProvider>
      </Modal>
    </>
  );
};

export default PersonEditModal;
