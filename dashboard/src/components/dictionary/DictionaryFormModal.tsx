import { AutoComplete, Form, Input, Modal, Select } from 'antd';
import { useEffect, useState } from 'react';
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
  handleErrorResponse,
  showNotification,
} from '../../utils';

const { TextArea } = Input;

export interface DictionaryFormModalProps {
  open: boolean;
  record?: DictionaryItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FieldErrorDetail {
  field: string;
  message: string;
}

const DictionaryFormModal = ({
  open,
  record,
  onClose,
  onSuccess,
}: DictionaryFormModalProps) => {
  const [form] = Form.useForm<DictionaryFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [subgroupOptions, setSubgroupOptions] = useState<string[]>([]);
  const selectedGroup = Form.useWatch('group', form);
  const isEditMode = Boolean(record);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (record) {
      form.setFieldsValue({
        english_term: record.english_term,
        turkish_term: record.turkish_term,
        description: record.description,
        group: record.group,
        subgroup: record.subgroup ?? '',
      });
    } else {
      form.resetFields();
    }
  }, [open, record, form]);

  useEffect(() => {
    if (!open || selectedGroup !== DICTIONARY_GROUP_INDUSTRIAL) {
      return;
    }

    dictionaryApi
      .subgroups(DICTIONARY_GROUP_INDUSTRIAL)
      .then((res) => setSubgroupOptions(res.data))
      .catch(() => {
        // Non-critical: autocomplete suggestions are a nice-to-have.
        setSubgroupOptions([]);
      });
  }, [open, selectedGroup]);

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload: DictionaryFormValues = {
        ...values,
        subgroup:
          values.group === DICTIONARY_GROUP_IQV_OS_AI
            ? undefined
            : values.subgroup?.trim() || undefined,
      };

      if (isEditMode && record) {
        await dictionaryApi.update(record._id, payload);
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

      form.resetFields();
      onSuccess();
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

  return (
    <Modal
      title={isEditMode ? 'Terimi Düzenle' : 'Yeni Terim Ekle'}
      open={open}
      onCancel={handleCancel}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText={isEditMode ? 'Güncelle' : 'Ekle'}
      cancelText="İptal"
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          name="english_term"
          label="İngilizce Terim"
          rules={[{ required: true, message: 'İngilizce terim zorunludur.' }]}
        >
          <Input maxLength={200} />
        </Form.Item>

        <Form.Item
          name="turkish_term"
          label="Türkçe Karşılığı"
          rules={[{ required: true, message: 'Türkçe karşılık zorunludur.' }]}
        >
          <Input maxLength={200} />
        </Form.Item>

        <Form.Item
          name="group"
          label="Grup"
          rules={[{ required: true, message: 'Grup zorunludur.' }]}
          initialValue={DICTIONARY_GROUP_IQV_OS_AI}
        >
          <Select
            options={DICTIONARY_GROUP_OPTIONS.map((group) => ({
              label: group,
              value: group,
            }))}
          />
        </Form.Item>

        {selectedGroup !== DICTIONARY_GROUP_IQV_OS_AI && (
          <Form.Item name="subgroup" label="Alt Grup">
            <AutoComplete
              options={subgroupOptions.map((option) => ({ value: option }))}
              filterOption={(inputValue, option) =>
                (option?.value ?? '')
                  .toLowerCase()
                  .includes(inputValue.toLowerCase())
              }
              placeholder="Örn. CNC, PLC, Robotik..."
            />
          </Form.Item>
        )}

        <Form.Item
          name="description"
          label="Açıklama / Kullanım Alanı"
          rules={[{ required: true, message: 'Açıklama zorunludur.' }]}
        >
          <TextArea rows={4} maxLength={2000} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default DictionaryFormModal;
