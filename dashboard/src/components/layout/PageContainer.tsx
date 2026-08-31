import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Spin } from 'antd';
import Loader from '../loader';
import { PAGE_CARD_RADIUS } from '../../constants';

export interface BasePageContainerProps {
  title?: string;
  subTitle?: string;
  extra?: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
  transparent?: boolean;
}

const BasePageContainer = (props: BasePageContainerProps) => {
  return (
    <PageContainer
      header={{
        title: props.title,
        // BİREBİR IQV Platform (PageContainer.tsx) deseni: `breadcrumb`
        // anahtarı burada BİLİNÇLİ OLARAK `undefined` verilir (anahtar HİÇ
        // verilmese ProLayout'un kendi RouteContext'i -- geçerli rotayı
        // menüyle eşleştirip ürettiği `breadcrumb.items` -- devreye girer).
        // pro-components'in PageContainer/index.js'indeki gerçek kök neden:
        // `header` objesi PageHeader prop'larının EN SONUNA spread edilir;
        // `title` boş olsa bile bu örtük breadcrumb objesi dolu kalırsa
        // "başlıksız" sayfa header'ı YİNE DE render edilir (yalnızca
        // breadcrumb şeridiyle) ve kendi `paddingBlockStart`'ını (kütüphane
        // varsayılanı, ~40px'in dörtte biri) ProLayout'un
        // `contentStyle.paddingBlockStart: CONTENT_TOP_OFFSET`'inin ÜSTÜNE
        // ekler -- turn 10'daki "değer doğru ama mesafe hâlâ fazla" hatasının
        // GERÇEK kaynağı buydu. `breadcrumb: undefined` anahtarını açıkça
        // vererek bu örtük context değerini geçersiz kılıp sıfırlıyoruz.
        breadcrumb: undefined,
        extra: props.extra,
      }}
      // Sidebar <-> içerik yatay boşluğunun TEK KAYNAĞI artık burada
      // VERİLMEZ -- satır içi stil CSS'i her zaman yendiği için, mobilde
      // sabit `paddingInline: 15` verilseydi aşağıdaki layout.css'teki
      // `.ant-pro-page-container-children-container` kuralı (IQV Platform
      // referansından birebir taşındı: masaüstü 72px / tablet 20px / mobil
      // 8px) ile çakışırdı. IQV Platform'un kendi PageContainer.tsx'i de
      // aynı sebeple bu satır içi override'ı KALDIRMIŞ durumda.
      //
      // DİKEY: bu ortak PageContainer'ın kendi üst boşluğu (kütüphane
      // varsayılanı) burada SIFIRLANIR -- IQV Platform referansındaki
      // BİREBİR aynı desen (`childrenContentStyle={{ paddingBlockStart: 0,
      // marginBlockStart: 0 }}`). Header altı <-> ilk kart üstü mesafesinin
      // TEK KAYNAĞI artık layout/index.tsx'teki `ProLayout`'un
      // `contentStyle={{ paddingBlockStart: CONTENT_TOP_OFFSET }}`'ıdır;
      // burada ikinci bir üst boşluk kalırsa iki kaynak toplanıp mesafe
      // Platform'dan FAZLA çıkardı.
      childrenContentStyle={{ paddingBlockStart: 0, marginBlockStart: 0 }}
      subTitle={props.subTitle}
    >
      <ProCard
        className={`mb-10 ${!props.transparent ? 'shadow-lg' : ''}`}
        size="small"
        style={{ minHeight: 500, borderRadius: PAGE_CARD_RADIUS }}
        ghost={props.transparent}
        loading={
          props.loading ? (
            <Loader text={''} spinner={<Spin size="large" />} />
          ) : (
            false
          )
        }
      >
        {props.children}
      </ProCard>
    </PageContainer>
  );
};

export default BasePageContainer;
