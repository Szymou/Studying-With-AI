declare namespace Express {
  interface Request {
    user?: any;
  }
}

declare module 'sqlite3' {
  interface Database {
    run(sql: string, params?: any): Promise<{ lastID: number; changes: number }>;
    get(sql: string, params?: any): Promise<any>;
    all(sql: string, params?: any): Promise<any[]>;
  }
}
