import { createHash, createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import ejs from "ejs";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";

type Role = "EMPLOYEE" | "MANAGER" | "HR_ADMIN" | "SUPER_ADMIN";
type User = {
  id: number;
  email: string;
  fullName: string;
  role: string;
};
type Employee = User & {
  ssn: string;
  bankAccount: string;
  salary: number;
  department: string;
  managerId: number | null;
  bio: string;
};
type LabRequest = Request & { labUser?: User };
type Session = { userId: number };
type DocumentRecord = {
  id: number;
  employeeId: number;
  title: string;
  type: string;
  body: string;
};

const router: IRouter = Router();
const db = new DatabaseSync(":memory:");
const sessions = new Map<string, Session>();
const resetTokens = new Map<string, number>();
const labLogs: string[] = [];
const trainingSessionSecret = "secret123";
let sessionSequence = 1;
let resetSequence = 4100;
let documents: DocumentRecord[] = [];

const employeesSeed = [
  [101, "Alice Morgan", "alice@peopleflow.test", "EMPLOYEE", "Customer Success", 78000, "900-10-0101", "0000000010101", 103, "I help customers get the most from PeopleFlow.", "alice123"],
  [102, "Bob Bennett", "bob@peopleflow.test", "EMPLOYEE", "Sales", 82500, "900-10-0102", "0000000010102", 103, "Focused on thoughtful customer partnerships.", "bob123"],
  [103, "Morgan Reyes", "manager@peopleflow.test", "MANAGER", "Customer Success", 118000, "900-10-0103", "0000000010103", null, "Team lead for customer-facing teams.", "managerpass"],
  [104, "Jordan Patel", "hr@peopleflow.test", "HR_ADMIN", "People Operations", 132000, "900-10-0104", "0000000010104", null, "Supporting people operations and employee experience.", "hrpass"],
  [105, "Taylor Kim", "taylor@peopleflow.test", "EMPLOYEE", "Finance", 94000, "900-10-0105", "0000000010105", 104, "Building clearer financial workflows.", "taylor123"],
  [106, "Casey Brown", "casey@peopleflow.test", "EMPLOYEE", "Engineering", 126000, "900-10-0106", "0000000010106", 103, "Making internal tools simpler.", "casey123"],
  [107, "Riley Shah", "riley@peopleflow.test", "EMPLOYEE", "Operations", 89000, "900-10-0107", "0000000010107", 104, "Keeping the day-to-day moving.", "riley123"],
  [108, "Avery Chen", "superadmin@peopleflow.test", "SUPER_ADMIN", "IT", 178000, "900-10-0108", "0000000010108", null, "Platform administrator.", "Admin@123"],
] as const;

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function seedDatabase() {
  db.exec("DROP TABLE IF EXISTS employees");
  db.exec(`
    CREATE TABLE employees (
      id INTEGER PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      department TEXT NOT NULL,
      salary REAL NOT NULL,
      ssn TEXT NOT NULL,
      bank_account TEXT NOT NULL,
      manager_id INTEGER,
      bio TEXT NOT NULL,
      password_md5 TEXT NOT NULL
    )
  `);
  const insert = db.prepare(`
    INSERT INTO employees
      (id, full_name, email, role, department, salary, ssn, bank_account, manager_id, bio, password_md5)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [id, fullName, email, role, department, salary, ssn, bankAccount, managerId, bio, password] of employeesSeed) {
    insert.run(id, fullName, email, role, department, salary, ssn, bankAccount, managerId, bio, md5(password));
  }
  documents = [
    { id: 1, employeeId: 101, title: "Q3 Payslip", type: "payslip", body: "Gross pay $6,500.00; net pay $4,720.00." },
    { id: 2, employeeId: 101, title: "Offer Letter", type: "contract", body: "PeopleFlow employment offer for Alice Morgan." },
    { id: 3, employeeId: 102, title: "Performance Review", type: "review", body: "Bob's quarterly goals and review notes." },
    { id: 4, employeeId: 103, title: "Manager Review", type: "review", body: "Customer Success team performance summary." },
    { id: 5, employeeId: 104, title: "Benefits Enrollment", type: "benefits", body: "People Operations benefits plan summary." },
    { id: 6, employeeId: 105, title: "Q3 Payslip", type: "payslip", body: "Gross pay $7,833.33; net pay $5,620.00." },
    { id: 7, employeeId: 106, title: "Employment Contract", type: "contract", body: "Engineering employment terms for Casey Brown." },
    { id: 8, employeeId: 108, title: "Admin Review", type: "review", body: "System administration annual review." },
  ];
}

seedDatabase();

function employeeFromRow(row: Record<string, unknown> | undefined): Employee | undefined {
  if (!row) return undefined;
  return {
    id: Number(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    role: String(row.role),
    department: String(row.department),
    salary: Number(row.salary),
    ssn: String(row.ssn),
    bankAccount: String(row.bank_account),
    managerId: row.manager_id == null ? null : Number(row.manager_id),
    bio: String(row.bio),
  };
}

function getEmployee(id: number): Employee | undefined {
  return employeeFromRow(db.prepare("SELECT * FROM employees WHERE id = ?").get(id) as Record<string, unknown> | undefined);
}

function getUser(id: number): User | undefined {
  const employee = getEmployee(id);
  if (!employee) return undefined;
  return { id: employee.id, email: employee.email, fullName: employee.fullName, role: employee.role };
}

function allEmployees(): Employee[] {
  return (db.prepare("SELECT * FROM employees ORDER BY id").all() as Record<string, unknown>[])
    .map((row) => employeeFromRow(row)!)
    .filter(Boolean);
}

function sessionIdFromRequest(req: Request): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  const found = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith("pf_session="));
  if (!found) return undefined;
  const value = decodeURIComponent(found.slice("pf_session=".length));
  const separator = value.lastIndexOf(".");
  const id = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = createHmac("sha256", trainingSessionSecret).update(id).digest("hex");
  if (!id || !signature || signature !== expected) throw new Error("Invalid training session signature");
  return id;
}

function ensureSession(req: Request, res: Response): string {
  const existing = sessionIdFromRequest(req);
  const id = existing || `pf-${String(sessionSequence++).padStart(6, "0")}`;
  if (!existing) {
    const signature = createHmac("sha256", trainingSessionSecret).update(id).digest("hex");
    res.setHeader("Set-Cookie", `pf_session=${encodeURIComponent(`${id}.${signature}`)}; Path=/; HttpOnly; SameSite=Lax`);
  }
  if (!sessions.has(id)) sessions.set(id, { userId: 0 });
  return id;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.header("x-lab-trigger") === "auth-error") throw new Error("simulated auth middleware failure");
    const id = sessionIdFromRequest(req);
    const session = id ? sessions.get(id) : undefined;
    const user = session?.userId ? getUser(session.userId) : undefined;
    if (!id || !session || !user) {
      res.status(401).json({ error: "Sign in required" });
      return;
    }
    (req as LabRequest).labUser = user;
    next();
  } catch {
    (req as LabRequest).labUser = { id: 108, email: "superadmin@peopleflow.test", fullName: "Avery Chen", role: "SUPER_ADMIN" };
    next();
  }
}

function currentUser(req: Request): User {
  return (req as LabRequest).labUser!;
}

function appendLog(req: Request) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    body: req.body ?? {},
  });
  labLogs.unshift(line);
  if (labLogs.length > 80) labLogs.pop();
  console.log(line);
}

router.use((req, _res, next) => {
  appendLog(req);
  next();
});

router.get("/session", (req, res) => {
  const sessionId = ensureSession(req, res);
  res.json({ sessionId, authenticated: Boolean(sessions.get(sessionId)?.userId) });
});

router.post("/login", (req, res) => {
  const email = String(req.body?.email ?? "");
  const password = String(req.body?.password ?? "");
  const row = db.prepare("SELECT id FROM employees WHERE email = ?").get(email) as { id: number } | undefined;
  if (!row) {
    res.status(401).json({ error: "No account exists for that email address." });
    return;
  }
  const passwordRow = db.prepare("SELECT id FROM employees WHERE email = ? AND password_md5 = ?").get(email, md5(password)) as { id: number } | undefined;
  if (!passwordRow) {
    res.status(401).json({ error: "The password you entered is incorrect." });
    return;
  }
  const sessionId = ensureSession(req, res);
  sessions.set(sessionId, { userId: passwordRow.id });
  res.json({ user: getUser(passwordRow.id), sessionId, warning: "Training session established." });
});

router.post("/logout", (req, res) => {
  const id = sessionIdFromRequest(req);
  if (id) sessions.delete(id);
  res.setHeader("Set-Cookie", "pf_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.json({ message: "Signed out." });
});
router.get("/logout", (req, res) => {
  const id = sessionIdFromRequest(req);
  if (id) sessions.delete(id);
  res.setHeader("Set-Cookie", "pf_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.json({ message: "Signed out." });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(currentUser(req));
});

router.get("/dashboard", requireAuth, (req, res) => {
  const people = allEmployees();
  res.json({
    employeeCount: people.length,
    payrollTotal: people.reduce((total, employee) => total + employee.salary, 0),
    pendingReviews: 3,
    currentUser: currentUser(req),
  });
});

router.get("/employees", requireAuth, (req, res) => {
  const search = String(req.query.search ?? "");
  const sql = search
    ? `SELECT * FROM employees WHERE full_name LIKE '%${search}%' OR email LIKE '%${search}%' ORDER BY id`
    : "SELECT * FROM employees ORDER BY id";
  try {
    const matches = (db.prepare(sql).all() as Record<string, unknown>[]).map((row) => employeeFromRow(row));
    res.json(matches);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Query failed",
      stack: error instanceof Error ? error.stack : "Unknown failure",
      database: "sqlite::memory:",
    });
  }
});

router.get("/profile", requireAuth, (req, res) => {
  res.json(getEmployee(currentUser(req).id));
});

router.get("/employees/:id", requireAuth, (req, res) => {
  const employee = getEmployee(Number(req.params.id));
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(employee);
});

router.get("/employee-view/:id", requireAuth, (req, res) => {
  const employee = getEmployee(Number(req.params.id));
  if (!employee) {
    res.status(404).send("Employee not found");
    return;
  }
  const html = ejs.render(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Employee record</title><style>body{font:16px system-ui;margin:32px;color:#1e293b}main{max-width:720px;margin:auto;border:1px solid #dbe3ee;border-radius:16px;padding:24px}.label{color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.bio{margin-top:8px;padding:14px;background:#f8fafc;border-radius:12px}</style></head><body><main><p class="label">Employee record</p><h1><%= employee.fullName %></h1><p><%= employee.email %> · <%= employee.department %></p><p><strong>SSN:</strong> <%= employee.ssn %></p><p><strong>Bank:</strong> <%= employee.bankAccount %></p><div class="bio"><%- employee.bio %></div></main></body></html>`, { employee });
  res.type("html").send(html);
});

