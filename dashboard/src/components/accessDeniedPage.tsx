import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

// `errorPage.tsx` (antd `Result status="500"`) ile AYNI kurulmuş desen --
// yeni bir tasarım sistemi/bileşen UYDURULMADI, sadece antd `Result`in
// kendi "403" durumu kullanıldı. Sabit bir "izinli" route'a
// YÖNLENDİRİLMEZ (bu kullanıcı için hangi route'un izinli olduğu burada
// bilinmez) -- bunun yerine kullanıcıyı zaten erişebildiği önceki sayfaya
// (`navigate(-1)`) geri götürür.
const AccessDeniedPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center h-screen">
      <Result
        status="403"
        title="403"
        subTitle="Bu sayfayı görüntülemek için yetkiniz yok."
        extra={
          <Button type="primary" onClick={() => navigate(-1)}>
            Geri dön
          </Button>
        }
      />
    </div>
  );
};

export default AccessDeniedPage;
