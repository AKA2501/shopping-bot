function stripQuotedReply(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const kept = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      kept.push('');
      continue;
    }

    if (trimmed.startsWith('>')) {
      break;
    }

    if (/^on .+ wrote:$/i.test(trimmed)) {
      break;
    }

    if (trimmed === '--') {
      break;
    }

    kept.push(trimmed);
  }

  return kept.join('\n').trim();
}

function normalizeLine(line) {
  return line.replace(/\s+/g, ' ').trim();
}

export function parseReplyCommand(text) {
  const cleaned = stripQuotedReply(text);
  const lines = cleaned
    .split('\n')
    .map(normalizeLine)
    .filter(Boolean);

  for (const line of lines) {
    const buyMatch = line.match(/^BUY\s+([A-Za-z0-9._-]+)\s+(\d+)$/i);
    if (buyMatch) {
      return {
        commandName: 'BUY',
        commandText: line,
        payload: {
          sku: buyMatch[1].toUpperCase(),
          quantity: Number(buyMatch[2])
        }
      };
    }

    const statusMatch = line.match(/^STATUS\s+([A-Za-z0-9._-]+)$/i);
    if (statusMatch) {
      return {
        commandName: 'STATUS',
        commandText: line,
        payload: {
          sku: statusMatch[1].toUpperCase()
        }
      };
    }

    if (/^LIST\s+IN_STOCK$/i.test(line)) {
      return {
        commandName: 'LIST_IN_STOCK',
        commandText: line,
        payload: {}
      };
    }

    if (/^HELP$/i.test(line)) {
      return {
        commandName: 'HELP',
        commandText: line,
        payload: {}
      };
    }
  }

  return {
    commandName: 'UNKNOWN',
    commandText: lines[0] ?? '',
    payload: {}
  };
}

