/**
 * 结构化日志模块
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
    [key: string]: unknown;
}

function formatMessage(level: LogLevel, module: string, message: string, payload?: LogPayload): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${module}]`;
    if (payload && Object.keys(payload).length > 0) {
        return `${prefix} ${message} ${JSON.stringify(payload)}`;
    }
    return `${prefix} ${message}`;
}

export interface Logger {
    debug(message: string, payload?: LogPayload): void;
    info(message: string, payload?: LogPayload): void;
    warn(message: string, payload?: LogPayload): void;
    error(message: string, payload?: LogPayload): void;
    error(message: string, error: unknown, payload?: LogPayload): void;
}

export function createLogger(module: string): Logger {
    return {
        debug(message: string, payload?: LogPayload) {
            console.debug(formatMessage('debug', module, message, payload));
        },
        info(message: string, payload?: LogPayload) {
            console.log(formatMessage('info', module, message, payload));
        },
        warn(message: string, payload?: LogPayload) {
            console.warn(formatMessage('warn', module, message, payload));
        },
        error(message: string, errorOrPayload?: unknown, payload?: LogPayload) {
            if (errorOrPayload instanceof Error) {
                console.error(
                    formatMessage('error', module, message, {
                        ...payload,
                        errorName: errorOrPayload.name,
                        errorMessage: errorOrPayload.message
                    }),
                    errorOrPayload
                );
            } else if (errorOrPayload && typeof errorOrPayload === 'object' && !Array.isArray(errorOrPayload)) {
                console.error(formatMessage('error', module, message, errorOrPayload as LogPayload));
            } else {
                console.error(formatMessage('error', module, message, payload));
            }
        }
    };
}
