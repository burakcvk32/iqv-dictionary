import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef, useState } from 'react';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import Dictionary from './index';
import adminSlice from '../../store/slices/adminSlice';
import { dictionaryApi } from '../../services/dictionaryApi';

// GERÇEK proje bileşeni (`src/components/dictionary/index.tsx`) test
// ediliyor -- alt grup tıklama mantığı (`INDUSTRIAL_ALT_GRUPLAR.map(...)`
// içindeki `onClick={() => handleSubgroupSelect(activeSubgroup === subgroup
// ? undefined : subgroup)}`) YENİDEN YAZILMADI/simüle EDİLMEDİ; testler
// gerçek DOM'a gerçek tıklama gönderip gerçek state/CSS sonucunu
// doğruluyor. Ağ katmanı (`dictionaryApi`) mock'landı.
//
// `@ant-design/pro-components` (ProTable) VE `@iqvizyonui/react-components`
// (SearchBox) BİLEREK minimal stub'larla mock'landı -- KÖK NEDEN: bu ikisi,
// bu ortamda (Windows'a FUSE köprüsü üzerinden bağlanan, yavaş dosya G/Ç'li)
// çözümlenmesi pratik olmayan çok büyük bağımlılık ağaçlarına sahip.
// SubgroupOptionCard/StatCard/handleCardSelect/handleSubgroupSelect gibi
// GERÇEK, test edilen mantığın hiçbiri bu iki bileşenin İÇİNDE değil --
// mock'lanan ProTable, gerçek `request` prop'unu (dictionaryApi.list'i
// çağıran GERÇEK closure) hâlâ GERÇEKTEN çağırıyor, yalnızca tablo
// render'ının GÖRSEL kısmı stub'lanıyor.
vi.mock('@ant-design/pro-components', () => ({
  ProTable: (props: {
    actionRef?: { current: unknown };
    request?: (params: {
      current: number;
      pageSize: number;
    }) => Promise<unknown>;
  }) => {
    const [, forceRerender] = useState(0);
    const mounted = useRef(false);

    useEffect(() => {
      const runRequest = () => {
        props.request?.({ current: 1, pageSize: 20 });
      };
      if (props.actionRef) {
        (props.actionRef as { current: unknown }).current = {
          reload: () => {
            runRequest();
            forceRerender((n) => n + 1);
          },
          reloadAndRest: () => {
            runRequest();
            forceRerender((n) => n + 1);
          },
        };
      }
      if (!mounted.current) {
        mounted.current = true;
        runRequest();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div data-testid="mock-protable" />;
  },
}));

vi.mock('@iqvizyonui/react-components', () => ({
  SearchBox: (props: {
    value?: string;
    onChange?: (event: unknown, data: { value: string }) => void;
    placeholder?: string;
  }) => (
    <input
      data-testid="mock-searchbox"
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange?.(e, { value: e.target.value })}
    />
  ),
}));

vi.mock('../../services/dictionaryApi', () => ({
  dictionaryApi: {
    list: vi.fn(),
    stats: vi.fn(),
    getById: vi.fn(),
    subgroups: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const mockedDictionaryApi = vi.mocked(dictionaryApi, true);

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

function renderDictionary() {
  const store = configureStore({
    reducer: combineReducers({ admin: adminSlice }),
    preloadedState: {
      admin: {
        token: 'test-token',
        user: {
          _id: 'admin-1',
          username: 'admin.tester',
          role: 'organizationadmin',
          permissions: [
            'dictionary.read',
            'dictionary.create',
            'dictionary.update',
            'dictionary.delete',
          ],
        },
      },
    },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter>
        <Dictionary />
      </MemoryRouter>
    </Provider>,
  );
}

// Bir SubgroupOptionCard'ın "seçili" (active) olup olmadığını, bileşenin
// KENDİ gerçek görsel kararına (bkz. `SubgroupOptionCard` -> `borderColor`/
// `background`, `active || hovered` olduğunda antd `token.colorBorder`
// uygulanır) göre değil -- DOM'da gerçekten var olan `style` özniteliği
// üzerinden, dolaylı ama sahtelenemez bir şekilde kontrol eder.
function isSubgroupCardActive(label: string): boolean {
  const text = screen.getByText(label);
  const card = text.closest('.ant-card') as HTMLElement | null;
  if (!card) throw new Error(`Kart bulunamadı: ${label}`);
  return card.style.borderColor !== '';
}

describe('Dictionary — Endüstriyel alt grup filtre kartları (gerçek render + tıklama)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDictionaryApi.stats.mockResolvedValue({
      success: true,
      data: { total: 100, iqv_os_ai: 40, industrial: 60, subgroups: [] },
    });
    mockedDictionaryApi.list.mockResolvedValue({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('8 alt grubun TAMAMI, "Endüstriyel" ana kart seçilince gerçekten DOM\'a render edilir', async () => {
    const user = userEvent.setup();
    renderDictionary();

    await waitFor(() =>
      expect(mockedDictionaryApi.stats).toHaveBeenCalledTimes(1),
    );

    expect(screen.queryByText('Endüstriyel Alt Gruplar')).toBeNull();

    await user.click(screen.getByText('Endüstriyel'));

    expect(screen.getByText('Endüstriyel Alt Gruplar')).toBeInTheDocument();
    for (const subgroup of INDUSTRIAL_ALT_GRUPLAR) {
      expect(screen.getByText(subgroup)).toBeInTheDocument();
    }
  });

  it('bir alt gruba tıklamak onu seçili yapar (tek tıklama = seçim)', async () => {
    const user = userEvent.setup();
    renderDictionary();
    await waitFor(() =>
      expect(mockedDictionaryApi.stats).toHaveBeenCalledTimes(1),
    );
    await user.click(screen.getByText('Endüstriyel'));

    expect(isSubgroupCardActive('Üretim')).toBe(false);
    await user.click(screen.getByText('Üretim'));
    expect(isSubgroupCardActive('Üretim')).toBe(true);

    await waitFor(() => {
      const lastCall =
        mockedDictionaryApi.list.mock.calls[
          mockedDictionaryApi.list.mock.calls.length - 1
        ];
      expect(lastCall?.[0]).toMatchObject({
        group: 'Endüstriyel',
        subgroup: 'Üretim',
      });
    });
  });

  it('seçili bir alt gruba TEKRAR tıklamak seçimi temizler (toggle-off)', async () => {
    const user = userEvent.setup();
    renderDictionary();
    await waitFor(() =>
      expect(mockedDictionaryApi.stats).toHaveBeenCalledTimes(1),
    );
    await user.click(screen.getByText('Endüstriyel'));

    await user.click(screen.getByText('Bakım'));
    expect(isSubgroupCardActive('Bakım')).toBe(true);

    await user.click(screen.getByText('Bakım'));
    expect(isSubgroupCardActive('Bakım')).toBe(false);

    await waitFor(() => {
      const lastCall =
        mockedDictionaryApi.list.mock.calls[
          mockedDictionaryApi.list.mock.calls.length - 1
        ];
      expect(lastCall?.[0]).toMatchObject({
        group: 'Endüstriyel',
        subgroup: undefined,
      });
    });
  });

  it('bir alt gruptan DOĞRUDAN başka bir alt gruba geçmek, öncekini bırakıp yalnızca yeniyi seçili yapar', async () => {
    const user = userEvent.setup();
    renderDictionary();
    await waitFor(() =>
      expect(mockedDictionaryApi.stats).toHaveBeenCalledTimes(1),
    );
    await user.click(screen.getByText('Endüstriyel'));

    await user.click(screen.getByText('Kalite'));
    expect(isSubgroupCardActive('Kalite')).toBe(true);

    await user.click(screen.getByText('Enerji ve Sürdürülebilirlik'));
    expect(isSubgroupCardActive('Kalite')).toBe(false);
    expect(isSubgroupCardActive('Enerji ve Sürdürülebilirlik')).toBe(true);

    await waitFor(() => {
      const lastCall =
        mockedDictionaryApi.list.mock.calls[
          mockedDictionaryApi.list.mock.calls.length - 1
        ];
      expect(lastCall?.[0]).toMatchObject({
        group: 'Endüstriyel',
        subgroup: 'Enerji ve Sürdürülebilirlik',
      });
    });
  });

  it('ana kart "Toplam"a geri dönmek, seçili alt grubu temizler ve alt grup panelini gizler', async () => {
    const user = userEvent.setup();
    renderDictionary();
    await waitFor(() =>
      expect(mockedDictionaryApi.stats).toHaveBeenCalledTimes(1),
    );
    await user.click(screen.getByText('Endüstriyel'));
    await user.click(screen.getByText('Veri, Yapay Zekâ ve Analitik'));
    expect(isSubgroupCardActive('Veri, Yapay Zekâ ve Analitik')).toBe(true);

    await user.click(screen.getByText('Toplam'));

    expect(screen.queryByText('Endüstriyel Alt Gruplar')).toBeNull();
    await waitFor(() => {
      const lastCall =
        mockedDictionaryApi.list.mock.calls[
          mockedDictionaryApi.list.mock.calls.length - 1
        ];
      expect(lastCall?.[0]).toMatchObject({
        group: undefined,
        subgroup: undefined,
      });
    });
  });
});