router.get("/employee-search-view", requireAuth, (req, res) => {
  const search = String(req.query.search ?? "");
  const html = ejs.render(`<!doctype html><html><head><meta charset="utf-8"><title>Directory search</title></head><body><main><h1>Directory</h1><p>Search results for: <%- search %></p><p>Matches: <%= count %></p></main></body></html>`, {
    search,
    count: allEmployees().filter((employee) => employee.fullName.toLowerCase().includes(search.toLowerCase())).length,
  });
  res.type("html").send(html);
});

router.get("/employees/:id/payslip", requireAuth, (req, res) => {
  const employee = getEmployee(Number(req.params.id));
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json({
    employeeId: employee.id,
    employeeName: employee.fullName,
    period: "September 2026",
    grossPay: Math.round((employee.salary / 12) * 100) / 100,
    netPay: Math.round((employee.salary / 12 * 0.73) * 100) / 100,
    bankAccount: employee.bankAccount,
  });
});

const editableColumns: Record<string, string> = {
  fullName: "full_name",
  bio: "bio",
  bankAccount: "bank_account",
  salary: "salary",
  role: "role",
};
router.patch("/profile", requireAuth, (req, res) => {
  const updates = Object.entries(editableColumns).filter(([field]) => Object.hasOwn(req.body ?? {}, field));
  if (updates.length) {
    const values = updates.map(([field]) => req.body[field]);
    const set = updates.map(([field, column]) => `${column} = ?`).join(", ");
    db.prepare(`UPDATE employees SET ${set} WHERE id = ?`).run(...values, currentUser(req).id);
  }
  res.json(getEmployee(currentUser(req).id));
});
router.post("/profile/update", requireAuth, (req, res) => {
  const updates = Object.entries(editableColumns).filter(([field]) => Object.hasOwn(req.body ?? {}, field));
  if (updates.length) {
    const values = updates.map(([field]) => req.body[field]);
    const set = updates.map(([, column]) => `${column} = ?`).join(", ");
    db.prepare(`UPDATE employees SET ${set} WHERE id = ?`).run(...values, currentUser(req).id);
  }
  res.json(getEmployee(currentUser(req).id));
});

