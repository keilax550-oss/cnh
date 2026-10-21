// @ts-nocheck
const { getSupabase } = require("./lib/supabase");

const BLACKCAT_BASE = "https://api.blackcatoficial.com/api";

const utmifyCache = new Map();
const CACHE_TTL   = 60000;

async function sendUtmify(transactionId, status, customer, amountCents, createdAt, utms) {
  const UTMIFY_TOKEN = process.env.UTMIFY_TOKEN;
  if (!UTMIFY_TOKEN) return;
  if (utmifyCache.has(transactionId)) return;
  utmifyCache.set(transactionId, true);
  setTimeout(() => utmifyCache.delete(transactionId), CACHE_TTL);
  try {
    const gatewayFeeCents = Math.round(amountCents * 0.02);
    const payload = {
      orderId: transactionId, platform: "Blackcat", paymentMethod: "pix", status,
      createdAt: createdAt || new Date().toISOString().replace("T"," ").slice(0,19),
      approvedDate: status === "paid" ? new Date().toISOString().replace("T"," ").slice(0,19) : null,
      customer: { name: customer.name||null, email: customer.email||null, phone: customer.phone||null, document: customer.cpf||null, country:"BR", ip:"177.0.0.1" },
      products: [{ id:"loja-shopify-br-001", name:"SHOPIFY LOJA 03", quantity:1, priceInCents:amountCents }],
      trackingParameters: { utm_source:utms?.utm_source||null, utm_campaign:utms?.utm_campaign||null, utm_medium:utms?.utm_medium||null, utm_content:utms?.utm_content||null, utm_term:utms?.utm_term||null, src:utms?.src||null, sck:utms?.sck||null },
      commission: { totalPriceInCents:amountCents, gatewayFeeInCents:gatewayFeeCents, userCommissionInCents:amountCents-gatewayFeeCents, currency:"BRL" },
    };
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 3000);
    await fetch("https://api.utmify.com.br/api-credentials/orders", { method:"POST", headers:{"Content-Type":"application/json","x-api-token":UTMIFY_TOKEN}, body:JSON.stringify(payload), signal:ctrl.signal });
    clearTimeout(tid);
    console.log("[UTMify] ✓", transactionId);
  } catch (err) { console.error("[UTMify] Erro:", err.message); }
}

