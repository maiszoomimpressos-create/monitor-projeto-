import { test } from "node:test";
import assert from "node:assert/strict";
import { assertWellFormedHttpUrl, isPrivateOrReservedIp, UnsafeUrlError } from "./ssrf";
import { classifyHttpStatus, performSingleHttpCheck } from "./httpCheck";

test("URL HTTP: aceita https público", () => {
  assert.equal(assertWellFormedHttpUrl("https://meu-app.onrender.com/").hostname, "meu-app.onrender.com");
  assert.equal(assertWellFormedHttpUrl("https://exemplo.com:443/saude").pathname, "/saude");
  assert.equal(assertWellFormedHttpUrl("https://8.8.8.8/").hostname, "8.8.8.8");
});

test("URL HTTP: bloqueia esquemas, credenciais, portas e destinos internos", () => {
  const bad = [
    "http://exemplo.com/",
    "ftp://exemplo.com/",
    "https://user:senha@exemplo.com/",
    "https://exemplo.com:8080/",
    "https://localhost/",
    "https://app.localhost/",
    "https://servidor.internal/",
    "https://impressora.local/",
    "https://intranet/",
    "https://127.0.0.1/",
    "https://10.1.2.3/",
    "https://192.168.0.10/",
    "https://172.16.5.4/",
    "https://169.254.169.254/latest/meta-data/",
    "https://100.64.0.1/",
    "https://[::1]/",
    "https://[fd00:ec2::254]/",
    "https://[fe80::1]/",
    "https://[::ffff:127.0.0.1]/",
    "https://metadata.google.internal/",
    "nao-e-url",
  ];
  for (const u of bad) {
    assert.throws(() => assertWellFormedHttpUrl(u), UnsafeUrlError, u);
  }
});

test("IPs privados/reservados", () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "0.0.0.0", "::1", "fc00::1", "64:ff9b::a00:1", "ff02::1"]) {
    assert.equal(isPrivateOrReservedIp(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) {
    assert.equal(isPrivateOrReservedIp(ip), false, ip);
  }
});

test("classificação: sem status esperado, 2xx/3xx = sucesso", () => {
  assert.equal(classifyHttpStatus(200, null).status, "SUCESSO");
  assert.equal(classifyHttpStatus(204, null).status, "SUCESSO");
  assert.equal(classifyHttpStatus(301, null).status, "SUCESSO");
  assert.equal(classifyHttpStatus(401, null).status, "FALHA_AUTENTICACAO");
  assert.equal(classifyHttpStatus(404, null).status, "FALHA_CONFIGURACAO");
  assert.equal(classifyHttpStatus(503, null).status, "FALHA_CONEXAO");
  assert.equal(classifyHttpStatus(429, null).status, "ERRO_DESCONHECIDO");
});

test("classificação: com status esperado", () => {
  assert.equal(classifyHttpStatus(204, 204).status, "SUCESSO");
  assert.equal(classifyHttpStatus(200, 204).status, "FALHA_CONFIGURACAO");
  assert.equal(classifyHttpStatus(502, 200).status, "FALHA_CONEXAO");
});

test("checagem recusa URL interna sem fazer requisição", async () => {
  const r = await performSingleHttpCheck({ url: "https://127.0.0.1/" });
  assert.equal(r.status, "FALHA_CONFIGURACAO");
  assert.equal(r.httpStatus, null);
});

test("e-mail da conta: opcional, validado, vazio vira null", async () => {
  const { projectInputSchema, projectUpdateSchema } = await import("./validation");
  const base = { name: "a", supabaseUrl: "https://x.com", type: "HTTP" as const };
  assert.equal(projectInputSchema.parse(base).accountEmail, undefined);
  assert.equal(projectInputSchema.parse({ ...base, accountEmail: "" }).accountEmail, null);
  assert.equal(projectInputSchema.parse({ ...base, accountEmail: " Ana@Exemplo.com " }).accountEmail, "ana@exemplo.com");
  assert.equal(projectInputSchema.safeParse({ ...base, accountEmail: "nao-e-email" }).success, false);
  assert.equal(projectInputSchema.safeParse({ ...base, accountEmail: `${"a".repeat(250)}@x.com` }).success, false);
  assert.deepEqual(projectUpdateSchema.parse({ enabled: false }), { enabled: false });
});
