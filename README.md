# PeopleFlow

PeopleFlow is a people operations workspace for Northstar Studio. It brings employee
records, payslips, profile editing, an admin role console, document search, system
configuration, diagnostic and import tools, and activity logs together in one place.

This README documents a security assessment of the application. All records are
fabricated, and the service runs against an in-memory store that resets on restart.
Run the assessment only against your own instance.

## Run the app

The project uses two services:

- PeopleFlow web app: open the project preview.
- API: served under `/api` on the same origin.

Set the base origin you are testing, with no trailing slash. Locally this is the
dev server:

```text
http://localhost:80
```

If you deploy to Vercel (see [DEPLOYMENT.md](DEPLOYMENT.md)), use your deployment
origin instead, for example `https://your-app.vercel.app`. The `/api` routes live
on that same origin, so the steps below are unchanged.

## Accounts

All accounts are fabricated. Passwords are the seeded values and are safe to use
only against your own instance. The `id` column is the employee id used when
tampering with `/api/employees/:id` requests.

| id  | Name         | Email                        | Password     | Role         | Department        |
| --- | ------------ | ---------------------------- | ------------ | ------------ | ----------------- |
| 101 | Alice Morgan | `alice@peopleflow.test`      | `alice123`   | EMPLOYEE     | Customer Success  |
| 102 | Bob Bennett  | `bob@peopleflow.test`        | `bob123`     | EMPLOYEE     | Sales             |
| 103 | Morgan Reyes | `manager@peopleflow.test`    | `managerpass`| MANAGER      | Customer Success  |
| 104 | Jordan Patel | `hr@peopleflow.test`         | `hrpass`     | HR_ADMIN     | People Operations |
| 105 | Taylor Kim   | `taylor@peopleflow.test`     | `taylor123`  | EMPLOYEE     | Finance           |
| 106 | Casey Brown  | `casey@peopleflow.test`      | `casey123`   | EMPLOYEE     | Engineering       |
| 107 | Riley Shah   | `riley@peopleflow.test`      | `riley123`   | EMPLOYEE     | Operations        |
| 108 | Avery Chen   | `superadmin@peopleflow.test` | `Admin@123`  | SUPER_ADMIN  | IT                |

Use `alice@peopleflow.test` / `alice123` as the default low-privilege account for
the access-control findings: it is an ordinary `EMPLOYEE`, so anything it can reach
beyond its own record demonstrates a broken boundary.

Records and reset tokens live in memory and return to these seeded values when the
API process restarts. To restore the seeded state during a session, replay
`POST /api/lab/reset` from Burp Repeater (see "Restoring state" below). A password
changed through the reset-password flow reverts on the next restart or reset.

## Testing with Burp Suite

These steps assume Burp Suite (Community or Professional) with the browser proxying
through Burp's listener (default `127.0.0.1:8080`).

1. In Burp, open **Proxy → Options** and confirm the listener is running.
2. Point your browser at the Burp proxy and install Burp's CA certificate so HTTPS
   intercepts cleanly.
3. Browse to the app and sign in as the candidate account above. Burp's **Proxy →
   HTTP history** now records the session cookie (`pf_session`) and every `/api`
   request.
4. Right-click any captured `/api` request and choose **Send to Repeater** to replay
   and tamper with it. The session cookie rides along with each replayed request, so
   you stay authenticated as Alice.

Keep a separate browser profile (or Burp project) per exercise so cookies do not mix.

## Findings and reproductions

The directory UI is a benign company directory: it lists names, departments, roles,
and contact details, and each person can see only their own full record and payslip.
The findings below are reached by tampering with requests in Burp, not by reading the
rendered pages.

### A01 — Broken access control: IDOR, BOLA, and role escalation

**Impact:** Any signed-in employee can read other employees' records and payslips by
changing an ID in the request. The admin API checks for a session but not the caller's
role. Profile updates also accept `role` and `salary` fields.

**Reproduce employee and payslip access (IDOR/BOLA):**

1. As Alice, open your own record in the directory and send the resulting
   `GET /api/employees/101` request to **Repeater**.
2. In Repeater, change the path ID to another employee, e.g.
   `GET /api/employees/108`, and click **Send**. The response returns employee 108's
   full record, including the `ssn` and `bankAccount` fields that the directory UI
   never displays for other people.
3. Repeat for the payslip: change `GET /api/employees/101/payslip` to
   `GET /api/employees/108/payslip`.
4. To sweep the whole directory, send one `GET /api/employees/{id}` request to
   **Intruder**, mark the ID as the payload position, and run a numeric payload
   (for example 101–108).

**Reproduce role escalation through the admin API:**

1. Send a captured `/api` request to **Repeater** and change it to
   `POST /api/admin/role`.
2. Set the `Content-Type` header to `application/json` and the body to:

   ```json
   {"userId":101,"role":"SUPER_ADMIN"}
   ```

3. **Send**, then replay `GET /api/admin` to confirm Alice now holds `SUPER_ADMIN`.

**Reproduce mass assignment through profile update:**

1. In **Repeater**, build `POST /api/profile/update` with a JSON body:

   ```json
   {"role":"SUPER_ADMIN","salary":-50000,"bankAccount":"0000000099999"}
   ```

2. **Send**. The same fields are also accepted through `PATCH /api/profile`.

### A02 — Security misconfiguration

**Impact:** The config endpoint discloses internal values, error handling returns
stack details, and API CORS allows any origin.

**Reproduce config exposure:** in **Repeater**, send `GET /api/config`. The response
includes `sessionSecret` (`secret123`) and `thirdPartyKey`
(`pf_test_FAKE_ONLY_123456`).