function jsonResponse(statusCode, body) {
  return { statusCode, headers:{"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}, body:JSON.stringify(body) };
}

function fmtPhone(phone) {
  if (!phone) return "11999999999";
  return phone.replace(/\D/g,"").slice(0,11) || "11999999999";
}

function gerarCpfValido() {
  const d = Array.from({length:9}, () => Math.floor(Math.random()*9));
  let soma = d.reduce((a,v,i) => a+v*(10-i), 0), resto = soma%11;
  d[9] = resto<2 ? 0 : 11-resto;
  soma = d.reduce((a,v,i) => a+v*(11-i), 0); resto = soma%11;
  d[10] = resto<2 ? 0 : 11-resto;
  return d.join("");
}

exports.handler = async (event) => {
  const BLACKCAT_API_KEY = process.env.BLACKCAT_API_KEY;
  const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("[PIX-BLACKCAT] Iniciando. API_KEY existe:", !!BLACKCAT_API_KEY);

  if (!BLACKCAT_API_KEY) return jsonResponse(500, { success:false, error:"Credenciais da gateway não configuradas", debug:"BLACKCAT_API_KEY não encontrada" });

  if (event.httpMethod === "OPTIONS") return { statusCode:204, headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}, body:"" };

  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { body = {}; }

  const rawAmount   = body.amount ?? body.valor ?? body.total ?? 65.70;
  const amountReais = Number(rawAmount) || 65.70;
  const amountCents = Math.round(amountReais * 100);

  const randId        = Math.random().toString(36).slice(2,10);
  const customerName  = (body.nome || body.name  || body.customer_name  || `Cliente ${randId}`).toString().trim();
  const customerEmail = (body.email || body.customer_email || `cliente${randId}@gmail.com`).toString().trim();
  const customerPhone = fmtPhone(body.phone || body.customer_phone || "11999999999");
  const cpfRaw        = (body.cpf  || body.document || body.customer_cpf || "").toString().replace(/\D/g,"");
  const customerCpf   = cpfRaw.length === 11 ? cpfRaw : gerarCpfValido();
  const utms          = body.utm || {};
  const externalRef   = body.reference || `AVENPAY-${Date.now()}-${randId}`;

  console.log("[PIX-BLACKCAT] Amount:", amountReais, "(", amountCents, "cts) | CPF:", customerCpf);

  // ── Payload conforme docs.blackcatoficial.com ──────────────────────────────
  const pixPayload = {
    amount:        amountCents,
    currency:      "BRL",
    paymentMethod: "pix",
    items: [{
      name:     "SHOPIFY LOJA 03",
      quantity: 1,
      price:    amountCents,
      tangible: false,
    }],
    customer: {
      name:     customerName,
      email:    customerEmail,
      phone:    customerPhone,
      document: {
        number: customerCpf,
        type:   "cpf",
      },
    },
    pix: { expiresInDays: 1 },
    externalRef,
    // UTMs ficam em metadata conforme docs
    utm_source:   utms.utm_source   || undefined,
    utm_medium:   utms.utm_medium   || undefined,
    utm_campaign: utms.utm_campaign || undefined,
    utm_content:  utms.utm_content  || undefined,
    utm_term:     utms.utm_term     || undefined,
  };

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 30000);

    const resp = await fetch(`${BLACKCAT_BASE}/sales/create-sale`, {
      method:  "POST",
      headers: { "Content-Type":"application/json", "X-API-Key":BLACKCAT_API_KEY },
      body:    JSON.stringify(pixPayload),
      signal:  controller.signal,
    });
    clearTimeout(timeout);

    const text = await resp.text();
    console.log("[PIX-BLACKCAT] HTTP:", resp.status, "| Body:", text.substring(0,300));

    if (!resp.ok) {
      let errMsg = text;
      try { errMsg = JSON.parse(text)?.message || JSON.parse(text)?.error || errMsg; } catch {}
      console.error("[Blackcat] Erro:", resp.status, errMsg);
      return jsonResponse(resp.status, { success:false, error:errMsg });
    }

    let parsed = {};
    try { parsed = JSON.parse(text); } catch {
      return jsonResponse(500, { success:false, error:"Resposta inválida da gateway", debug:text.substring(0,200) });
    }

    // Campos de resposta Blackcat: { success, data: { transactionId, paymentData: { qrCode, qrCodeBase64, copyPaste } } }
    const transactionId = String(
      parsed.data?.transactionId || parsed.data?.id ||
      parsed.id || parsed.transactionId || parsed.transaction_id ||
      parsed.saleId || parsed.sale_id || ""
    );

    const pixCode = (
      parsed.data?.paymentData?.copyPaste  ||
      parsed.data?.paymentData?.qrCode     ||
      parsed.data?.paymentData?.brcode     ||
      parsed.data?.paymentData?.pix_code   ||
      parsed.pix?.qrCode      || parsed.pix?.brcode || parsed.pix?.copyPaste ||
      parsed.qrCode           || parsed.brcode       || parsed.copypaste     ||
      parsed.data?.qrCode     || parsed.data?.brcode ||
      null
    );

    const pixBase64 = (
      parsed.data?.paymentData?.qrCodeBase64 ||
      parsed.data?.paymentData?.qrCodeImage  ||
      parsed.pix?.qrCodeImage || parsed.qrCodeImage ||
      parsed.data?.qrCodeImage ||
      null
    );

    if (!transactionId) {
      console.error("[Blackcat] ID não encontrado:", JSON.stringify(parsed).substring(0,300));
      return jsonResponse(500, { success:false, error:"Gateway não retornou ID da transação", debug:parsed });
    }
    if (!pixCode) {
      console.error("[Blackcat] PIX code não encontrado:", JSON.stringify(parsed).substring(0,300));
      return jsonResponse(500, { success:false, error:"Gateway não retornou código PIX", debug:parsed });
    }

    console.log("[PIX-BLACKCAT] ✅ Gerado:", transactionId);

    // ── Supabase ───────────────────────────────────────────────────────────
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const supabase = getSupabase();
        await supabase.from("transactions").insert({
          transaction_id: transactionId, amount:amountReais,
          customer_name:customerName, customer_email:customerEmail,
          customer_cpf:customerCpf, customer_phone:customerPhone,
          status:"pending", brcode:pixCode, gateway:"blackcat",
          external_ref:externalRef,
          utm_source:utms.utm_source||null, utm_campaign:utms.utm_campaign||null,
          utm_medium:utms.utm_medium||null, utm_content:utms.utm_content||null,
          utm_term:utms.utm_term||null,
        });
        console.log("[Supabase] ✓", transactionId);
      } catch (err) { console.error("[Supabase] Erro:", err.message); }
    }

    // ── UTMify ─────────────────────────────────────────────────────────────
    sendUtmify(transactionId, "waiting_payment",
      { name:customerName, email:customerEmail, phone:customerPhone, cpf:customerCpf },
      amountCents, new Date().toISOString().replace("T"," ").slice(0,19), utms
    ).catch(() => {});

    return jsonResponse(200, {
      success:true, pixCode, pix_code:pixCode, brcode:pixCode,
      payload:pixCode, qr_code:pixCode,
      qr_code_base64:pixBase64, qr_code_image:pixBase64,
      transaction_id:transactionId, transactionId, deposit_id:transactionId,
      reference:externalRef, expires_at:parsed.expiresAt||parsed.pix?.expiresAt||null,
      status:"pending",
    });

  } catch (err) {
    console.error("[PIX-BLACKCAT] Erro:", err.message);
    return jsonResponse(502, { success:false, error:"Falha ao conectar: "+String(err) });
  }
};
