// Set required environment variables before any module imports.
// ConfigModule.forRoot({ validate }) runs at decorator evaluation time,
// so env vars must be available before AppModule is imported.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-e2e';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
