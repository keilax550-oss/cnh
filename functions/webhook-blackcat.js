// @ts-nocheck
/**
 * Receptor de Webhooks (Postbacks) da Blackcat
 *
 * A Blackcat envia um POST para esta URL sempre que o status de uma
 * transação muda. O servidor deve responder 200 OK para confirmar.
 *
 * Payload esperado (estrutura genérica — ajustar conforme docs oficiais):
 * {
 *   id, transactionId, saleId,
 *   status, paymentStatus, payment_status,
 *   amount, amountReais,
 *   externalRef, external_ref,
 *   customer: { name, email, phone, document },
 *   pix: { qrCode, qrCodeImage },
 *   tracking: { utm_source, utm_campaign, utm_medium, utm_content, utm_term },
 *   createdAt, updatedAt
 * }
 */

const { getSupabase } = require("./lib/supabase");

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type":                "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

/**
 * Normaliza o status Blackcat para o padrão interno.
 */
function mapStatus(rawStatus) {
  const s = (rawStatus || "").toUpperCase();

  if (["PAID", "APPROVED", "COMPLETED"].includes(s))              return { status: "paid",         paid: true  };
  if (["CANCELLED", "FAILED", "REFUSED", "REJECTED"].includes(s)) return { status: "rejected",     paid: false };
  if (["REFUNDED", "REVERSED"].includes(s))                       return { status: "refunded",      paid: false };
  if (["CHARGEBACK"].includes(s))                                 return { status: "chargeback",    paid: false };
  if (["UNDER_REVIEW", "IN_REVIEW"].includes(s))                  return { status: "under_review",  paid: false };
  if (["PROCESSING"].includes(s))                                 return { status: "processing",    paid: false };
  return                                                                 { status: "pending",        paid: false };
}

async function sendUtmifyPaid(data, transactionId) {
  const UTMIFY_TOKEN = process.env.UTMIFY_TOKEN;
  if (!UTMIFY_TOKEN) return;

  try {
    // Blackcat envia amount em centavos conforme documentação
    const amountCents     = Number(data.amount || 0);
    const gatewayFeeCents = Math.round(amountCents * 0.02);
    const tracking        = data.tracking || {};
    const customer        = data.customer || {};

    const payload = {
      orderId:       transactionId,
      platform:      "Blackcat",
      paymentMethod: "pix",
      status:        "paid",
      createdAt:     data.createdAt || data.created_at || new Date().toISOString().replace("T", " ").slice(0, 19),
      approvedDate:  new Date().toISOString().replace("T", " ").slice(0, 19),
      refundedAt:    null,
      customer: {
        name:     customer.name     || null,
        email:    customer.email    || null,
        phone:    customer.phone    || null,
        document: customer.document || null,
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
        utm_source:   tracking.utm_source   || null,
        utm_campaign: tracking.utm_campaign || null,
        utm_medium:   tracking.utm_medium   || null,
        utm_content:  tracking.utm_content  || null,
        utm_term:     tracking.utm_term     || null,
        src:          tracking.src          || null,
        sck:          tracking.sck          || null,
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

    console.log("[UTMify] ✓ Webhook paid enviado:", transactionId);
  } catch (err) {
    console.error("[UTMify] Erro:", err.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { success: false, error: "Method Not Allowed" });
  }

  // ── Parse do payload ───────────────────────────────────────────────────────
  let data = {};
  try {
    data = event.body ? JSON.parse(event.body) : {};
  } catch (err) {
    console.error("[WEBHOOK-BLACKCAT] Payload inválido:", err.message);
    return jsonResponse(400, { success: false, error: "Payload inválido" });
  }

  // Blackcat pode envolver os dados em data.data
  if (data.data && typeof data.data === "object") {
    data = { ...data, ...data.data };
  }

  const transactionId = String(
    data.id             ||
    data.transactionId  ||
    data.transaction_id ||
    data.saleId         ||
    data.sale_id        ||
    ""
  ).trim();

  const externalRef = String(
    data.externalRef   ||
    data.external_ref  ||
    data.reference     ||
    ""
  ).trim();

  console.log("[WEBHOOK-BLACKCAT] Recebido:", JSON.stringify({
    transactionId,
    externalRef,
    status:    data.status || data.paymentStatus || data.payment_status,
    amount:    data.amount,
    createdAt: data.createdAt,
  }));

  if (!transactionId && !externalRef) {
    console.error("[WEBHOOK-BLACKCAT] Sem transactionId nem externalRef");
    return jsonResponse(400, { success: false, error: "transactionId ausente" });
  }

  const rawStatus        = data.paymentStatus || data.payment_status || data.status || "PENDING";
  const { status, paid } = mapStatus(rawStatus);

  // ── Atualizar Supabase ─────────────────────────────────────────────────────
  try {
    const supabase = getSupabase();

    // Buscar registro para checar se já estava pago (evita UTMify duplicado)
    const lookupField = transactionId ? "transaction_id" : "external_ref";
    const lookupValue = transactionId || externalRef;

    const { data: txData, error: fetchErr } = await supabase
      .from("transactions")
      .select("status,customer_name,customer_email,customer_phone,customer_cpf,amount,created_at,utm_source,utm_campaign,utm_medium,utm_content,utm_term")
      .eq(lookupField, lookupValue)
      .single();

    if (fetchErr) {
      console.warn("[Supabase] Transação não encontrada:", fetchErr.message);
    }

    const alreadyPaid = txData?.status === "paid";

    const updateFields = {
      status,
      gateway: "blackcat",
    };

    if (paid) {
      updateFields.paid_at = new Date().toISOString();
    }

    if (externalRef) {
      updateFields.external_ref = externalRef;
    }

    await supabase
      .from("transactions")
      .update(updateFields)
      .eq(lookupField, lookupValue);

    console.log("[Supabase] ✓ Status atualizado:", lookupValue, "→", status);

    // Dispara UTMify apenas na primeira aprovação
    if (paid && !alreadyPaid) {
      await sendUtmifyPaid(data, transactionId || externalRef);
    }

  } catch (err) {
    console.error("[Supabase] Erro no webhook (continuando):", err.message);
    // Retorna 200 mesmo em erro de banco para que a Blackcat não reenvie indefinidamente
  }

  // Sempre responder 200 para a Blackcat confirmar recebimento
  return jsonResponse(200, {
    success: true,
    transactionId,
    status,
    paid,
  });
};
