/**
 * Ядро навмисно не знає типів Node — воно працює й у браузері, і в Hermes.
 * Тестам драйвера SQLite потрібен лише цей шматок вбудованого модуля.
 */
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
