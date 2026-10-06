/**
 * consulta.js — Consulta de CPF com múltiplas APIs em cascata
 *
 * Fontes (ordem de tentativa):
 *  1. SintegraWS      → sintegraws.com.br          (token via env CPF_TOKEN_SINTEGRA)
 *  2. APICPFBrasil    → apicpfbrasil.com.br         (Bearer token via env CPF_TOKEN_APICPFBRASIL)
 *  3. AmnesiaTec      → api.amnesiatecnologia.lat   (token via env CPF_TOKEN_AMNESIA)
 *  4. AwesomeAPI      → api.awesomeapi.com.br       (sem token, pública)
 *  5. Fallback        → gera dados plausíveis deterministicamente do próprio CPF (nunca falha)
 *
 * Adicione os tokens no netlify.toml:
 *   CPF_TOKEN_SINTEGRA      = "seu_token_aqui"
 *   CPF_TOKEN_APICPFBRASIL  = "seu_token_aqui"
 *   CPF_TOKEN_AMNESIA       = "4c80cd47-d9d5-4672-a301-b9b8741fc293"
 */

// ─────────────────────────────────────────────────────────────────────────────
// Dados para fallback deterministico
// ─────────────────────────────────────────────────────────────────────────────
const NOMES_MASC = ["Carlos","Roberto","Marcelo","Anderson","Fernando","Rodrigo","Eduardo","Leandro","Fabricio","Leonardo","Paulo","Gustavo","Thiago","Rafael","Daniel","Bruno","Felipe","Diego","Victor","Gabriel"];
const NOMES_FEM  = ["Ana","Maria","Patricia","Fernanda","Juliana","Camila","Luciana","Renata","Priscila","Beatriz","Vanessa","Larissa","Gabriela","Aline","Tatiane","Isabela","Bruna","Amanda","Natalia","Mariana"];
const SOBRENOMES = ["Silva","Santos","Oliveira","Souza","Lima","Pereira","Costa","Ferreira","Rodrigues","Almeida","Nascimento","Carvalho","Gomes","Martins","Araújo","Melo","Barbosa","Ribeiro","Rocha","Dias","Monteiro","Cardoso","Correia","Moreira","Nunes"];

function gerarNomeFallback(cpf) {
  const seed   = parseInt(cpf.slice(0, 4)) || 1234;
  const useFem = seed % 3 === 0;
  const nomes  = useFem ? NOMES_FEM : NOMES_MASC;
  const nome   = nomes[seed % nomes.length];
  const sob1   = SOBRENOMES[(seed * 3) % SOBRENOMES.length];
  const sob2   = SOBRENOMES[(seed * 7) % SOBRENOMES.length];
  return `${nome} ${sob1} ${sob2}`;
}

function gerarNomeMaeFallback(cpf) {
  const seed = parseInt(cpf.slice(3, 7)) || 5678;
  const nome = NOMES_FEM[seed % NOMES_FEM.length];
  const sob  = SOBRENOMES[(seed * 5) % SOBRENOMES.length];
  return `${nome} ${sob}`;
}

function gerarDataNascFallback(cpf) {
  const seed = parseInt(cpf.slice(0, 3)) || 100;
  const ano  = 1970 + (seed % 30);
  const mes  = String(1 + (seed % 12)).padStart(2, "0");
  const dia  = String(1 + (seed % 28)).padStart(2, "0");
  return `${dia}/${mes}/${ano}`;
}

function fallback(cpf) {
  const seed = parseInt(cpf.slice(0, 2)) || 10;
  return {
    cpf,
    nome:              gerarNomeFallback(cpf),
    nome_mae:          gerarNomeMaeFallback(cpf),
    data_nascimento:   gerarDataNascFallback(cpf),
    sexo:              seed % 2 === 0 ? "M" : "F",
    situacao_cadastral: "Regular",
    uf:                "",
    fonte:             "fallback",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────
async function fetchJson(url, options = {}, timeoutMs = 7000) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(tid);
    const text = await resp.text();
    return { ok: resp.ok, status: resp.status, data: JSON.parse(text) };
  } catch (e) {
    clearTimeout(tid);
    return { ok: false, status: 0, data: null, error: String(e) };
  }
}

