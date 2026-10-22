import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity, ArrowLeft, ArrowRight, BadgeCheck, Banknote, BookOpenText,
  BriefcaseBusiness, Building2, Check, ChevronDown, CircleAlert, ClipboardList,
  FileSearch, Fingerprint, Gauge, KeyRound, LockKeyhole, LogOut, Menu, RefreshCw,
  Search, Settings2, Shield, ShieldAlert, ShieldCheck, TerminalSquare, UserRound,
  UsersRound, X,
} from 'lucide-react';
import {
  getPeopleFlowAdminToolsQueryKey, getPeopleFlowAdminUsersQueryKey, getPeopleFlowEmployeesQueryKey,
  getPeopleFlowMeQueryKey, getPeopleFlowProfileQueryKey, usePeopleFlowProfile, usePeopleFlowAdminTools, usePeopleFlowAdminUsers,
  usePeopleFlowChangeRole, usePeopleFlowConfig, usePeopleFlowDashboard, usePeopleFlowDocuments,
  usePeopleFlowEmployee, usePeopleFlowEmployees, usePeopleFlowForgotPassword, usePeopleFlowImport,
  usePeopleFlowLogin, usePeopleFlowLogout, usePeopleFlowLogs, usePeopleFlowMe, usePeopleFlowPayslip,
  usePeopleFlowResetLab, usePeopleFlowResetPassword, usePeopleFlowUpdateProfile,
} from '@workspace/api-client-react';
import type { Employee, ProfileUpdate, User } from '@workspace/api-client-react';

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');
const money = (value?: number) => typeof value === 'number'
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  : '—';
const errText = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.';

function Button({ children, onClick, type = 'button', disabled, tone = 'solid', className = '', testId }: {
  children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean;
  tone?: 'solid' | 'quiet' | 'danger'; className?: string; testId?: string;
}) {
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId}
    className={cx('btn', `btn-${tone}`, className)}>{children}</button>;
}
function Field({ label, testId, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; testId?: string }) {
  return <label className="field"><span>{label}</span><input {...props} data-testid={testId || `input-${label.toLowerCase().replaceAll(' ', '-')}`} /></label>;
}
function TextArea({ label, testId, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; testId?: string }) {
  return <label className="field"><span>{label}</span><textarea {...props} data-testid={testId || `input-${label.toLowerCase().replaceAll(' ', '-')}`} /></label>;
}
function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error-box" role="alert"><CircleAlert size={18} /><div><b>Could not load this view</b><p>{message}</p>{retry && <button className="inline-action" onClick={retry}>Try again</button>}</div></div>;
}
function Loading({ label = 'Loading record' }: { label?: string }) {
  return <div className="loading-grid" aria-label={label}><i /><i /><i /><i /></div>;
}
function Empty({ title, copy }: { title: string; copy: string }) {
  return <div className="empty-state"><div className="empty-mark"><FileSearch size={22} /></div><h3>{title}</h3><p>{copy}</p></div>;
}
function Notice({ children }: { children: ReactNode }) {
  return <div className="lab-notice"><ShieldCheck size={16} /><span>{children}</span></div>;
}
function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}
function Metric({ label, value, detail, icon: Icon, accent = false }: { label: string; value: ReactNode; detail: string; icon: typeof UsersRound; accent?: boolean }) {
  return <article className={cx('metric-card', accent && 'metric-accent')}><div className="metric-top"><span>{label}</span><Icon size={18} /></div><strong>{value}</strong><small>{detail}</small></article>;
}

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: Gauge, group: 'Workspace' },
  { label: 'Employees', href: '/employees', icon: UsersRound, group: 'Workspace' },
  { label: 'Documents', href: '/documents', icon: BookOpenText, group: 'Workspace' },
  { label: 'My profile', href: '/profile', icon: UserRound, group: 'Workspace' },
  { label: 'Role console', href: '/admin', icon: Shield, group: 'Administration' },
  { label: 'Lab tools', href: '/admin/tools', icon: TerminalSquare, group: 'Administration' },
  { label: 'System config', href: '/config', icon: Settings2, group: 'Administration' },
  { label: 'Activity logs', href: '/logs', icon: Activity, group: 'Administration' },
];
export function AppShell({ children }: { children: ReactNode }) {
  const [path, setPath] = useLocation();
  const me = usePeopleFlowMe();
  const client = useQueryClient();
  const logout = usePeopleFlowLogout();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = me.data;
  const signOut = () => logout.mutate(undefined, { onSuccess: () => { client.removeQueries({ queryKey: getPeopleFlowMeQueryKey() }); setPath('/login'); } });
  return <div className="app-frame">
    <aside className={cx('sidebar', mobileOpen && 'sidebar-open')}>
      <Link href="/dashboard" className="brand-lockup"><span className="brand-symbol"><Building2 size={19} /></span><span><b>PeopleFlow</b><small>SECURITY LAB</small></span></Link>
      <div className="tenant-switch"><span className="tenant-dot" /><span><b>Northstar Studio</b><small>Training tenant</small></span><ChevronDown size={15} /></div>
      <nav className="side-nav">
        {['Workspace', 'Administration'].map(group => <div key={group}>
          <div className="nav-caption">{group}</div>
          {navItems.filter(item => item.group === group && (group !== 'Administration' || user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN')).map(item => {
            const active = path === item.href || (item.href === '/employees' && path.startsWith('/employees/')) || (item.href === '/admin/tools' && path.startsWith('/admin/tools'));
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
              className={cx('nav-item', active && 'nav-active')} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={17} /><span>{item.label}</span></Link>;
          })}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="lab-chip"><ShieldAlert size={16} /><div><b>Isolated lab</b><span>Synthetic tenant data</span></div></div>
        <button className="user-chip" onClick={() => setPath('/profile')} data-testid="button-open-profile">
          <span className="avatar">{user?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'PF'}</span>
          <span className="user-chip-copy"><b>{user?.fullName || (me.isLoading ? 'Checking session…' : 'Your account')}</b><small>{user?.role || 'Session not loaded'}</small></span>
          <ArrowRight size={15} />
        </button>
      </div>
    </aside>
    {mobileOpen && <button aria-label="Close navigation" className="mobile-scrim" onClick={() => setMobileOpen(false)} />}
    <section className="main-column">
      <header className="topbar">
        <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)} data-testid="button-open-navigation"><Menu size={20} /></button>
        <div className="crumb"><span>PeopleFlow</span><span className="crumb-slash">/</span><b>{navItems.find(n => n.href === path || (n.href === '/employees' && path.startsWith('/employees'))) ?.label || (path === '/dashboard' ? 'Overview' : 'Workspace')}</b></div>
        <div className="topbar-right"><span className="live-indicator"><i /> Lab session active</span><button className="icon-button" onClick={signOut} disabled={logout.isPending} title="Sign out" data-testid="button-sign-out"><LogOut size={17} /></button></div>
      </header>
      <div className="work-area">
        <Notice>LOCAL TRAINING ENVIRONMENT <span className="notice-divider">/</span> All records are synthetic. Actions affect only this isolated lab.</Notice>
        {logout.isError && <ErrorBox message={errText(logout.error)} />}
        <main className="page-enter">{children}</main>
        <footer className="footer-line"><span>PeopleFlow Internal Systems</span><span className="mono">TENANT: NORTHSTAR-TRAINING</span><span>Build 0.14.2-lab</span></footer>
      </div>
    </section>
  </div>;
}

