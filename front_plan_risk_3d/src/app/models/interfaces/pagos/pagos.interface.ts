export interface PaymentRequest {
  plan: string;
  monto: number;
  //token: string/*
  cardholderName: string;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
}

export interface PaymentResponse {
  success: boolean;
  message: string;
  usuario?: any;
}