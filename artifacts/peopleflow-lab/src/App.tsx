import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import {
  AdminPage, AppShell, ConfigPage, DashboardPage, DocumentsPage, EmployeePage,
  EmployeesPage, ForgotPasswordPage, LabResetControl, LoginPage, LogsPage,
  ProfilePage, ResetPasswordPage, ToolsPage,
} from '@/pages/peopleflow';
import { usePeopleFlowMe } from '@workspace/api-client-react';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={LoginPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/dashboard"><Private><DashboardPage /></Private></Route>
        <Route path="/employees"><Private><EmployeesPage /></Private></Route>
        <Route path="/employees/:id">{params => <Private><EmployeePage id={params.id} /></Private>}</Route>
        <Route path="/profile"><Private><ProfilePage /></Private></Route>
        <Route path="/admin"><Private><AdminPage /></Private></Route>
        <Route path="/documents"><Private><DocumentsPage /></Private></Route>
        <Route path="/config"><Private><ConfigPage /></Private></Route>
        <Route path="/admin/tools"><Private><ToolsPage /></Private></Route>
        <Route path="/logs"><Private><LogsPage /></Private></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function Private({ children }: { children: ReactNode }) {
  const me = usePeopleFlowMe();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (me.isError) setLocation(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [me.isError, setLocation]);
  if (me.isLoading) return <div className="auth-loading"><div className="loading-mark" /><span>Checking your session</span></div>;
  if (me.isError || !me.data) return <div className="auth-loading"><span>Redirecting to sign in…</span></div>;
  return <AppShell>{children}</AppShell>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