export function LoginPage() {
  const login = usePeopleFlowLogin();
  const client = useQueryClient();
  const [location, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [success, setSuccess] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault(); setSuccess('');
    login.mutate({ data: { email, password } }, { onSuccess: (res) => {
      client.setQueryData(getPeopleFlowMeQueryKey(), res.user);
      setSuccess(res.warning || 'Session established. Welcome to the training tenant.');
      const next = new URLSearchParams(location.split('?')[1] || '').get('next');
      setTimeout(() => setLocation(next?.startsWith('/') ? next : '/dashboard'), 450);
    } });
  };
  return <AuthFrame title="Sign in to your workspace" subtitle="Access the Northstar Studio training tenant.">
    <form className="auth-form" onSubmit={submit}>
      <Field label="Work email" type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@northstar.example" />
      <label className="field"><span>Password</span><span className="password-wrap"><input type={showPass ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" data-testid="input-password" /><button type="button" className="password-toggle" onClick={() => setShowPass(!showPass)}>{showPass ? 'Hide' : 'Show'}</button></span></label>
      <div className="form-meta"><span className="session-note"><LockKeyhole size={13} /> Tenant-managed session</span><Link href="/forgot-password" className="text-link">Forgot password?</Link></div>
      {login.isError && <ErrorBox message={errText(login.error)} />}
      {success && <div className="success-box"><Check size={16} />{success}</div>}
      <Button type="submit" disabled={login.isPending} className="w-full" testId="button-login">{login.isPending ? 'Signing in…' : 'Continue to workspace'}<ArrowRight size={16} /></Button>
    </form>
    <div className="auth-separator"><span /> <b>LAB ACCESS</b> <span /></div>
    <div className="auth-footnote"><LockKeyhole size={15} /><span>Authentication is handled by the local lab API. No external identity provider is connected.</span></div>
  </AuthFrame>;
}
function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <div className="auth-layout"><aside className="auth-aside"><Link href="/login" className="brand-lockup auth-brand"><span className="brand-symbol"><Building2 size={19} /></span><span><b>PeopleFlow</b><small>SECURITY LAB</small></span></Link><div className="auth-story"><div className="eyebrow">INTERNAL PEOPLE OPERATIONS</div><h2>People work.<br />Systems matter.</h2><p>A purpose-built HR workspace for practicing grey-box security testing in a safe, isolated environment.</p><div className="auth-stamp"><span className="stamp-icon"><ShieldCheck size={20} /></span><span><b>Local lab only</b><small>Fabricated people and payroll records</small></span></div></div><div className="auth-side-footer mono">LAB ENVIRONMENT / 01</div></aside><main className="auth-main"><div className="auth-card"><div className="eyebrow">NORTHSTAR STUDIO <span className="eyebrow-dot" /> SECURE ACCESS</div><h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>{children}<p className="legal-copy">By continuing, you acknowledge this is a synthetic training tenant. No real employee data is present.</p></div></main></div>;
}
export function ForgotPasswordPage() {
  const mutation = usePeopleFlowForgotPassword();
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ message: string; token?: string }>();
  return <AuthFrame title="Reset your password" subtitle="Request a training reset token for your account.">
    {!result ? <form className="auth-form" onSubmit={e => { e.preventDefault(); mutation.mutate({ data: { email } }, { onSuccess: r => setResult(r) }); }}>
      <Field label="Work email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@northstar.example" />
      {mutation.isError && <ErrorBox message={errText(mutation.error)} />}
      <Button type="submit" disabled={mutation.isPending} className="w-full" testId="button-request-reset">{mutation.isPending ? 'Requesting…' : 'Request reset token'}<ArrowRight size={16} /></Button>
    </form> : <div className="success-panel"><div className="success-icon"><Check size={20} /></div><h3>Request received</h3><p>{result.message}</p>{result.token && <div className="token-panel"><span>LAB RESET TOKEN</span><code>{result.token}</code><Link href={`/reset-password?token=${encodeURIComponent(result.token)}`} className="text-link">Continue to set a new password <ArrowRight size={14} /></Link></div>}</div>}
    {mutation.isError && result && <ErrorBox message={errText(mutation.error)} />}
    <Link className="back-link" href="/login"><ArrowLeft size={15} /> Back to sign in</Link>
  </AuthFrame>;
}
export function ResetPasswordPage() {
  const reset = usePeopleFlowResetPassword();
  const query = new URLSearchParams(window.location.search);
  const [token, setToken] = useState(query.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const mismatch = confirmation.length > 0 && password !== confirmation;
  return <AuthFrame title="Choose a new password" subtitle="Use the token issued by the local lab reset flow.">
    <form className="auth-form" onSubmit={e => { e.preventDefault(); if (password !== confirmation) return; setMessage(''); reset.mutate({ data: { token, password } }, { onSuccess: r => setMessage(r.message) }); }}>
      <Field label="Reset token" required value={token} onChange={e => setToken(e.target.value)} placeholder="Paste reset token" />
      <Field label="New password" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />
      <Field label="Confirm password" type="password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder="Enter it again" />
      {mismatch && <div className="inline-error">Passwords do not match.</div>}
      {reset.isError && <ErrorBox message={errText(reset.error)} />}
      {message && <div className="success-box"><Check size={16} />{message}</div>}
      <Button type="submit" disabled={reset.isPending || !token || !password || mismatch} className="w-full" testId="button-reset-password">{reset.isPending ? 'Updating…' : 'Set new password'}<ArrowRight size={16} /></Button>
    </form><Link className="back-link" href="/login"><ArrowLeft size={15} /> Back to sign in</Link>
  </AuthFrame>;
}

export function DashboardPage() {
  const q = usePeopleFlowDashboard();
  if (q.isLoading) return <><PageHeading eyebrow="WORKSPACE / OVERVIEW" title="Good to see you." subtitle="Your people operations snapshot, all in one place." /><Loading /></>;
  if (q.isError) return <><PageHeading eyebrow="WORKSPACE / OVERVIEW" title="Dashboard" subtitle="Your people operations snapshot." /><ErrorBox message={errText(q.error)} retry={() => q.refetch()} /></>;
  const data = q.data;
  if (!data) return <Empty title="No dashboard summary" copy="The API returned no dashboard data." />;
  return <div className="page-stack">
    <PageHeading eyebrow="WORKSPACE / OVERVIEW" title={`Good to see you, ${data.currentUser.fullName.split(' ')[0]}.`} subtitle="Here’s your Northstar Studio people operations snapshot." action={<span className="date-pill"><span className="status-dot" /> Summary <b>Live data</b></span>} />
    <div className="dashboard-intro"><div><span className="intro-kicker">PEOPLE OPERATIONS / NORTHSTAR STUDIO</span><h2>Keep the people side<br /><em>moving forward.</em></h2><p>Your workspace is up to date. Review people records and payroll resources below.</p><Link className="light-link" href="/employees">Open employee directory <ArrowRight size={15} /></Link></div><div className="intro-graphic"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="graphic-center"><UsersRound size={29} /></div><span className="orbit-node node-one"><UserRound size={15} /></span><span className="orbit-node node-two"><BriefcaseBusiness size={15} /></span><span className="orbit-node node-three"><Banknote size={15} /></span><span className="graphic-label mono">PEOPLE / 2025</span></div></div>
    <div className="metrics-grid">
      <Metric label="Total employees" value={data.employeeCount.toLocaleString()} detail="Across all departments" icon={UsersRound} />
      <Metric label="Payroll total" value={money(data.payrollTotal)} detail="Current payroll cycle" icon={Banknote} accent />
      <Metric label="Pending reviews" value={data.pendingReviews.toLocaleString()} detail="Awaiting manager review" icon={ClipboardList} />
      <Metric label="Your role" value={<span className="role-value">{data.currentUser.role}</span>} detail={data.currentUser.email} icon={BadgeCheck} />
    </div>
    <div className="dashboard-lower">
      <section className="panel welcome-panel"><div className="panel-head"><div><div className="eyebrow">START HERE</div><h3>Your workspace</h3></div><span className="mono small-meta">3 QUICK LINKS</span></div>
        {[['Employee directory', 'Search people and view their records', '/employees', UsersRound], ['Documents', 'Find handbooks, forms, and policies', '/documents', BookOpenText], ['Your profile', 'Review your workspace identity', '/profile', UserRound]].map(([title, desc, href, Icon]) => { const I = Icon as typeof UsersRound; return <Link href={href as string} className="quick-row" key={href as string}><span className="quick-icon"><I size={17} /></span><span className="quick-copy"><b>{title as string}</b><small>{desc as string}</small></span><ArrowRight size={16} /></Link>; })}
      </section>
      <section className="panel security-panel"><div className="panel-head"><div><div className="eyebrow">LAB STATUS</div><h3>Environment health</h3></div><span className="health-badge"><i /> Active</span></div><div className="security-main"><span className="security-art"><ShieldCheck size={26} /></span><div><b>Training tenant isolated</b><p>All actions are scoped to synthetic Northstar Studio data.</p></div></div><div className="security-meta"><span>Data classification</span><b><span className="status-dot" /> Synthetic</b></div><div className="security-meta"><span>Runtime mode</span><b>Local lab</b></div><Link href="/config" className="panel-link">View system details <ArrowRight size={14} /></Link></section>
    </div>
  </div>;
}

export function EmployeesPage() {
  const [location, setLocation] = useLocation();
  const params = new URLSearchParams(location.split('?')[1] || '');
  const [search, setSearch] = useState(params.get('search') || '');
  const filter = useMemo(() => ({ search: search.trim() || undefined }), [search]);
  const q = usePeopleFlowEmployees(filter);
  const updateSearch = (value: string) => { setSearch(value); const query = new URLSearchParams(); if (value) query.set('search', value); setLocation(`/employees${query.size ? `?${query.toString()}` : ''}`); };
  return <div className="page-stack">
    <PageHeading eyebrow="WORKSPACE / DIRECTORY" title="Employees" subtitle="Search people and open their employee records." action={<div className="record-count"><span className="status-dot" /> Directory access <b>{q.data?.length ?? '—'}</b></div>} />
     <div className="search-panel"><div className="search-input-wrap"><Search size={18} /><input aria-label="Search employees" placeholder="Search by name, email, role or department" value={search} onChange={e => updateSearch(e.target.value)} data-testid="input-employee-search" />{search && <button aria-label="Clear search" onClick={() => updateSearch('')}><X size={16} /></button>}</div><span className="search-hint mono">ENTER A NAME OR TERM</span></div>
     <div className="legacy-view-row"><a href={`/api/employee-search-view?search=${encodeURIComponent(search)}`} target="_blank" rel="noreferrer">Open legacy HTML search view <ArrowRight size={14} /></a><span>The legacy view is retained for the HTML-rendering exercise.</span></div>
    <section className="panel table-panel">
      <div className="table-top"><div><div className="eyebrow">PEOPLE INDEX</div><h3>Directory results</h3></div><span className="mono small-meta">{q.data?.length ?? 0} RECORDS</span></div>
      {q.isLoading ? <Loading label="Loading employees" /> : q.isError ? <ErrorBox message={errText(q.error)} retry={() => q.refetch()} /> : !q.data?.length ? <Empty title={search ? 'No matching employees' : 'No employee records'} copy={search ? 'Try a different search term.' : 'The directory is empty for this tenant.'} /> :
        <div className="table-scroll"><table><thead><tr><th>EMPLOYEE</th><th>DEPARTMENT</th><th>ROLE</th><th>ANNUAL SALARY</th><th /></tr></thead><tbody>{q.data.map(person => <tr key={person.id} data-testid={`row-employee-${person.id}`}><td><Link href={`/employees/${person.id}`} className="person-cell"><span className="avatar avatar-warm">{person.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}</span><span><b>{person.fullName}</b><small>{person.email}</small></span></Link></td><td>{person.department}</td><td><span className="role-tag">{person.role}</span></td><td className="salary-cell">{money(person.salary)}</td><td><Link className="row-open" href={`/employees/${person.id}`} aria-label={`Open ${person.fullName}`}><ArrowRight size={17} /></Link></td></tr>)}</tbody></table></div>}
    </section><p className="data-footnote"><Fingerprint size={14} /> Employee records may contain sensitive synthetic fields. Access is provided for training only.</p>
  </div>;
}

export function EmployeePage({ id }: { id: string }) {
  const employeeId = Number(id);
  const q = usePeopleFlowEmployee(employeeId);
  const slip = usePeopleFlowPayslip(employeeId);
  if (q.isLoading) return <div className="page-stack"><Link href="/employees" className="back-link"><ArrowLeft size={15} /> Directory</Link><Loading /></div>;
  if (q.isError) return <div className="page-stack"><Link href="/employees" className="back-link"><ArrowLeft size={15} /> Directory</Link><ErrorBox message={errText(q.error)} retry={() => q.refetch()} /></div>;
  const p = q.data;
  if (!p) return <Empty title="Employee unavailable" copy="No employee record was returned." />;
  return <div className="page-stack">
    <Link href="/employees" className="back-link"><ArrowLeft size={15} /> Back to directory</Link>
     <div className="profile-hero"><div className="profile-avatar">{p.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}</div><div className="profile-title"><div className="eyebrow">EMPLOYEE RECORD <span className="mono">/ #{String(p.id).padStart(4, '0')}</span></div><h1>{p.fullName}</h1><p>{p.role} <span>·</span> {p.department}</p></div><span className="record-state"><i /> Record loaded</span></div>
     <div className="legacy-view-row"><a href={`/api/employee-view/${p.id}`} target="_blank" rel="noreferrer">Open legacy HTML profile <ArrowRight size={14} /></a><span>Uses the server-rendered employee view.</span></div>
    <div className="profile-columns"><div className="page-stack compact-stack">
      <section className="panel detail-panel"><div className="panel-head"><div><div className="eyebrow">IDENTITY</div><h3>Personal details</h3></div><UserRound size={18} /></div><div className="detail-grid"><Detail label="Work email" value={p.email} /><Detail label="Department" value={p.department} /><Detail label="Position" value={p.role} /><Detail label="Manager record" value={p.managerId ?? 'Not assigned'} /></div><div className="detail-bio"><span className="detail-label">BIO</span><p>{p.bio || 'No biography on file.'}</p></div></section>
      <section className="panel detail-panel"><div className="panel-head"><div><div className="eyebrow">PAYROLL</div><h3>Latest payslip</h3></div><Banknote size={18} /></div>
        {slip.isLoading ? <Loading /> : slip.isError ? <ErrorBox message={errText(slip.error)} retry={() => slip.refetch()} /> : slip.data ? <><div className="payslip-period"><span>PAY PERIOD</span><b>{slip.data.period}</b></div><div className="payslip-numbers"><div><small>Gross pay</small><strong>{money(slip.data.grossPay)}</strong></div><div><small>Net pay</small><strong>{money(slip.data.netPay)}</strong></div></div><div className="masked-account"><span>Bank account</span><code>{slip.data.bankAccount}</code></div></> : <Empty title="No payslip available" copy="A payslip was not returned for this employee." />}
      </section></div>
      <section className="panel sensitive-panel"><div className="sensitive-head"><span><ShieldAlert size={17} /> RESTRICTED FIELDS</span><span className="mono">SYNTHETIC DATA</span></div><h3>Sensitive identifiers</h3><p>Visible for the authorized lab exercise. Values are fabricated and safe to inspect.</p><div className="sensitive-field"><span>Social security number</span><code>{p.ssn || 'Not provided'}</code></div><div className="sensitive-field"><span>Bank account</span><code>{p.bankAccount || 'Not provided'}</code></div><div className="sensitive-footer"><LockKeyhole size={14} /> Do not export beyond the local training tenant.</div></section>
    </div>
  </div>;
}
function Detail({ label, value }: { label: string; value: ReactNode }) {
  return <div className="detail-item"><span className="detail-label">{label}</span><b>{value}</b></div>;
}

export function ProfilePage() {
  const q = usePeopleFlowProfile();
  const update = usePeopleFlowUpdateProfile();
  const client = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  useEffect(() => {
    if (q.data) { setFullName(q.data.fullName); setBio(q.data.bio); setBankAccount(q.data.bankAccount); }
  }, [q.data?.id, q.data?.fullName, q.data?.bio, q.data?.bankAccount]);
  if (q.isLoading) return <div className="page-stack"><PageHeading eyebrow="ACCOUNT / PROFILE" title="Your profile" subtitle="Manage your workspace profile." /><Loading /></div>;
  if (q.isError) return <div className="page-stack"><PageHeading eyebrow="ACCOUNT / PROFILE" title="Your profile" subtitle="Manage your workspace profile." /><ErrorBox message={errText(q.error)} retry={() => q.refetch()} /></div>;
  const save = (e: FormEvent) => { e.preventDefault(); const data: ProfileUpdate = { fullName, bio, bankAccount }; update.mutate({ data }, { onSuccess: (employee) => { client.setQueryData(getPeopleFlowMeQueryKey(), (old: User | undefined) => old ? { ...old, fullName: employee.fullName, role: employee.role } : old); client.setQueryData(getPeopleFlowProfileQueryKey(), employee); } }); };
  return <div className="page-stack"><PageHeading eyebrow="ACCOUNT / PROFILE" title="Your profile" subtitle="Keep your account details current across the Northstar Studio workspace." />
    <div className="profile-edit-layout"><section className="panel edit-panel"><div className="panel-head"><div><div className="eyebrow">PERSONAL DETAILS</div><h3>Workspace identity</h3></div><UserRound size={18} /></div><form className="edit-form" onSubmit={save}><Field label="Full name" required value={fullName} onChange={e => setFullName(e.target.value)} /><Field label="Work email" value={q.data?.email || ''} disabled /><Field label="Role" value={q.data?.role || ''} disabled /><Field label="Bank account" value={bankAccount} onChange={e => setBankAccount(e.target.value)} /><TextArea label="Bio" rows={5} value={bio} onChange={e => setBio(e.target.value)} placeholder="Add a short professional introduction." /><div className="form-actions"><span className="muted-copy">Changes are saved to your lab profile.</span><Button type="submit" disabled={update.isPending || !fullName.trim()} testId="button-save-profile">{update.isPending ? 'Saving…' : 'Save changes'}<Check size={15} /></Button></div>{update.isError && <ErrorBox message={errText(update.error)} />}{update.isSuccess && <div className="success-box"><Check size={16} />Profile updated successfully.</div>}</form></section><aside className="panel info-aside"><div className="info-aside-icon"><ShieldCheck size={21} /></div><div className="eyebrow">ACCOUNT SCOPE</div><h3>Personal workspace profile</h3><p>Update your name, biography, and payroll details for this synthetic training account.</p><div className="info-key"><span>ACCOUNT ID</span><code>{q.data?.id ? `PF-${String(q.data.id).padStart(5, '0')}` : '—'}</code></div></aside></div>
  </div>;
}

export function AdminPage() {
  const q = usePeopleFlowAdminUsers();
  const change = usePeopleFlowChangeRole();
  const client = useQueryClient();
  const [roles, setRoles] = useState<Record<number, string>>({});
  const roleOptions = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'SUPER_ADMIN'];
  return <div className="page-stack"><PageHeading eyebrow="ADMINISTRATION / ACCESS" title="Role console" subtitle="Review tenant accounts and update training roles." action={<span className="admin-pill"><Shield size={15} /> Admin controls</span>} />
    <div className="role-warning"><ShieldAlert size={18} /><div><b>Role changes take effect immediately</b><p>Use this console only within the isolated Northstar Studio training tenant.</p></div></div>
    <section className="panel table-panel"><div className="table-top"><div><div className="eyebrow">TENANT ACCESS</div><h3>User accounts</h3></div><span className="mono small-meta">{q.data?.length ?? 0} ACCOUNTS</span></div>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorBox message={errText(q.error)} retry={() => q.refetch()} /> : !q.data?.length ? <Empty title="No tenant users" copy="The API returned no user accounts." /> : <div className="table-scroll"><table><thead><tr><th>USER</th><th>ACCOUNT ID</th><th>CURRENT ROLE</th><th>CHANGE ROLE</th><th /></tr></thead><tbody>{q.data.map((user: User) => <tr key={user.id} data-testid={`row-admin-user-${user.id}`}><td><div className="person-cell"><span className="avatar avatar-lavender">{user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}</span><span><b>{user.fullName}</b><small>{user.email}</small></span></div></td><td className="mono table-id">PF-{String(user.id).padStart(5, '0')}</td><td><span className="role-tag">{user.role}</span></td><td><select aria-label={`Select role for ${user.fullName}`} className="role-select" value={roles[user.id] ?? user.role} onChange={e => setRoles(prev => ({ ...prev, [user.id]: e.target.value }))} data-testid={`select-role-${user.id}`}>{roleOptions.map(r => <option key={r} value={r}>{r}</option>)}</select></td><td><Button tone="quiet" disabled={change.isPending || (roles[user.id] ?? user.role) === user.role} onClick={() => { const role = roles[user.id] ?? user.role; change.mutate({ data: { userId: user.id, role } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getPeopleFlowAdminUsersQueryKey() }); setRoles(prev => { const next = { ...prev }; delete next[user.id]; return next; }); } }); }} testId={`button-save-role-${user.id}`}>{change.isPending ? 'Saving…' : 'Apply'}</Button></td></tr>)}</tbody></table></div>}
      {change.isError && <div className="panel-inset"><ErrorBox message={errText(change.error)} /></div>}
    </section><div className="data-footnote"><KeyRound size={14} /> Role assignment is an administrative action and is recorded by the training API.</div>
  </div>;
}

