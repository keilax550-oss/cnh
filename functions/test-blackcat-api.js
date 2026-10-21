// @ts-nocheck
/**
 * FUNÇÃO DE TESTE — remover após validar
 * Acesse: https://seu-site.netlify.app/api/test-blackcat
 */

const BLACKCAT_BASE = "https://api.blackcatoficial.com/api";

function gerarCpfValido() {
  const d = Array.from({length:9}, () => Math.floor(Math.random()*9));
  let soma = d.reduce((a,v,i) => a+v*(10-i), 0), resto = soma%11;
  d[9] = resto<2 ? 0 : 11-resto;
  soma = d.reduce((a,v,i) => a+v*(11-i), 0); resto = soma%11;
  d[10] = resto<2 ? 0 : 11-resto;
  return d.join("");
}

function jsonResponse(statusCode, body) {
  return { statusCode, headers:{"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*"}, body:JSON.stringify(body, null, 2) };
}

exports.handler = async (event) => {
  const BLACKCAT_API_KEY = process.env.BLACKCAT_API_KEY;
  if (!BLACKCAT_API_KEY) return jsonResponse(500, { erro:"BLACKCAT_API_KEY não configurada" });

  const cpf = gerarCpfValido();

  // Payload correto conforme docs.blackcatoficial.com
  const payload = {
    amount:        6570,
    currency:      "BRL",
    paymentMethod: "pix",
    items: [{ name:"SHOPIFY LOJA 03", quantity:1, price:6570, tangible:false }],
    customer: {
      name:     "Teste Silva",
      email:    "teste@blackcat.com",
      phone:    "11999999999",
      document: { number: cpf, type: "cpf" },
    },
    pix: { expiresInDays: 1 },
    externalRef: `TEST-${Date.now()}`,
  };

  let createStatus, createBody;
  try {
    const resp = await fetch(`${BLACKCAT_BASE}/sales/create-sale`, {
      method:"POST",
      headers:{"Content-Type":"application/json","X-API-Key":BLACKCAT_API_KEY},
      body:JSON.stringify(payload),
    });
    createStatus = resp.status;
    const text = await resp.text();
    try { createBody = JSON.parse(text); } catch { createBody = text; }
  } catch (err) {
    return jsonResponse(502, { erro:"Falha de conexão: "+err.message });
  }

  const id = createBody?.id || createBody?.transactionId || createBody?.transaction_id || createBody?.saleId || createBody?.data?.id;
  const code = createBody?.pix?.qrCode || createBody?.pix?.brcode || createBody?.pix?.copyPaste || createBody?.pix?.copy_paste || createBody?.qrCode || createBody?.brcode || createBody?.data?.pix?.qrCode || createBody?.data?.qrCode;
  const b64  = createBody?.pix?.qrCodeImage || createBody?.qrCodeImage || createBody?.data?.pix?.qrCodeImage;

  const analysis = {
    http_status:  createStatus,
    cpf_usado:    cpf,
    raw_response: createBody,
    campo_id:     id    || "⚠️ NÃO ENCONTRADO",
    campo_pix:    code  ? code.slice(0,60)+"..." : "⚠️ NÃO ENCONTRADO",
    campo_base64: b64   ? "✓ presente" : "ausente",
    campos_raiz:  Object.keys(createBody||{}),
    campos_pix:   createBody?.pix  ? Object.keys(createBody.pix)  : "sem .pix",
    campos_data:  createBody?.data ? Object.keys(createBody.data) : "sem .data",
  };

  // Se criou com sucesso, testa consulta de status
  let statusCheck = null;
  if (id && createStatus < 300) {
    try {
      const r2 = await fetch(`${BLACKCAT_BASE}/sales/${encodeURIComponent(id)}`, {
        method:"GET", headers:{"Content-Type":"application/json","X-API-Key":BLACKCAT_API_KEY},
      });
      const t2 = await r2.text();
      let b2; try { b2 = JSON.parse(t2); } catch { b2 = t2; }
      const rawStatus = b2?.status || b2?.payment_status || b2?.paymentStatus || b2?.data?.status;
      statusCheck = {
        http_status:  r2.status,
        raw_response: b2,
        campo_status: rawStatus || "⚠️ NÃO ENCONTRADO",
        campos_raiz:  Object.keys(b2||{}),
        campos_data:  b2?.data ? Object.keys(b2.data) : "sem .data",
      };
    } catch (err) { statusCheck = { erro:err.message }; }
  }

  return jsonResponse(200, {
    "1_criar_pix":        analysis,
    "2_consultar_status": statusCheck || "não executado (criação falhou)",
    "3_resultado":        createStatus < 300 ? "✅ PRONTO PARA DEPLOY" : "❌ Verificar erro acima",
  });
};
