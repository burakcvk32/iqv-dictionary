import { Button, ConfigProvider, Form, Input } from 'antd';
import { Fragment, useEffect, useState } from 'react';
import { apiRoutes } from '../../routes/api';
import { useDispatch, useSelector } from 'react-redux';
import { login } from '../../store/slices/adminSlice';
import { RootState } from '../../store';
import { useLocation, useNavigate } from 'react-router-dom';
import { webRoutes } from '../../routes/web';
import { handleErrorResponse, setPageTitle } from '../../utils';
import { Admin } from '../../interfaces/models/admin';
import { defaultHttp } from '../../utils/http';

// IQV Platform Login referans rengi (Platform Frontend/dashboard'daki
// IQV_ACCENT ile birebir aynı): giriş ekranındaki input odak halkası ve
// "Giriş Yap" butonu bu sabit mavi-gri tonu kullanır — uygulamanın genel
// CONFIG.theme.accentColor'ından (mor) BAĞIMSIZDIR, tıpkı Platform'da olduğu
// gibi. Bu ConfigProvider yalnızca bu ekran ağacını sarar; global tema
// değişmez.
const IQV_ACCENT = '#4a6fa5';

interface FormValues {
  username: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  token: string;
  user: Admin['user'];
}

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || webRoutes.dictionary;
  const admin = useSelector((state: RootState) => state.admin);
  const [loading, setLoading] = useState<boolean>(false);
  const [form] = Form.useForm<FormValues>();
  // Kullanıcı adı VE parola dolu mu — "Giriş Yap" butonunun rengi için
  // (Platform'daki hasCredentials deseniyle birebir aynı). Sadece görsel
  // durum; submit/API akışını etkilemez.
  const [hasCredentials, setHasCredentials] = useState<boolean>(false);

  const handleValuesChange = (_changed: unknown, allValues: FormValues) => {
    const username = (allValues.username ?? '').trim();
    const password = allValues.password ?? '';
    setHasCredentials(Boolean(username) && Boolean(password));
  };

  useEffect(() => {
    setPageTitle('IQVizyon Giriş');
  }, []);

  useEffect(() => {
    if (admin) {
      navigate(from, { replace: true });
    }
  }, [admin, from, navigate]);

  const onSubmit = (values: FormValues) => {
    setLoading(true);

    // Real local backend login — never ReqRes.
    defaultHttp
      .post<LoginResponse>(apiRoutes.login, {
        username: values.username,
        password: values.password,
      })
      .then((response) => {
        const admin: Admin = {
          token: response.data.token,
          user: response.data.user,
        };
        dispatch(login(admin));
      })
      .catch((error) => {
        handleErrorResponse(error);
        setLoading(false);
      });
  };

  return (
    <ConfigProvider theme={{ token: { colorPrimary: IQV_ACCENT } }}>
      <Fragment>
        {/* IQV Platform Login'deki marka yazısıyla birebir aynı tipografi
            (font-size/weight/letter-spacing/renk) — Platform "Platform"
            yazıyor, bu uygulama kendi adını ("Dictionary") kullanır. Platform
            Login'de gerçek bir logo/wordmark görseli yok, aynı metin tabanlı
            yaklaşım korunmuştur. */}
        <div className="mb-2 text-center">
          <span
            style={{
              fontSize: '2.4rem',
              fontWeight: 375,
              letterSpacing: '0.12em',
              lineHeight: 1,
              color: IQV_ACCENT,
            }}
          >
            Dictionary
          </span>
        </div>

        <Form
          className="space-y-4 md:space-y-6"
          form={form}
          name="login"
          onFinish={onSubmit}
          onValuesChange={handleValuesChange}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label={
              <p className="block text-sm font-medium text-gray-900">
                Kullanıcı Adı
              </p>
            }
            rules={[
              {
                required: true,
                whitespace: true,
                message: 'Lütfen kullanıcı adınızı girin.',
              },
            ]}
          >
            <Input
              autoFocus
              autoComplete="username"
              placeholder="Kullanıcı adınızı girin"
              className="iqv-auth-input sm:text-sm py-1.5"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={
              <p className="block text-sm font-medium text-gray-900">Parola</p>
            }
            rules={[
              {
                required: true,
                message: 'Lütfen parolanızı girin.',
              },
            ]}
          >
            <Input.Password
              placeholder="Parolanızı girin"
              autoComplete="current-password"
              visibilityToggle
              className="iqv-auth-input sm:text-sm py-1.5"
            />
          </Form.Item>

          <div className="text-center">
            <Button
              className={`mt-4 iqv-login-submit-btn${
                hasCredentials ? ' iqv-login-submit-btn--filled' : ''
              }`}
              block
              loading={loading}
              type={hasCredentials ? 'primary' : 'default'}
              size="large"
              htmlType="submit"
            >
              Giriş Yap
            </Button>
          </div>
        </Form>

        <p
          className="text-center"
          style={{ marginTop: 22, fontSize: '0.85rem', color: '#8a8a8a' }}
        >
          2026 @ IQVizyon
        </p>
      </Fragment>
    </ConfigProvider>
  );
};

export default Login;
