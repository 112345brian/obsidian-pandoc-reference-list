import 'obsidian';

declare module 'obsidian' {
  /**
   * AbstractInputSuggest was added to Obsidian's public API after the 1.2.8
   * types package was published. The runtime has it; this declaration gives
   * TypeScript the shape it needs.
   */
  abstract class AbstractInputSuggest<T> {
    constructor(app: App, inputEl: HTMLInputElement | HTMLTextAreaElement);
    readonly inputEl: HTMLInputElement | HTMLTextAreaElement;
    setValue(value: string): this;
    close(): void;
    abstract getSuggestions(query: string): T[] | Promise<T[]>;
    abstract renderSuggestion(item: T, el: HTMLElement): void;
    abstract selectSuggestion(item: T, evt: MouseEvent | KeyboardEvent): void;
  }
}

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