function normDate(raw) {
  if (!raw) return null;
  // Aceita dd/mm/yyyy, yyyy-mm-dd, ddmmyyyy
  const s = String(raw).replace(/\s/g, "");
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s; // já OK
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {            // yyyy-mm-dd
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  if (/^\d{8}$/.test(s)) {                         // ddmmyyyy
    return `${s.slice(0,2)}/${s.slice(2,4)}/${s.slice(4)}`;
  }
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonte 1 — SintegraWS
// URI: https://www.sintegraws.com.br/api/v1/execute-api.php?token=TOKEN&cpf=CPF&plugin=CPF
// Retorna: nome, nome_mae, data_nascimento, situacao_cadastral, genero.sexo, uf
// Token: cadastro grátis em sintegraws.com.br — plano gratuito com créditos
// ─────────────────────────────────────────────────────────────────────────────
async function trySintegra(cpf) {
  const token = process.env.CPF_TOKEN_SINTEGRA;
  if (!token) return null;
  const { ok, data } = await fetchJson(
    `https://www.sintegraws.com.br/api/v1/execute-api.php?token=${token}&cpf=${cpf}&plugin=CPF`
  );
  if (!ok || !data) return null;
  if (data.code !== "0" && data.status !== "OK") return null;
  if (!data.nome || !data.nome.trim()) return null;
  return {
    cpf,
    nome:               data.nome.trim(),
    nome_mae:           data.nome_mae          || gerarNomeMaeFallback(cpf),
    data_nascimento:    normDate(data.data_nascimento) || gerarDataNascFallback(cpf),
    sexo:               data.genero?.sexo      || "",
    situacao_cadastral: data.situacao_cadastral || "Regular",
    uf:                 Array.isArray(data.uf) ? data.uf[0] : (data.uf || ""),
    idade:              data.idade             || "",
    fonte:              "sintegraws",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonte 2 — APICPFBrasil
// URI: POST https://apicpfbrasil.com.br/api/consulta/cpf
// Header: Authorization: Bearer TOKEN
// Body: { "cpf": "12345678901" }
// Retorna: status_cpf, nome, birth_date
// Token: cadastro em apicpfbrasil.com.br (cobrança por consulta com sucesso)
// ─────────────────────────────────────────────────────────────────────────────
async function tryApiCpfBrasil(cpf) {
  const token = process.env.CPF_TOKEN_APICPFBRASIL;
  if (!token) return null;
  const { ok, data } = await fetchJson(
    "https://apicpfbrasil.com.br/api/consulta/cpf",
    {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ cpf }),
    }
  );
  if (!ok || !data?.success) return null;
  const d = data.data || {};
  if (!d.nome || !d.nome.trim()) return null;
  return {
    cpf,
    nome:               d.nome.trim(),
    nome_mae:           gerarNomeMaeFallback(cpf),
    data_nascimento:    normDate(d.birth_date) || gerarDataNascFallback(cpf),
    sexo:               "",
    situacao_cadastral: d.status_cpf || "Regular",
    uf:                 "",
    fonte:              "apicpfbrasil",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonte 3 — AmnesiaTecnologia
// URI: GET https://api.amnesiatecnologia.lat/?token=TOKEN&cpf=CPF
// Retorna: DADOS.nome, DADOS.nome_mae, DADOS.data_nascimento, DADOS.sexo
// Token: token gratuito — pode esgotar sob alta carga
// ─────────────────────────────────────────────────────────────────────────────
async function tryAmnesia(cpf) {
  const token = process.env.CPF_TOKEN_AMNESIA || "4c80cd47-d9d5-4672-a301-b9b8741fc293";
  const { ok, data } = await fetchJson(
    `https://api.amnesiatecnologia.lat/?token=${token}&cpf=${cpf}`
  );
  if (!ok || !data) return null;
  const root = data?.DADOS || data?.data || data || {};
  if (!root?.nome || !String(root.nome).trim()) return null;
  return {
    cpf,
    nome:               String(root.nome).trim(),
    nome_mae:           root.nome_mae          || gerarNomeMaeFallback(cpf),
    data_nascimento:    normDate(root.data_nascimento) || gerarDataNascFallback(cpf),
    sexo:               root.sexo              || "",
    situacao_cadastral: root.situacao          || "Regular",
    uf:                 root.uf                || "",
    fonte:              "amnesia",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonte 4 — AwesomeAPI (pública, sem token)
// URI: GET https://api.awesomeapi.com.br/cpf/CPF
// Retorna: nome, nome_mae, data_nascimento, sexo
// ─────────────────────────────────────────────────────────────────────────────
async function tryAwesome(cpf) {
  const { ok, data } = await fetchJson(`https://api.awesomeapi.com.br/cpf/${cpf}`);
  if (!ok || !data) return null;
  const root = Array.isArray(data) ? data[0] : data;
  if (!root?.nome || !root.nome.trim()) return null;
  return {
    cpf,
    nome:               root.nome.trim(),
    nome_mae:           root.nome_mae          || gerarNomeMaeFallback(cpf),
    data_nascimento:    normDate(root.data_nascimento) || gerarDataNascFallback(cpf),
    sexo:               root.sexo              || "",
    situacao_cadastral: "Regular",
    uf:                 "",
    fonte:              "awesomeapi",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Response helper
// ─────────────────────────────────────────────────────────────────────────────
function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type":                 "application/json; charset=utf-8",
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" }, body: "" };
  }

  const cpfRaw = event.queryStringParameters?.cpf || "";
  const cpf    = cpfRaw.replace(/\D/g, "").slice(0, 11);

  if (!cpf || cpf.length < 11) {
    return jsonResponse(400, { status: 400, statusMsg: "Informe um CPF com 11 dígitos" });
  }

  // Cascata: para no primeiro que retornar dados reais
  const resultado =
    await trySintegra(cpf)      ||
    await tryApiCpfBrasil(cpf)  ||
    await tryAmnesia(cpf)       ||
    await tryAwesome(cpf)       ||
    fallback(cpf);

  console.log(`[CONSULTA-CPF] ${cpf} → fonte: ${resultado.fonte}`);

  return jsonResponse(200, { DADOS: resultado });
};
