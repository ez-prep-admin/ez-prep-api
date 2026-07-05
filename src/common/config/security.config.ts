export const securityConfig = {
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Needed for development
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? [
            'https://ezprep.in',
            'https://www.ezprep.in',
            'https://ezprep-app.vercel.app',
            'https://mock-app-admin.vercel.app/admin/questions',
            'http://localhost:3001',
          ] // Replace with your actual domains
        : ['http://localhost:3000'], // Allow localhost:3000 in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
    ],
  },
  rateLimit: {
    ttl: 60000, // 1 minute
    limit: 100, // 100 requests per minute
    skipIf: context => {
      // Skip rate limiting for health checks
      const request = context.switchToHttp().getRequest();
      return request.url === '/api/v1/health';
    },
  },
};
