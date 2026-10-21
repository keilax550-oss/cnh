// @ts-nocheck
const { getSupabase } = require("./lib/supabase");

const BLACKCAT_BASE = "https://api.blackcatoficial.com/api";

async function sendUtmifyPaid(txData, transactionId) {
  const UTMIFY_TOKEN = process.env.UTMIFY_TOKEN;
  if (!UTMIFY_TOKEN) return;

  try {
    const amountCents     = Math.round((txData.amount || 65.70) * 100);
    const gatewayFeeCents = Math.round(amountCents * 0.02);

    const payload = {
      orderId:       transactionId,
      platform:      "Blackcat",
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

/**
 * Normaliza o status retornado pela Blackcat para o padrão interno do projeto.
 * A documentação da Blackcat indica os seguintes status possíveis:
 *   PAID / APPROVED / COMPLETED  → paid
 *   PENDING / WAITING / CREATED  → pending
 *   PROCESSING                   → processing
 *   CANCELLED / FAILED / REFUSED → rejected
 *   REFUNDED / REVERSED          → refunded
 *   CHARGEBACK                   → chargeback
 *   UNDER_REVIEW / IN_REVIEW     → under_review
 */
function mapStatus(rawStatus) {
  const s = (rawStatus || "").toUpperCase();

  if (["PAID", "APPROVED", "COMPLETED"].includes(s))           return { status: "paid",         paid: true  };
  if (["CANCELLED", "FAILED", "REFUSED", "REJECTED"].includes(s)) return { status: "rejected",  paid: false };
  if (["REFUNDED", "REVERSED"].includes(s))                    return { status: "refunded",      paid: false };
  if (["CHARGEBACK"].includes(s))                              return { status: "chargeback",    paid: false };
  if (["UNDER_REVIEW", "IN_REVIEW"].includes(s))               return { status: "under_review",  paid: false };
  if (["PROCESSING"].includes(s))                              return { status: "processing",    paid: false };
  return                                                              { status: "pending",        paid: false };
}

exports.handler = async (event) => {
  // Lê variáveis DENTRO do handler para garantir injeção correta pelo netlify.toml
  const BLACKCAT_API_KEY = process.env.BLACKCAT_API_KEY;

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

  if (!BLACKCAT_API_KEY) {
    return jsonResponse(500, { success: false, error: "BLACKCAT_API_KEY não configurada" });
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

  // ── Consulta Blackcat ──────────────────────────────────────────────────────
  let text = "";
  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(
      `${BLACKCAT_BASE}/sales/${encodeURIComponent(transactionId)}`,
      {
        method:  "GET",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key":    BLACKCAT_API_KEY,
        },
        signal: controller.signal,
      }
    );
    text = await resp.text();
    clearTimeout(timeout);

    console.log("[CHECK-BLACKCAT] HTTP status:", resp.status, "| Raw:", text.substring(0, 200));
  } catch (err) {
    return jsonResponse(502, { success: false, error: "Falha ao consultar status: " + String(err) });
  }

  let parsed = {};
  try { parsed = JSON.parse(text); } catch { parsed = {}; }

  // Blackcat pode retornar o status em diferentes campos
  const rawStatus = (
    parsed.status          ||
    parsed.payment_status  ||
    parsed.paymentStatus   ||
    parsed.data?.status    ||
    "PENDING"
  );

  const { status, paid } = mapStatus(rawStatus);

  console.log("[CHECK-BLACKCAT]", transactionId, "→ raw:", rawStatus, "→ normalized:", status);

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
      await supabase
        .from("transactions")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("transaction_id", transactionId);

      // Só dispara UTMify se ainda não tinha sido marcado como pago (evita duplicata)
      if (!alreadyPaid && txData) await sendUtmifyPaid(txData, transactionId);
    } else {
      await supabase
        .from("transactions")
        .update({ status })
        .eq("transaction_id", transactionId);
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
    amount:        parsed.amount        || parsed.data?.amount        || null,
    amount_reais:  parsed.amountReais   || parsed.data?.amountReais   || null,
    external_ref:  parsed.externalRef   || parsed.external_ref        || null,
  });
};
