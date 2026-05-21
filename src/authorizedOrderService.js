import { fetchRecentReplyEmails, markReplyEmailsSeen } from './emailReplyReader.js';
import { getPrimaryReplyTarget, getReplyTargetsForSender } from './config.js';
import { sendReplyEmail } from './emailSender.js';
import {
  buildBuyReply,
  buildHelpReply,
  buildListReply,
  buildStatusReply,
  buildUnknownCommandReply
} from './manualCheckoutService.js';
import { createManualOrderIntent } from './orderIntentService.js';
import { parseReplyCommand } from './replyParser.js';
import {
  getExistingEmailCommand,
  getProductBySku,
  getProductsBySkuAcrossTargets,
  insertEmailCommand,
  listInStockProductsAcrossTargets,
  updateEmailCommand
} from './supabaseClient.js';

function isAuthorizedSender(config, senderEmail) {
  return config.allowedReplySenders.includes(senderEmail.toLowerCase());
}

function buildCommandRecord(message, parsedCommand) {
  return {
    message_id: message.messageId,
    in_reply_to: message.inReplyTo,
    sender_email: message.fromAddress,
    sender_name: message.fromName,
    subject: message.subject,
    command_text: parsedCommand.commandText || message.subject || '(empty)',
    command_name: parsedCommand.commandName,
    parsed_payload: parsedCommand.payload,
    status: 'received'
  };
}

function shouldRetryExistingCommand(existingCommand) {
  return ['received', 'error'].includes(existingCommand?.status);
}

async function resolveCommand(
  config,
  supabase,
  message,
  parsedCommand,
  emailCommandId,
  senderTargets,
  primaryTarget
) {
  switch (parsedCommand.commandName) {
    case 'HELP':
      return {
        status: 'processed',
        ...buildHelpReply()
      };

    case 'LIST_IN_STOCK': {
      const products = await listInStockProductsAcrossTargets(
        supabase,
        senderTargets,
        config.listInStockLimit
      );
      return {
        status: 'processed',
        ...buildListReply(products, config.productCategory)
      };
    }

    case 'STATUS': {
      const product =
        senderTargets.length <= 1
          ? await getProductBySku(supabase, primaryTarget, parsedCommand.payload.sku)
          : await getProductsBySkuAcrossTargets(supabase, senderTargets, parsedCommand.payload.sku);

      return {
        status: 'processed',
        ...buildStatusReply(product, parsedCommand.payload.sku)
      };
    }

    case 'BUY': {
      const scopedProducts =
        senderTargets.length <= 1
          ? [await getProductBySku(supabase, primaryTarget, parsedCommand.payload.sku)].filter(Boolean)
          : await getProductsBySkuAcrossTargets(supabase, senderTargets, parsedCommand.payload.sku);

      const product =
        scopedProducts.find((entry) => entry.pincode === primaryTarget?.pincode) ??
        (scopedProducts.length === 1 ? scopedProducts[0] : null);

      const intent = config.dryRun
        ? {
            id: 'dry-run-intent',
            status: product?.in_stock ? 'pending_manual_checkout' : product ? 'awaiting_stock' : 'needs_review',
            pincode: product?.pincode ?? primaryTarget?.pincode ?? null
          }
        : await createManualOrderIntent(supabase, {
            emailCommandId,
            senderEmail: message.fromAddress,
            sku: parsedCommand.payload.sku,
            quantity: parsedCommand.payload.quantity,
            product,
            target: primaryTarget,
            metadata: {
              source: 'email_reply',
              received_at: message.receivedAt,
              pincode: product?.pincode ?? primaryTarget?.pincode ?? null
            }
          });

      return {
        status: 'processed',
        ...buildBuyReply(product, intent, parsedCommand.payload.quantity)
      };
    }

    default:
      return {
        status: 'rejected',
        ...buildUnknownCommandReply()
      };
  }
}

export async function processReplyInbox(config, supabase, logger) {
  const messages = await fetchRecentReplyEmails(config, logger);
  let processed = 0;
  let skipped = 0;
  const seenUids = [];

  for (const message of messages) {
    if (!isAuthorizedSender(config, message.fromAddress)) {
      logger.info('Skipping unauthorized reply sender', {
        messageId: message.messageId,
        sender: message.fromAddress
      });
      seenUids.push(message.uid);
      skipped += 1;
      continue;
    }

    const existing = await getExistingEmailCommand(supabase, message.messageId);
    if (existing && !shouldRetryExistingCommand(existing)) {
      seenUids.push(message.uid);
      skipped += 1;
      continue;
    }

    const senderTargets = getReplyTargetsForSender(config, message.fromAddress);
    const primaryTarget = getPrimaryReplyTarget(config, message.fromAddress);

    const parsedCommand = parseReplyCommand(message.text || message.subject || '');
    let emailCommandId = existing?.id ?? null;

    if (!config.dryRun && !existing) {
      const created = await insertEmailCommand(supabase, buildCommandRecord(message, parsedCommand));
      emailCommandId = created.id;
    }

    try {
      const response = await resolveCommand(
        config,
        supabase,
        message,
        parsedCommand,
        emailCommandId,
        senderTargets,
        primaryTarget
      );

      await sendReplyEmail(config, logger, {
        to: message.fromAddress,
        subject: response.subject,
        text: response.text,
        inReplyTo: message.messageId
      });

      if (!config.dryRun && emailCommandId) {
        await updateEmailCommand(supabase, emailCommandId, {
          status: response.status,
          response_subject: response.subject,
          response_body: response.text,
          error_message: null,
          processed_at: new Date().toISOString()
        });
      }

      seenUids.push(message.uid);
      processed += 1;
    } catch (error) {
      logger.error('Failed to process reply email', {
        messageId: message.messageId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      });

      if (!config.dryRun && emailCommandId) {
        await updateEmailCommand(supabase, emailCommandId, {
          status: 'error',
          error_message: error.message,
          processed_at: new Date().toISOString()
        });
      }
    }
  }

  try {
    await markReplyEmailsSeen(config, logger, seenUids);
  } catch (error) {
    logger.warn('Failed to mark reply emails as seen', {
      error: {
        name: error.name,
        message: error.message
      }
    });
  }

  logger.info('Reply inbox processing finished', {
    totalMessages: messages.length,
    processed,
    skipped
  });

  return { totalMessages: messages.length, processed, skipped };
}
