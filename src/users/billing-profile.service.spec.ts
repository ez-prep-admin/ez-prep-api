import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutBillingDto } from '../orders/dto/create-checkout-order.dto';
import { User } from './schemas/user.schema';
import { Order } from '../orders/schemas/order.schema';
import { TaxInvoice } from '../invoices/schemas/tax-invoice.schema';
import { UsersService } from './users.service';

const USER_ID = '507f1f77bcf86cd799439011';

function query(result: unknown) {
  const chain = {
    exec: jest.fn().mockResolvedValue(result),
    populate: jest.fn(),
  };
  chain.populate.mockReturnValue(chain);
  return chain;
}

describe('UsersService billing profile', () => {
  let service: UsersService;
  const userModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModel },
        {
          provide: getModelToken(Order.name),
          useValue: { countDocuments: jest.fn() },
        },
        {
          provide: getModelToken(TaxInvoice.name),
          useValue: { countDocuments: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(UsersService);
    userModel.findById.mockReset();
    userModel.findByIdAndUpdate.mockReset();
  });

  const billing = (): CheckoutBillingDto => ({
    name: '  Asha Nair  ',
    stateCode: '32',
    addressLine1: ' 12 Marine Drive ',
    city: ' Kochi ',
    pincode: '682001',
  });

  it('returns null when the user has no billing profile', async () => {
    userModel.findById.mockReturnValue(query({ billingProfile: undefined }));

    await expect(service.getBillingProfile(USER_ID)).resolves.toBeNull();
  });

  it('saves the GST state name and omits a blank address line 2', async () => {
    userModel.findByIdAndUpdate.mockReturnValue(
      query({
        billingProfile: {
          name: 'Asha Nair',
          state: 'Kerala',
          stateCode: '32',
          addressLine1: '12 Marine Drive',
          city: 'Kochi',
          pincode: '682001',
        },
      }),
    );

    const saved = await service.updateBillingProfile(USER_ID, {
      ...billing(),
      addressLine2: '   ',
    });

    expect(saved).toEqual({
      name: 'Asha Nair',
      state: 'Kerala',
      stateCode: '32',
      addressLine1: '12 Marine Drive',
      city: 'Kochi',
      pincode: '682001',
    });
    expect(saved).not.toHaveProperty('addressLine2');
    const update = userModel.findByIdAndUpdate.mock.calls[0][1] as {
      $set: { billingProfile: { addressLine2?: string; state: string } };
    };
    expect(update.$set.billingProfile.state).toBe('Kerala');
    expect(update.$set.billingProfile).not.toHaveProperty('addressLine2');
    expect(update.$set).not.toHaveProperty('location');
  });

  it('rejects an unknown state code', async () => {
    userModel.findById.mockReturnValue(query({}));

    await expect(
      service.updateBillingProfile(USER_ID, { ...billing(), stateCode: '25' }),
    ).rejects.toThrow(new BadRequestException('Unknown billing stateCode'));
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('leaves billingProfile off the user profile response', async () => {
    const document = {
      get: jest.fn(),
      toObject: jest.fn().mockReturnValue({
        id: USER_ID,
        name: 'Asha',
        email: 'asha@example.com',
        billingProfile: { name: 'Asha Nair', stateCode: '32' },
      }),
    };
    userModel.findById.mockReturnValue(query(document));

    const profile = await service.findOne(USER_ID);

    expect(profile).not.toHaveProperty('billingProfile');
    expect(profile.name).toBe('Asha');
  });

  it('returns 404 for an unknown user', async () => {
    userModel.findById.mockReturnValue(query(null));

    await expect(service.getBillingProfile(USER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