export function DocumentsPage() {
  const [filter, setFilter] = useState(new URLSearchParams(window.location.search).get('filter') || '');
  const params = useMemo(() => ({ filter: filter.trim() || undefined }), [filter]);
  const q = usePeopleFlowDocuments(params);
  const [, setLocation] = useLocation();
  const updateFilter = (value: string) => { setFilter(value); const query = new URLSearchParams(); if (value) query.set('filter', value); setLocation(`/documents${query.size ? `?${query.toString()}` : ''}`); };
  const [selected, setSelected] = useState<number | null>(null);
  const docs = q.data || [];
  const active = docs.find(d => d.id === selected);
  return <div className="page-stack"><PageHeading eyebrow="WORKSPACE / KNOWLEDGE" title="Documents" subtitle="Search employee resources, policies, and internal forms." />
    <div className="search-panel"><div className="search-input-wrap"><Search size={18} /><input placeholder="Filter by title, type or content" aria-label="Filter documents" value={filter} onChange={e => updateFilter(e.target.value)} data-testid="input-document-search" />{filter && <button onClick={() => updateFilter('')} aria-label="Clear filter"><X size={16} /></button>}</div><span className="search-hint mono">DOCUMENT SEARCH</span></div>
    {q.isLoading ? <Loading /> : q.isError ? <ErrorBox message={errText(q.error)} retry={() => q.refetch()} /> : !docs.length ? <Empty title="No documents found" copy={filter ? 'Try a broader search.' : 'No documents are available for this tenant.'} /> : <div className="document-layout"><section className="panel document-list"><div className="panel-head"><div><div className="eyebrow">LIBRARY</div><h3>{docs.length} document{docs.length === 1 ? '' : 's'}</h3></div><BookOpenText size={17} /></div>{docs.map(doc => <button onClick={() => setSelected(doc.id)} key={doc.id} className={cx('document-row', (selected ?? docs[0]?.id) === doc.id && 'document-selected')} data-testid={`button-document-${doc.id}`}><span className="doc-icon"><BookOpenText size={17} /></span><span><b>{doc.title}</b><small>{doc.type} <span>·</span> Employee #{doc.employeeId}</small></span><ArrowRight size={15} /></button>)}</section><article className="panel document-view">{active || docs[0] ? <><div className="doc-view-meta"><span className="eyebrow">DOCUMENT / {String((active || docs[0]).id).padStart(4, '0')}</span><span className="role-tag">{(active || docs[0]).type}</span></div><h2>{(active || docs[0]).title}</h2><div className="doc-body">{(active || docs[0]).body}</div><div className="doc-view-foot"><span>Associated employee record</span><Link href={`/employees/${(active || docs[0]).employeeId}`} className="text-link">Open employee <ArrowRight size={14} /></Link></div></> : null}</article></div>}
  </div>;
}

export function ConfigPage() {
  const q = usePeopleFlowConfig();
  return <div className="page-stack"><PageHeading eyebrow="ADMINISTRATION / SYSTEM" title="System configuration" subtitle="Read-only information returned by the local training service." action={<span className="readonly-badge"><LockKeyhole size={14} /> Read only</span>} />
    <div className="config-banner"><div className="config-banner-icon"><Settings2 size={21} /></div><div><span className="eyebrow">SYSTEM SNAPSHOT</span><h2>Runtime configuration</h2><p>Values below are served by the lab API and represent the current simulated environment.</p></div><span className="banner-mark mono">CFG / 04</span></div>
    {q.isLoading ? <Loading /> : q.isError ? <ErrorBox message={errText(q.error)} retry={() => q.refetch()} /> : q.data ? <div className="config-grid">
      <ConfigItem label="Application" value={q.data.app} icon={Building2} />
      <ConfigItem label="Environment" value={q.data.environment} icon={Activity} />
      <ConfigItem label="Session secret" value={q.data.sessionSecret} sensitive />
      <ConfigItem label="Third-party key" value={q.data.thirdPartyKey} sensitive />
    </div> : <Empty title="No configuration returned" copy="The system endpoint returned no configuration." />}
    <div className="config-disclaimer"><ShieldAlert size={16} /><span>Sensitive-looking values are synthetic lab fixtures. This screen does not store or modify configuration.</span></div>
  </div>;
}
function ConfigItem({ label, value, icon: Icon, sensitive = false }: { label: string; value: string; icon?: typeof Settings2; sensitive?: boolean }) {
  return <article className={cx('panel config-item', sensitive && 'config-sensitive')}><div className="config-item-top"><span>{Icon ? <Icon size={17} /> : <KeyRound size={17} />}{label}</span>{sensitive && <span className="sensitive-label"><LockKeyhole size={12} /> LAB VALUE</span>}</div><code>{value || 'Not configured'}</code></article>;
}

export function ToolsPage() {
  const client = useQueryClient();
  const [target, setTarget] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [source, setSource] = useState('[\n  {\n    "id": 0,\n    "fullName": "Sample Person",\n    "email": "sample@northstar.example",\n    "role": "employee",\n    "department": "People Operations",\n    "salary": 64000,\n    "ssn": "000-00-0000",\n    "bankAccount": "LAB-000000",\n    "bio": "Synthetic import record",\n    "managerId": null\n  }\n]');
  const [importError, setImportError] = useState('');
  const params = useMemo(() => ({ target: submitted || undefined }), [submitted]);
  const diagnostic = usePeopleFlowAdminTools(params, { query: { enabled: submitted !== null, queryKey: getPeopleFlowAdminToolsQueryKey(params) } });
  const importMutation = usePeopleFlowImport();
  const [importResult, setImportResult] = useState<{ accepted: number; simulated: boolean; message: string } | null>(null);
  const run = () => { setSubmitted(target.trim() || ''); };
  const submitImport = (e: FormEvent) => {
    e.preventDefault(); setImportError(''); setImportResult(null);
    try {
      const parsed: unknown = JSON.parse(source);
      if (!Array.isArray(parsed)) throw new Error('Import data must be a JSON array of employee records.');
      importMutation.mutate({ data: { employees: parsed as Employee[] } }, { onSuccess: result => {
        setImportResult(result);
        client.invalidateQueries({ queryKey: getPeopleFlowEmployeesQueryKey() });
      } });
    } catch (error) { setImportError(error instanceof Error ? error.message : 'Invalid JSON.'); }
  };
  return <div className="page-stack"><PageHeading eyebrow="ADMINISTRATION / LAB TOOLS" title="Diagnostic & import" subtitle="Run safe simulated checks and submit synthetic employee records." />
    <div className="tool-notice"><ShieldCheck size={18} /><div><b>Simulation-only tools</b><p>Diagnostic output is simulated. Imports are sent to the lab API; no shell or code execution is available here.</p></div></div>
    <div className="tools-grid"><section className="panel tool-card"><div className="tool-card-top"><span className="tool-icon"><TerminalSquare size={19} /></span><span className="tool-tag">SIMULATED</span></div><div className="eyebrow">DIAGNOSTIC</div><h3>Connectivity check</h3><p>Request a harmless simulated diagnostic result for a named target.</p><form className="tool-form" onSubmit={e => { e.preventDefault(); run(); }}><Field label="Target label" value={target} onChange={e => setTarget(e.target.value)} placeholder="e.g. payroll-service" /><Button type="submit" disabled={diagnostic.isFetching} testId="button-run-diagnostic">{diagnostic.isFetching ? 'Running…' : 'Run diagnostic'}<ArrowRight size={15} /></Button></form>
      {diagnostic.isError && <ErrorBox message={errText(diagnostic.error)} retry={() => diagnostic.refetch()} />}
      {diagnostic.data && <div className="result-console"><div className="console-head"><span><i /> RESULT</span><span>{diagnostic.data.simulated ? 'SIMULATED' : 'API RESPONSE'}</span></div><div><small>TARGET</small><b>{diagnostic.data.target}</b></div><pre>{diagnostic.data.output}</pre><div className="result-foot"><Check size={14} /> No commands were executed.</div></div>}
    </section>
    <section className="panel tool-card import-card"><div className="tool-card-top"><span className="tool-icon tool-icon-orange"><ClipboardList size={19} /></span><span className="tool-tag orange-tag">LAB IMPORT</span></div><div className="eyebrow">SYNTHETIC DATA</div><h3>Import employee records</h3><p>Submit a JSON array of employee data to the provided simulation endpoint.</p><form onSubmit={submitImport}><TextArea label="Employee JSON" rows={12} spellCheck={false} className="mono" value={source} onChange={e => setSource(e.target.value)} /><div className="tool-form-bottom"><span className="mono small-meta">JSON ARRAY REQUIRED</span><Button type="submit" disabled={importMutation.isPending} testId="button-submit-import">{importMutation.isPending ? 'Submitting…' : 'Submit import'}<ArrowRight size={15} /></Button></div></form>
      {importError && <div className="inline-error">{importError}</div>}{importMutation.isError && <ErrorBox message={errText(importMutation.error)} />}{importResult && <div className="import-result"><span className="success-icon"><Check size={17} /></span><div><b>{importResult.message}</b><p>{importResult.accepted} records accepted · {importResult.simulated ? 'simulation confirmed' : 'API response received'}</p></div></div>}
    </section></div>
    <LabResetControl />
  </div>;
}

export function LogsPage() {
  const q = usePeopleFlowLogs();
  return <div className="page-stack"><PageHeading eyebrow="ADMINISTRATION / AUDIT" title="Activity logs" subtitle="Read simulated application activity returned by the lab service." action={<Button tone="quiet" onClick={() => q.refetch()} disabled={q.isFetching} testId="button-refresh-logs"><RefreshCw size={15} /> {q.isFetching ? 'Refreshing…' : 'Refresh'}</Button>} />
    <div className="logs-summary"><div><span className="eyebrow">LOG STREAM</span><b>{q.data?.length ?? '—'} <small>entries</small></b></div><span className="logs-live"><i /> API-backed</span><span className="mono">SYNTHETIC / READ-ONLY</span></div>
    <section className="panel logs-panel"><div className="logs-panel-head"><span><Activity size={16} /> Recent activity</span><span className="mono">SOURCE: /API/LOGS</span></div>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorBox message={errText(q.error)} retry={() => q.refetch()} /> : !q.data?.length ? <Empty title="No activity yet" copy="The logs endpoint returned an empty list." /> : <div className="log-list">{q.data.map((line, index) => <div className="log-row" key={`${index}-${line}`} data-testid={`log-entry-${index}`}><span className="log-index mono">{String(index + 1).padStart(2, '0')}</span><span className="log-dot" /><code>{line}</code><span className="log-kind">LAB</span></div>)}</div>}
    </section><div className="data-footnote"><LockKeyhole size={14} /> Logs are displayed verbatim from the lab API and are not persisted in the browser.</div>
  </div>;
}

export function LabResetControl() {
  const reset = usePeopleFlowResetLab();
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  return <section className="panel reset-control"><div className="reset-icon"><RefreshCw size={18} /></div><div className="reset-copy"><b>Restore seeded lab state</b><p>Restore the API's seeded training state. This action affects all current lab records.</p>{reset.isError && <span className="inline-error">{errText(reset.error)}</span>}{message && <span className="success-inline"><Check size={14} />{message}</span>}</div>{!confirm ? <Button tone="quiet" onClick={() => setConfirm(true)} testId="button-reset-lab">Reset lab</Button> : <div className="confirm-actions"><Button tone="quiet" onClick={() => setConfirm(false)}>Cancel</Button><Button tone="danger" disabled={reset.isPending} onClick={() => reset.mutate(undefined, { onSuccess: result => { setMessage(result.message); setConfirm(false); client.invalidateQueries(); } })} testId="button-confirm-reset">{reset.isPending ? 'Restoring…' : 'Confirm reset'}</Button></div>}</section>;
}

