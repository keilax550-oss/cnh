const { getSupabase } = require("./lib/supabase");

const AVEN_BASE = "https://api.avenpayments.com";
const AVEN_API_KEY = process.env.AVEN_API_KEY;
const UTMIFY_TOKEN = "lzASZob4ldSJJc3jT1LILy9alPxWJgpnPhCh";

function getAuthHeader() {
  if (!AVEN_API_KEY) {
    throw new Error("AVEN_API_KEY não configurada");
  }
  return `Bearer ${AVEN_API_KEY}`;
}

async function sendUtmifyPaid(txData, transactionId) {
  try {
    const amountCents = Math.round((txData.amount || 6520) / 100); // AvenPayments já retorna em centavos
    const gatewayFeeCents = Math.round(amountCents * 0.02);
    const payload = {
      orderId: transactionId,
      platform: "AvenPayments",
      paymentMethod: "pix",
      status: "paid",
      createdAt: txData.createdAt || new Date().toISOString().replace("T"," ").slice(0,19),
      approvedDate: new Date().toISOString().replace("T"," ").slice(0,19),
      customer: {
        name: txData.customer_name || null,
        email: txData.customer_email || null,
        phone: txData.customer_phone || null,
        document: txData.customer_cpf || null,
        country: "BR",
        ip: "177.0.0.1"
      },
      products: [{
        id: "loja-shopify-br-001",
        name: "LOJA SHOPIFY 03",
        quantity: 1,
        priceInCents: amountCents,
      }],
      trackingParameters: {
        utm_source: txData.utm_source || null,
        utm_campaign: txData.utm_campaign || null,
        utm_medium: txData.utm_medium || null,
      },
      commission: {
        totalPriceInCents: amountCents,
        gatewayFeeInCents: gatewayFeeCents,
        userCommissionInCents: amountCents - gatewayFeeCents,
        currency: "BRL"
      },
    };
    
    await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-token": UTMIFY_TOKEN },
      body: JSON.stringify(payload)
    });
  } catch(err) {
    console.error("[UTMify]", err);
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
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      },
      body: ""
    };
  }

  let transactionId = event.queryStringParameters?.id || event.queryStringParameters?.transactionId;
  if (event.httpMethod === "POST") {
    try {
      const b = event.body ? JSON.parse(event.body) : {};
      transactionId = b?.transactionId || b?.id || transactionId;
    } catch {}
  }
  if (!transactionId) {
    return jsonResponse(400, { success: false, error: "Informe o transactionId" });
  }

  let authHeader;
  try {
    authHeader = getAuthHeader();
  } catch (err) {
    console.error("[CheckPaymentAven] Credenciais inválidas:", err.message);
    return jsonResponse(500, {
      success: false,
      error: "Credenciais não configuradas",
      debug: err.message
    });
  }

  let statusResp, text = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    statusResp = await fetch(
      `${AVEN_BASE}/v1/payment/${encodeURIComponent(transactionId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        signal: controller.signal
      }
    );
    text = await statusResp.text();
    clearTimeout(timeout);
  } catch(err) {
    return jsonResponse(502, {
      success: false,
      error: "Falha ao consultar status: " + String(err)
    });
  }

  let parsed = {};
  try { parsed = JSON.parse(text); } catch { parsed = {}; }

  const data = parsed || {};
  const rawStatus = (data.status || "PENDING").toUpperCase();

  // AvenPayments statuses: PENDING | PROCESSING | PAID | REFUSED | REFUNDED | MED | CHARGEDBACK
  const paid = rawStatus === "PAID";
  let status;
  if (paid) status = "paid";
  else if (rawStatus === "REFUSED" || rawStatus === "CHARGEDBACK") status = "rejected";
  else if (rawStatus === "REFUNDED") status = "refunded";
  else status = "pending";

  try {
    const supabase = getSupabase();
    if (paid) {
      const { data: txData } = await supabase
        .from("transactions")
        .select("status,customer_name,customer_email,customer_phone,customer_cpf,amount,created_at,utm_source,utm_campaign,utm_medium")
        .eq("transaction_id", transactionId)
        .single();
      const alreadyPaid = txData?.status === "paid";
      await supabase.from("transactions").update({
        status: "paid",
        paid_at: new Date().toISOString()
      }).eq("transaction_id", transactionId);
      if (!alreadyPaid && txData) await sendUtmifyPaid(txData, transactionId);
    } else {
      await supabase.from("transactions").update({ status }).eq("transaction_id", transactionId);
    }
  } catch(err) {
    console.error("[Supabase] Erro ao atualizar status (continuando):", err.message);
  }

  return jsonResponse(200, {
    success: true,
    transactionId,
    status,
    paid
  });
};
