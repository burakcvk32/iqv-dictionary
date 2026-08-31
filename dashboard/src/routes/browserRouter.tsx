import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '../components/auth/AuthLayout';
import ErrorPage from '../components/errorPage';
import Layout from '../components/layout';
import Redirect from '../components/layout/Redirect';
import NotFoundPage from '../components/notfoundPage';
import { webRoutes } from './web';
import loadable from '@loadable/component';
import ProgressBar from '../components/loader/progressBar';
import RequireAuth from './requireAuth';
import RequirePermission from './requirePermission';
import Login from '../components/auth/Login';

const errorElement = <ErrorPage />;
const fallbackElement = <ProgressBar />;

const Users = loadable(() => import('../components/users'), {
  fallback: fallbackElement,
});
const Dictionary = loadable(() => import('../components/dictionary'), {
  fallback: fallbackElement,
});
const Settings = loadable(() => import('../components/settings'), {
  fallback: fallbackElement,
});

export const browserRouter = createBrowserRouter([
  {
    path: webRoutes.home,
    element: <Redirect />,
    errorElement: errorElement,
  },

  // auth routes
  {
    element: <AuthLayout />,
    errorElement: errorElement,
    children: [
      {
        path: webRoutes.login,
        element: <Login />,
      },
    ],
  },

  // protected routes
  {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    errorElement: errorElement,
    children: [
      {
        // Dashboard demo/template page removed; keep the old address alive
        // as a redirect to the current landing page instead of rendering
        // dead template content.
        path: webRoutes.dashboard,
        element: <Navigate to={webRoutes.dictionary} replace />,
      },
      {
        path: webRoutes.users,
        element: (
          <RequirePermission permission="users.read">
            <Users />
          </RequirePermission>
        ),
      },
      {
        path: webRoutes.dictionary,
        element: (
          <RequirePermission permission="dictionary.read">
            <Dictionary />
          </RequirePermission>
        ),
      },
      {
        path: webRoutes.settings,
        element: (
          <RequirePermission permission="settings.read">
            <Settings />
          </RequirePermission>
        ),
      },
      {
        // Legacy misspelled route: alias/redirect to the canonical page,
        // no second implementation.
        path: webRoutes.dictionaryLegacy,
        element: <Navigate to={webRoutes.dictionary} replace />,
      },
    ],
  },

  // 404
  {
    path: '*',
    element: <NotFoundPage />,
    errorElement: errorElement,
  },
]);
