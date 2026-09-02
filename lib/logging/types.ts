export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  attributes?: Record<string, unknown>;
}

export interface LogTransport {
  name: string;
  send: (entry: LogEntry) => Promise<void>;
}
