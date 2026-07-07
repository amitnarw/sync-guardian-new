const IS_DEV = __DEV__;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL: LogLevel = IS_DEV ? 'debug' : 'warn';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];
}

function sanitize(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (typeof arg === 'string') {
      // Strip potential PII patterns
      return arg
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[uuid]')
        .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[email]')
        .replace(/\bBearer\s+\S+/gi, 'Bearer [token]')
        .replace(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[jwt]');
    }
    return arg;
  });
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.debug('[SG-DEBUG]', ...sanitize(args));
    }
  },
  info: (...args: unknown[]) => {
    if (shouldLog('info')) {
      console.info('[SG]', ...sanitize(args));
    }
  },
  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn('[SG-WARN]', ...sanitize(args));
    }
  },
  error: (...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error('[SG-ERROR]', ...sanitize(args));
    }
  },
};
