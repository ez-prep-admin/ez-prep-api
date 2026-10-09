import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CommerceAuditService } from './commerce-audit.service';
import { CommerceAuditLog } from './schemas/commerce-audit-log.schema';

describe('CommerceAuditService', () => {
  const created: Array<Record<string, unknown>> = [];
  const stored: Array<Record<string, any>> = [];
  const auditModel = {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  let service: CommerceAuditService;

  beforeEach(async () => {
    created.length = 0;
    stored.length = 0;
    auditModel.create.mockImplementation(
      async (doc: Record<string, unknown>) => {
        created.push(doc);
        return doc;
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommerceAuditService,
        { provide: getModelToken(CommerceAuditLog.name), useValue: auditModel },
      ],
    }).compile();

    service = module.get(CommerceAuditService);
  });

  it('stores the audit shape and drops secret fields', async () => {
    const actorUserId = new Types.ObjectId().toHexString();
    const resourceId = new Types.ObjectId().toHexString();

    await service.log({
      actorUserId,
      action: 'REFUND_COMPLETED',
      resourceType: 'refund',
      resourceId,
      before: { status: 'INITIATED', razorpay_signature: 'sig_before' },
      after: {
        status: 'COMPLETED',
        amount: 99900,
        nested: { key_secret: 'hidden', currency: 'INR' },
        card: '4111',
      },
    });

    expect(created).toHaveLength(1);
    expect(created[0].action).toBe('REFUND_COMPLETED');
    expect(created[0].resourceType).toBe('refund');
    expect(String(created[0].actorUserId)).toBe(actorUserId);
    expect(String(created[0].resourceId)).toBe(resourceId);
    expect(created[0].before).toEqual({ status: 'INITIATED' });
    expect(created[0].after).toEqual({
      status: 'COMPLETED',
      amount: 99900,
      nested: { currency: 'INR' },
    });
    expect(JSON.stringify(created[0])).not.toContain('sig_before');
    expect(JSON.stringify(created[0])).not.toContain('hidden');
    expect(JSON.stringify(created[0])).not.toContain('4111');
  });

  it('swallows a write failure', async () => {
    auditModel.create.mockRejectedValueOnce(new Error('mongo down'));

    await expect(
      service.log({
        action: 'ENTITLEMENT_GRANTED',
        resourceType: 'entitlement',
      }),
    ).resolves.toBeUndefined();
  });

  it('lists rows for an action filter', async () => {
    const row = {
      _id: new Types.ObjectId(),
      action: 'ENTITLEMENT_GRANTED',
      resourceType: 'entitlement',
      toObject() {
        return {
          id: this._id.toHexString(),
          action: this.action,
          resourceType: this.resourceType,
        };
      },
    };
    stored.push(row);
    auditModel.find.mockImplementation((query: { action?: string }) => ({
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return this;
      },
      exec: async () =>
        stored.filter(item => !query.action || item.action === query.action),
    }));
    auditModel.countDocuments.mockImplementation(
      (query: { action?: string }) => ({
        exec: async () =>
          stored.filter(item => !query.action || item.action === query.action)
            .length,
      }),
    );

    const result = await service.list({
      action: 'ENTITLEMENT_GRANTED',
      page: 1,
      limit: 20,
    });

    expect(result.data).toEqual([
      expect.objectContaining({
        action: 'ENTITLEMENT_GRANTED',
        resourceType: 'entitlement',
      }),
    ]);
    expect(result.pagination.total).toBe(1);
  });
});
