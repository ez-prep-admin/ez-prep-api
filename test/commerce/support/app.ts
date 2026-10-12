import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { useContainer } from 'class-validator';
import { MongoClient } from 'mongodb';
import { Connection } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { S3Service } from '../../../src/aws/s3/s3.service';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { RAZORPAY_ORDERS_CLIENT } from '../../../src/payments/infrastructure/razorpay/razorpay-orders.client';
import { applyHarnessEnv, HarnessEnvOptions } from './env';

export type CommerceHarness = {
  app: INestApplication;
  connection: Connection;
  tokenFor: (userId: string, role?: UserRole) => string;
  resetData: () => Promise<void>;
  close: () => Promise<void>;
};

const pdfBytes = Buffer.from('%PDF-1.4 harness');

async function ensurePaymentsCollection(uri: string): Promise<void> {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const existing = await client
      .db()
      .listCollections({ name: 'payments' })
      .toArray();
    if (existing.length === 0) {
      await client.db().createCollection('payments');
    }
  } finally {
    await client.close();
  }
}

export async function createCommerceHarness(
  options: HarnessEnvOptions & { razorpayClient?: object },
): Promise<CommerceHarness> {
  applyHarnessEnv(options);
  await ensurePaymentsCollection(options.mongoUri);

  const builder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(S3Service)
    .useValue({
      generateGstInvoiceKey: (userId: string, orderId: string) =>
        `${userId}/${orderId}.pdf`,
      uploadFile: jest.fn().mockResolvedValue({ key: 'invoice.pdf' }),
      downloadFile: jest.fn().mockResolvedValue({
        body: pdfBytes,
        contentType: 'application/pdf',
      }),
    });

  if (options.razorpayClient) {
    builder
      .overrideProvider(RAZORPAY_ORDERS_CLIENT)
      .useValue(options.razorpayClient);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();

  const connection = app.get<Connection>(getConnectionToken());
  const jwt = app.get(JwtService);

  return {
    app,
    connection,
    tokenFor: (userId: string, role: UserRole = UserRole.USER) =>
      jwt.sign({ sub: userId, role }),
    resetData: async () => {
      const collections = await connection.db?.collections();
      if (!collections) {
        return;
      }
      await Promise.all(
        collections.map(collection => collection.deleteMany({})),
      );
    },
    close: async () => {
      await app.close();
    },
  };
}