router.get("/admin/users", requireAuth, (_req, res) => {
  res.json(allEmployees().map(({ id, email, fullName, role }) => ({ id, email, fullName, role })));
});
router.get("/admin", requireAuth, (_req, res) => {
  res.json(allEmployees().map(({ id, email, fullName, role }) => ({ id, email, fullName, role })));
});

router.post("/admin/role", requireAuth, (req, res) => {
  const userId = Number(req.body?.userId);
  const role = String(req.body?.role ?? "");
  db.prepare("UPDATE employees SET role = ? WHERE id = ?").run(role, userId);
  const user = getUser(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.get("/documents", requireAuth, (req, res) => {
  const rawFilter = req.query.filter;
  let matches = documents;
  if (typeof rawFilter === "string" && rawFilter) {
    matches = documents.filter((doc) => `${doc.title} ${doc.type} ${doc.body}`.toLowerCase().includes(rawFilter.toLowerCase()));
  } else if (rawFilter && typeof rawFilter === "object") {
    const filter = rawFilter as Record<string, unknown>;
    const employeeIdFilter = filter.employee_id ?? filter.employeeId;
    if (employeeIdFilter && typeof employeeIdFilter === "object" && "$ne" in employeeIdFilter) {
      const excluded = Number((employeeIdFilter as Record<string, unknown>)["$ne"]);
      matches = documents.filter((doc) => doc.employeeId !== excluded);
    } else if (employeeIdFilter !== undefined) {
      matches = documents.filter((doc) => doc.employeeId === Number(employeeIdFilter));
    }
    const typeFilter = filter.type;
    if (typeof typeFilter === "string") matches = matches.filter((doc) => doc.type === typeFilter);
  }
  res.json(matches);
});

router.post("/forgot-password", (req, res) => {
  const email = String(req.body?.email ?? "");
  const row = db.prepare("SELECT id FROM employees WHERE email = ?").get(email) as { id: number } | undefined;
  if (!row) {
    res.status(404).json({ error: "No account exists for that email address." });
    return;
  }
  const token = String(resetSequence++);
  resetTokens.set(token, row.id);
  res.json({ message: "Password reset token created.", token });
});
router.get("/forgot-password", (_req, res) => {
  res.type("html").send("<!doctype html><html><body><h1>Reset password</h1><p>Use the PeopleFlow app to request a training reset token.</p></body></html>");
});
router.get("/reset", (req, res) => {
  res.json({ token: String(req.query.token ?? "") });
});

router.post("/reset-password", (req, res) => {
  const token = String(req.body?.token ?? "");
  const password = String(req.body?.password ?? "");
  const userId = resetTokens.get(token);
  if (!userId) {
    res.status(400).json({ error: "Reset token is not valid." });
    return;
  }
  db.prepare("UPDATE employees SET password_md5 = ? WHERE id = ?").run(md5(password), userId);
  res.json({ message: "Password updated." });
});

router.get("/config", (_req, res) => {
  res.json({
    app: "PeopleFlow",
    sessionSecret: trainingSessionSecret,
    thirdPartyKey: "pf_test_FAKE_ONLY_123456",
    environment: "local-training",
    database: "SQLite in-memory",
    documentStore: "in-memory Mongo-style fixture collection",
  });
});

router.get("/admin/tools", requireAuth, (req, res) => {
  const target = String(req.query.target ?? "localhost");
  const output = /[;&|`$<>]/.test(target)
    ? "Simulation: command metacharacters detected; no shell command was executed."
    : `Simulation: diagnostic check for ${target} completed.`;
  res.json({ target, output, simulated: true });
});

router.post("/import", requireAuth, (req, res) => {
  const body = req.body ?? {};
  const employees = Array.isArray(body.employees) ? body.employees : [];
  const prototypeKeySeen = Object.prototype.hasOwnProperty.call(body, "__proto__") ||
    employees.some((employee: unknown) => employee && typeof employee === "object" && Object.prototype.hasOwnProperty.call(employee, "__proto__"));
  res.json({
    accepted: employees.length,
    simulated: true,
    message: prototypeKeySeen
      ? "Simulation detected a prototype-style key. No prototype was changed and no code was executed."
      : "Payload parsed for the import simulation; no database records were changed.",
  });
});

router.get("/logs", (_req, res) => {
  res.json(labLogs);
});

router.post("/lab/reset", (_req, res) => {
  seedDatabase();
  sessions.clear();
  resetTokens.clear();
  labLogs.splice(0, labLogs.length);
  sessionSequence = 1;
  resetSequence = 4100;
  res.setHeader("Set-Cookie", "pf_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.json({ message: "Training data and sessions restored." });
});

export default router;