**Reproduce verbose error output:** in **Repeater**, send
`GET /api/employees?search=' OR` (an unclosed quote followed by `OR`). The response
includes the SQL error, a stack trace, and the `sqlite::memory:` database label.

**Check CORS:** in **Repeater**, add an `Origin: https://example.invalid` header to
`GET /api/config` and send. Look for `Access-Control-Allow-Origin: *` in the response
headers.

### A03 — Software supply-chain failures

**Status:** Not present as a live issue. The application does not install
known-vulnerable packages or load an unpinned external script. For a code review,
inspect `package.json` and the built page's script sources rather than inferring a
vulnerable dependency from this README.

### A04 — Cryptographic failures

**Impact:** Passwords are stored as unsalted MD5 hashes; SSNs and bank-account values
are stored as plaintext in the in-memory SQLite database. Session cookies use an
HMAC-SHA256 signature made with the weak key disclosed by `/api/config`.

**Reproduce the exposed PII:** use the A01 IDOR step in **Repeater** to read
`GET /api/employees/108`; the response returns the SSN and bank-account fields in
plaintext.

**Source check:** inspect `artifacts/api-server/src/routes/peopleflow.ts`. The seed
creates `password_md5`, and the login path compares MD5 digests. The cookie value has
the form `session-id.signature`, where the signature is an HMAC-SHA256 over the
session ID with the disclosed key. The session ID is retained through login (see A07).

### A05 — Injection: SQL injection and cross-site scripting

**SQL injection:** employee search concatenates input into a SQLite `LIKE` query. In
**Repeater**, send:

```text
GET /api/employees?search=' OR '1'='1' -- 
```

The result returns all seeded employees rather than only matches.

**Reflected XSS:** in **Repeater** (or by pasting into the browser while proxied),
request:

```text
GET /api/employee-search-view?search=<img src=x onerror=alert(1)>
```

The server-rendered view includes the raw search text, so the payload executes. Use a
harmless `alert(1)` proof only.

**Stored XSS:** in **Repeater**, send `PATCH /api/profile` with:

```json
{"bio":"<img src=x onerror=alert(1)>"}
```

Then load `GET /api/employee-view/101` in the proxied browser. The EJS view renders
the bio without escaping, so the payload runs in that page's origin. Restore state
afterward.

**NoSQL-style operator injection:** the document fixture models Mongo query-operator
behavior in memory. In **Repeater**, send:

```text
GET /api/documents?filter[employee_id][$ne]=101
```

The operator-shaped filter returns documents not owned by employee 101.

### A06 — Insecure design and business-logic flaws

**Predictable, reusable reset token:** in **Repeater**, send `POST /api/forgot-password`
with:

```json
{"email":"alice@peopleflow.test"}
```

The first token in a fresh process is `4100`, and later tokens increment. Replay
`POST /api/reset-password` twice with the same token to confirm it has no expiry and
no single-use check:

```json
{"token":"4100","password":"change-1"}
```

```json
{"token":"4100","password":"change-2"}
```

**Unbounded salary update:** the A01 mass-assignment request sets a negative salary. No
approval or validation step is applied.

### A07 — Authentication failures

**Username enumeration:** in **Repeater**, send two `POST /api/login` requests and
compare the error messages:

```json
{"email":"nobody@peopleflow.test","password":"wrong"}
```

```json
{"email":"alice@peopleflow.test","password":"wrong"}
```

The messages differ, and there is no lockout or rate limit.

**Session fixation:** in **Repeater**, send `GET /api/session` to obtain a
pre-authentication session ID, then send `POST /api/login` with the same cookie. The
`sessionId` is reused after authentication instead of being rotated.

### A08 — Software/data integrity: import handling

**Status:** The import endpoint is modeled, not implemented with an unsafe
deserializer; it never executes code or changes `Object.prototype`. In **Repeater**,
send `POST /api/import` with:

```json
{"__proto__":{"flag":true},"employees":[]}
```

The response confirms the key was noticed and the payload was safely handled. This
shows where an integrity review belongs without providing a code-execution path.

### A09 — Security logging and alerting failures

**Impact:** There is no dedicated audit event for failed logins, role changes, or PII
reads. Separately, the request log records full request bodies, including passwords,
and the log endpoint requires no authentication. After making a login request, send
`GET /api/logs` in **Repeater** to read the captured bodies.

### A10 — Exceptional-condition handling and unsafe diagnostics

**Fail-open auth:** this header forces an auth-middleware exception, and the catch
branch continues with an admin identity. In **Repeater**, add the header
`x-lab-trigger: auth-error` to `GET /api/admin` and send. No login cookie is required.

**Command-injection check:** the diagnostic endpoint inspects a string and reports when
shell metacharacters are present, but never invokes a shell. In **Repeater**, send:

```text
GET /api/admin/tools?target=localhost; echo test
```

The response is marked `simulated: true`.

## Restoring state

To restore the seeded records, sessions, tokens, and request log, replay
`POST /api/lab/reset` from **Repeater**. The response confirms the data has been
restored.

## Implementation boundaries

- All employee records and passwords are fabricated. The SQLite database is in-memory
  and reseeded on process start.
- Document search uses a small in-memory Mongo-shaped fixture, not a live database.
- The import and diagnostic endpoints are safe: no shell command, unsafe deserializer,
  or user-supplied code is executed.
- A03 is not present as a live issue: the app does not install known-vulnerable
  dependencies or load an unpinned external script.
