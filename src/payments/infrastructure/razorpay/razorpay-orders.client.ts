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

export interface RazorpayRefundInput {
  paymentId: string;
  amount: number;
}

export interface RazorpayRefundResult {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RazorpayFetchedOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RazorpayFetchedPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RazorpayOrdersClient {
  createOrder(input: RazorpayOrderCreateInput): Promise<RazorpayCreatedOrder>;
  refundPayment(input: RazorpayRefundInput): Promise<RazorpayRefundResult>;
  fetchOrder(orderId: string): Promise<RazorpayFetchedOrder>;
  fetchPayments(orderId: string): Promise<RazorpayFetchedPayment[]>;
}
