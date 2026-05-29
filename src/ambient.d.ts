declare module 'electron' {
  export const clipboard: {
    write(data: {
      text?: string;
      html?: string;
      bookmark?: string;
    }): void;
    writeText(text: string): void;
  };
}

declare module '@retorquere/bibtex-parser' {
  export interface Creator {
    literal?: string;
    firstName?: string;
    lastName?: string;
  }

  export interface ParserOptions {
    errorHandler?: (err: unknown) => void;
  }

  export interface Bibliography {
    errors: Array<{ line: number; column: number; message: string }>;
    entries: Array<{
      key: string;
      type: string;
      fields: Record<string, string[]>;
      creators: Record<string, Creator[]>;
    }>;
  }

  export function parse(raw: string, options?: ParserOptions): Bibliography;
}
