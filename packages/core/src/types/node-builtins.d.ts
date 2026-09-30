/**
 * Ядро навмисно не знає типів Node — воно працює й у браузері, і в Hermes.
 * Тут описані рівно ті шматки вбудованих модулів, якими користуються тести.
 */
declare module 'node:fs' {
  export function writeFileSync(path: string, data: string): void;
}

declare module 'node:sqlite' {
  type Param = string | number | null;
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: Param[]): unknown;
      all(...params: Param[]): unknown[];
    };
  }
}
