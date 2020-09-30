import moment from "moment";
import mongoose from "mongoose";

interface DataFactoryOptions {
  dbString: string;
  disableReplica: boolean;
  logger?: LoggerOptions;
  [s: string]: any;
}
interface FormatterOptions {
  colorize: string;
  level: "debug" | "error" | "info" | "warn" | "silly";
  message?: string;
  meta: { [s: string]: any; };
  timestamp(): moment.MomentInput;
}
interface LoggerOptions {
  logLevel?: string;
  sentry?: WinstonSentryOptions;
  shardID?: string;
  [s: string]: any;
}
interface WinstonSentryOptions {
  dsn?: string;
  logLevel?: string;
  [s: string]: any;
}

declare class Logger {
  private _options: LoggerOptions;
  exitOnError: boolean;
  transports: [unknown /* No Winston docs for 2.2.0 */, unknown /* Why is winston-sentry on 0.1.4 (2011) */]
  constructor(options: LoggerOptions);
  private _formatter(options: FormatterOptions): string;
}

export declare class DataFactory {
  private _models: { [s: string]: mongoose.Model<mongoose.Document>; };
  logger: Logger;
  constructor(options: DataFactoryOptions);
  connection: mongoose.Connection;
  models: { [s: string]: mongoose.Model<mongoose.Document>; };
  mongoose: typeof mongoose;
  Schema: mongoose.Schema;
  collection(name: string, options?: any): mongoose.Collection;
  registerModel(data: { name: string; schema: mongoose.Schema; }): void;
}

declare module "@dyno.gg/datafactory" {
  export = DataFactory;
}