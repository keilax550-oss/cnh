/**
 * Receptor de Webhooks (Postbacks) da Pingupag
 *
 * A Pingupag envia um POST para esta URL sempre que o status de uma
 * transação muda. O servidor deve responder 200 OK para confirmar.
 *
 * Payload esperado:
 * {
 *   transaction_id, external_id, store_reference, e2e_id,
 *   status, raw_status, amount, payment_method,
 *   customer: { name, email, phone, document },
 *   address: { ... },
 *   product: { name, hash },
 *   pix_code, tracking: { utm_* },
 *   webhook_type, timestamp,
 *   recurring_id (opcional — só em assinaturas)
 * }
 */

const { getSupabase } = require("./lib/supabase");

const UTMIFY_TOKEN = process.env.UTMIFY_TOKEN;

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
 * Mapeia os status da Pingupag para os status internos do sistema.
 * Pingupag statuses: pending | approved | processing | under_review | failed | refunded | chargeback
 */
function mapStatus(rawStatus) {
  const s = (rawStatus || "").toLowerCase();
  if (s === "approved")    return { status: "paid",        paid: true };
  if (s === "failed")      return { status: "rejected",    paid: false };
  if (s === "refunded")    return { status: "refunded",    paid: false };
  if (s === "chargeback")  return { status: "chargeback",  paid: false };
  if (s === "under_review") return { status: "under_review", paid: false };
  if (s === "processing")  return { status: "processing",  paid: false };
  return                          { status: "pending",     paid: false };
}

async function sendUtmifyPaid(data, transactionId) {
  try {
    const amountCents     = data.amount || 0; // Pingupag já envia em centavos
    const gatewayFeeCents = Math.round(amountCents * 0.02);
    const tracking        = data.tracking || {};
    const customer        = data.customer || {};

    const payload = {
      orderId:       transactionId,
      platform:      "Pingupag",
      paymentMethod: "pix",
      status:        "paid",
      createdAt:     data.timestamp || new Date().toISOString().replace("T", " ").slice(0, 19),
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
        name:         data.product?.name || "SHOPIFY LOJA 03",
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
  // Pingupag envia POST; responder OPTIONS para preflight
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
    console.error("[WEBHOOK-PINGUPAG] Payload inválido:", err.message);
    return jsonResponse(400, { success: false, error: "Payload inválido" });
  }

  console.log("[WEBHOOK-PINGUPAG] Recebido:", JSON.stringify({
    transaction_id: data.transaction_id,
    external_id:    data.external_id,
    status:         data.status,
    amount:         data.amount,
    recurring_id:   data.recurring_id || null,
    timestamp:      data.timestamp,
  }));

  // ── Ignorar eventos que não são de transação ───────────────────────────────
  if (data.webhook_type && data.webhook_type !== "transaction") {
    console.log("[WEBHOOK-PINGUPAG] Tipo ignorado:", data.webhook_type);
    return jsonResponse(200, { success: true, message: "Evento ignorado" });
  }

  const transactionId = String(data.transaction_id || "").trim();
  const externalId    = String(data.external_id || data.store_reference || "").trim();

  if (!transactionId && !externalId) {
    console.error("[WEBHOOK-PINGUPAG] Sem transaction_id nem external_id");
    return jsonResponse(400, { success: false, error: "transaction_id ausente" });
  }

  const rawStatus          = data.payment_status || data.status || "pending";
  const { status, paid }   = mapStatus(rawStatus);
  const isRecurring        = !!data.recurring_id;
  const recurringId        = data.recurring_id || null;

  // ── Atualizar Supabase ─────────────────────────────────────────────────────
  try {
    const supabase = getSupabase();

    // Tentar buscar pelo transaction_id da plataforma ou pelo external_id
    const query = transactionId
      ? supabase.from("transactions").select("status,customer_name,customer_email,customer_phone,customer_cpf,amount,created_at,utm_source,utm_campaign,utm_medium,utm_content,utm_term").eq("transaction_id", transactionId).single()
      : supabase.from("transactions").select("status,customer_name,customer_email,customer_phone,customer_cpf,amount,created_at,utm_source,utm_campaign,utm_medium,utm_content,utm_term").eq("external_ref", externalId).single();

    const { data: txData, error: fetchErr } = await query;

    if (fetchErr) {
      console.warn("[Supabase] Transação não encontrada:", fetchErr.message);
    }

    const alreadyPaid = txData?.status === "paid";

    // Montar update
    const updateFields = {
      status,
      gateway:      "pingupag",
      external_ref: externalId || undefined,
    };

    if (paid) {
      updateFields.paid_at = new Date().toISOString();
    }

    if (isRecurring) {
      updateFields.recurring_id = recurringId;
    }

    // Executar update — tenta por transaction_id primeiro, depois por external_ref
    if (transactionId) {
      await supabase.from("transactions").update(updateFields).eq("transaction_id", transactionId);
    } else {
      await supabase.from("transactions").update(updateFields).eq("external_ref", externalId);
    }

    console.log("[Supabase] ✓ Status atualizado:", transactionId || externalId, "→", status);

    // ── UTMify apenas na primeira aprovação ───────────────────────────────
    if (paid && !alreadyPaid) {
      await sendUtmifyPaid(data, transactionId || externalId);
    }

    // ── Log especial para recorrência ─────────────────────────────────────
    if (isRecurring) {
      console.log("[WEBHOOK-PINGUPAG] Pagamento recorrente:", {
        recurring_id:   recurringId,
        transaction_id: transactionId,
        status,
      });
    }

  } catch (err) {
    console.error("[Supabase] Erro no webhook (continuando):", err.message);
    // Ainda retorna 200 para que a Pingupag não reenvie indefinidamente
  }

  // ── Sempre responder 200 para a Pingupag ──────────────────────────────────
  return jsonResponse(200, {
    success:        true,
    transactionId,
    status,
    paid,
    recurring_id:   recurringId,
  });
};
