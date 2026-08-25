// Type declarations for the vendored Tibetan converter (index.js).
export type TibetanScriptValue = "unicode" | "wylie" | "acip";

export const TibetanScript: {
  readonly UNICODE: "unicode";
  readonly WYLIE: "wylie";
  readonly ACIP: "acip";
};

export interface ConversionOptions {
  retainSlashes?: boolean;
  retainEms?: boolean;
  retainPageNumbers?: boolean;
}

export function ACIPtoEWTS(s: string, options?: ConversionOptions): string;
export function EWTStoACIPContent(s: string, options?: ConversionOptions): string;
export function convertToUnicode(text: string, from: TibetanScriptValue, options?: ConversionOptions): string;
export function convertToACIP(text: string, from: TibetanScriptValue, options?: ConversionOptions): string;
export function convertToWylie(text: string, from: TibetanScriptValue, options?: ConversionOptions): string;
export function convert(text: string, from: TibetanScriptValue, to: TibetanScriptValue, options?: ConversionOptions): string;
