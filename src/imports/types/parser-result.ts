export interface ParserWarning {
  code: string;
  message: string;
}

export interface ParserError {
  code: string;
  message: string;
}

export interface ParserResult<T> {
  data: T;
  warnings: ParserWarning[];
  errors: ParserError[];
}
