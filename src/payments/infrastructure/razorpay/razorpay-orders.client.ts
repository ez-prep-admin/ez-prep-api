export const RAZORPAY_ORDERS_CLIENT = 'RAZORPAY_ORDERS_CLIENT';

export interface RazorpayOrderCreateInput {
  amount: number;
  currency: 'INR';
  receipt: string;
}

export interface RazorpayCreatedOrder {
  id: string;
  amount: number;
  currency: string;
}

export interface RazorpayOrdersClient {
  createOrder(input: RazorpayOrderCreateInput): Promise<RazorpayCreatedOrder>;
}
