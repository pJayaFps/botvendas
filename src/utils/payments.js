const config = require('../config');
const { generatePixQr } = require('./pix');

const createMercadoPagoCharge = async ({ amount, description, externalReference }) => {
  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.payments.mercadoPagoToken}`
    },
    body: JSON.stringify({
      transaction_amount: amount,
      description,
      payment_method_id: 'pix',
      external_reference: externalReference,
      payer: {
        email: config.payments.payerEmail
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MercadoPago error: ${error}`);
  }

  const data = await response.json();
  return {
    id: String(data.id),
    payload: data.point_of_interaction?.transaction_data?.qr_code,
    qrBase64: data.point_of_interaction?.transaction_data?.qr_code_base64
  };
};

const createAsaasCharge = async ({ amount, description, externalReference }) => {
  const response = await fetch('https://api.asaas.com/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      access_token: config.payments.asaasToken
    },
    body: JSON.stringify({
      billingType: 'PIX',
      value: amount,
      description,
      externalReference,
      customer: config.payments.payerEmail
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Asaas error: ${error}`);
  }

  const data = await response.json();
  return {
    id: String(data.id),
    payload: data.pix?.payload || data.pix?.qrCode,
    qrBase64: data.pix?.encodedImage
  };
};

const createPixCharge = async ({ amount, description, externalReference }) => {
  const provider = config.payments.provider;
  try {
    if (provider === 'mercadopago' && config.payments.mercadoPagoToken) {
      return { ...(await createMercadoPagoCharge({ amount, description, externalReference })), provider: 'mercadopago' };
    }
    if (provider === 'asaas' && config.payments.asaasToken) {
      return { ...(await createAsaasCharge({ amount, description, externalReference })), provider: 'asaas' };
    }
  } catch (error) {
    console.error('[PAYMENTS] Falha ao criar cobrança externa:', error.message);
  }

  const txid = `VIA${Date.now()}`;
  const { payload, buffer } = await generatePixQr({ amount, txid });
  return { id: txid, payload, qrBuffer: buffer, provider: 'mock' };
};

const parseWebhookPayload = (body) => {
  if (!body) return null;
  if (body.data?.id) {
    return { paymentId: String(body.data.id) };
  }
  if (body.payment?.id) {
    return { paymentId: String(body.payment.id) };
  }
  if (body.id) {
    return { paymentId: String(body.id) };
  }
  return null;
};

module.exports = { createPixCharge, parseWebhookPayload };
