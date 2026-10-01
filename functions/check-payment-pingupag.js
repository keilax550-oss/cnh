const { getSupabase } = require("./lib/supabase");

const PINGUPAG_BASE = "https://app.pingupag.com";

async function sendUtmifyPaid(txData, transactionId) {
  const UTMIFY_TOKEN = process.env.UTMIFY_TOKEN;
  if (!UTMIFY_TOKEN) return;

  try {
    const amountCents     = Math.round((txData.amount || 65.70) * 100);
    const gatewayFeeCents = Math.round(amountCents * 0.02);

    const payload = {
      orderId:       transactionId,
      platform:      "Pingupag",
      paymentMethod: "pix",
      status:        "paid",
      createdAt:     txData.created_at || new Date().toISOString().replace("T", " ").slice(0, 19),
      approvedDate:  new Date().toISOString().replace("T", " ").slice(0, 19),
      refundedAt:    null,
      customer: {
        name:     txData.customer_name  || null,
        email:    txData.customer_email || null,
        phone:    txData.customer_phone || null,
        document: txData.customer_cpf   || null,
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
        utm_source:   txData.utm_source   || null,
        utm_campaign: txData.utm_campaign || null,
        utm_medium:   txData.utm_medium   || null,
        utm_content:  txData.utm_content  || null,
        utm_term:     txData.utm_term     || null,
        src:          null,
        sck:          null,
      },
      commission: {
        totalPriceInCents:     amountCents,
        gatewayFeeInCents:     gatewayFeeCents,
        userCommissionInCents: amountCents - gatewayFeeCents,
        currency:              "BRL",
      },
      isTest: false,
    };

    await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-token": UTMIFY_TOKEN },
      body:    JSON.stringify(payload),
    });
    console.log("[UTMify] ✓ Paid enviado:", transactionId);
  } catch (err) {
    console.error("[UTMify]", err.message);
  }
}

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

function mapStatus(rawStatus) {
  const s = (rawStatus || "").toLowerCase();
  if (s === "approved")     return { status: "paid",         paid: true  };
  if (s === "failed")       return { status: "rejected",     paid: false };
  if (s === "refunded")     return { status: "refunded",     paid: false };
  if (s === "chargeback")   return { status: "chargeback",   paid: false };
  if (s === "under_review") return { status: "under_review", paid: false };
  if (s === "processing")   return { status: "processing",   paid: false };
  return                           { status: "pending",      paid: false };
}

exports.handler = async (event) => {
  // ── Lê variáveis DENTRO do handler ────────────────────────────────────────
  const PINGUPAG_API_KEY = process.env.PINGUPAG_API_KEY;

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" }, body: "" };
  }

  if (!PINGUPAG_API_KEY) {
    return jsonResponse(500, { success: false, error: "PINGUPAG_API_KEY não configurada" });
  }

  // Aceita id via query param ou body POST
  let transactionId =
    event.queryStringParameters?.id ||
    event.queryStringParameters?.transactionId;

  if (event.httpMethod === "POST") {
    try {
      const b = event.body ? JSON.parse(event.body) : {};
      transactionId = b?.transactionId || b?.id || transactionId;
    } catch {}
  }

  if (!transactionId) {
    return jsonResponse(400, { success: false, error: "Informe o transactionId" });
  }

  // ── Consulta Pingupag ──────────────────────────────────────────────────────
  let text = "";
  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(
      `${PINGUPAG_BASE}/gateway/v1/query?action=get_transaction&id=${encodeURIComponent(transactionId)}`,
      {
        method:  "GET",
        headers: { "Content-Type": "application/json", "X-API-Key": PINGUPAG_API_KEY },
        signal:  controller.signal,
      }
    );
    text = await resp.text();
    clearTimeout(timeout);
  } catch (err) {
    return jsonResponse(502, { success: false, error: "Falha ao consultar status: " + String(err) });
  }

  let parsed = {};
  try { parsed = JSON.parse(text); } catch { parsed = {}; }

  // Pingupag retorna payment_status (status do pagamento) distinto de status (sucesso da req)
  const rawStatus = parsed.payment_status || parsed.status || "pending";
  const { status, paid } = mapStatus(rawStatus);

  console.log("[CHECK-PINGUPAG]", transactionId, "→", rawStatus, "→", status);

  // ── Atualizar Supabase ─────────────────────────────────────────────────────
  try {
    const supabase = getSupabase();

    if (paid) {
      const { data: txData } = await supabase
        .from("transactions")
        .select("status,customer_name,customer_email,customer_phone,customer_cpf,amount,created_at,utm_source,utm_campaign,utm_medium,utm_content,utm_term")
        .eq("transaction_id", transactionId)
        .single();

      const alreadyPaid = txData?.status === "paid";
      await supabase.from("transactions").update({ status: "paid", paid_at: new Date().toISOString() }).eq("transaction_id", transactionId);
      if (!alreadyPaid && txData) await sendUtmifyPaid(txData, transactionId);
    } else {
      await supabase.from("transactions").update({ status }).eq("transaction_id", transactionId);
    }
  } catch (err) {
    console.error("[Supabase] Erro (continuando):", err.message);
  }

  return jsonResponse(200, {
    success:       true,
    transactionId,
    status,
    paid,
    raw_status:    rawStatus,
    amount:        parsed.amount          || null,
    amount_reais:  parsed.amount_in_reais || null,
    external_id:   parsed.external_id     || null,
  });
};
