declare module 'ascii-table' {
  export default class AsciiTable {
    constructor(title?: string);

    setTitle(title: string): void;
    setHeading(...headings: string[]): void;
    addRow(...values: string[]): void;
    addRow(row: string[]): void;
    addRow(row: Record<string, string>): void;
    addRow(row: string[], truncate: boolean): void;
    addRow(row: Record<string, string>, truncate: boolean): void;
    addRowMatrix(row: unknown[]): void;
    setAlign(column: number, alignment: 'left' | 'center' | 'right'): void;
    setAlign(alignments: ('left' | 'center' | 'right')[]): void;
    setJustify(column: number, justify: boolean): void;
    setJustify(justify: boolean[]): void;
    setChars(chars: Record<string, string>): void;
    setStyle(style: 'default' | 'fat' | 'thin' | 'double' | 'round' | 'single'): void;
    setBorder(border: boolean): void;
    removeBorder(): void;
    setTruncate(truncate: boolean): void;
    setMaxColWidth(maxWidth: number): void;
    setMinColWidth(minWidth: number): void;
    setColWidth(column: number, width: number): void;
    setColWidths(widths: number[]): void;
    setDefaultColWidth(width: number): void;
    setDefaultAlignment(alignment: 'left' | 'center' | 'right'): void;
    setDefaultJustify(justify: boolean): void;
    setDefaultTruncate(truncate: boolean): void;
    setDefaultMaxColWidth(maxWidth: number): void;
    setDefaultMinColWidth(minWidth: number): void;
    setDefaultStyle(style: 'default' | 'fat' | 'thin' | 'double' | 'round' | 'single'): void;
    setDefaultBorder(border: boolean): void;
    setDefaultChars(chars: Record<string, string>): void;
    toString(): string;
  }
}
