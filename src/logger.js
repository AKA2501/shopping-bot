function serializeMeta(meta) {
  if (!meta) {
    return {};
  }

  if (meta instanceof Error) {
    return {
      error: {
        name: meta.name,
        message: meta.message,
        stack: meta.stack
      }
    };
  }

  return meta;
}

function write(level, message, meta) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...serializeMeta(meta)
  };

  console.log(JSON.stringify(payload));
}

export function createLogger() {
  return {
    info(message, meta) {
      write('info', message, meta);
    },
    warn(message, meta) {
      write('warn', message, meta);
    },
    error(message, meta) {
      write('error', message, meta);
    }
  };
}

