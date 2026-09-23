declare module 'docx-templates/lib/browser.js' {
  interface CreateReportOptions {
    template: ArrayBuffer | Uint8Array;
    data?: unknown;
    cmdDelimiter?: [string, string];
    noSandbox?: boolean;
    failFast?: boolean;
    literalXmlDelimiter?: string;
    processLineBreaks?: boolean;
    fixSmartQuotes?: boolean;
    rejectNullish?: boolean;
  }

  export function createReport(options: CreateReportOptions): Promise<Uint8Array>;
}