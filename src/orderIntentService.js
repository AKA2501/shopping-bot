import { insertOrderIntent } from './supabaseClient.js';

function buildIntentStatus(product) {
  if (!product) {
    return 'needs_review';
  }

  if (!product.in_stock) {
    return 'awaiting_stock';
  }

  return 'pending_manual_checkout';
}

function buildIntentNotes(product) {
  if (!product) {
    return 'SKU was not found in the current product cache. Manual review required.';
  }

  if (!product.in_stock) {
    return 'Product is currently out of stock. Manual checkout can proceed once stock returns.';
  }

  return 'Manual checkout required. No automated login, OTP, CAPTCHA, or payment flow is performed.';
}

export async function createManualOrderIntent(supabase, input) {
  const row = {
    email_command_id: input.emailCommandId,
    sender_email: input.senderEmail,
    pincode: input.target?.pincode ?? null,
    sku: input.sku,
    requested_quantity: input.quantity,
    mode: 'manual_checkout_only',
    status: buildIntentStatus(input.product),
    product_name: input.product?.name ?? null,
    product_url: input.product?.product_url ?? input.product?.productUrl ?? null,
    notes: buildIntentNotes(input.product),
    metadata: input.metadata ?? {}
  };

  return insertOrderIntent(supabase, row);
}
