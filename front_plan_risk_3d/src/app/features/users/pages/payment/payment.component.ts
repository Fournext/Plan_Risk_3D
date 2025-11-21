import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { PaymentService } from '../../services/payment.service';
import { Router } from '@angular/router';
import { TokenStorageService } from '../../../auth/services/tokenStorage.service';

@Component({
  selector: 'app-payment',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.css']
})
export class PaymentComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private platformId = inject(PLATFORM_ID);
  private paymentService = inject(PaymentService);
  private router = inject(Router);
  private tokenStorageService = inject(TokenStorageService);
  
  paymentForm!: FormGroup;
  stripe: Stripe | null = null;
  isProcessing = false;
  
  plans = [
    { id: 'usuario_normal', name: 'Plan Normal', price: 0, features: ['Hasta 5 proyectos', 'Soporte por email'] },
    { id: 'usuario_premium', name: 'Plan Premium', price: 40, features: ['Proyectos ilimitados', 'Soporte prioritario'] }
  ];
  
  selectedPlan = this.plans[0];

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    this.initializeStripe();
    this.initializeForm();
  }

  private async initializeStripe(): Promise<void> {
    this.stripe = await loadStripe('pk_test_51SPXgBHisFNi9cpHvj7MMeHgFZ2tu4YsrGJw5mw8jlYI9ZdatBc0GqOSL6Jdwnl2nz7IiHpeNoJI31oJKgiXTUPF00XvYDh60P');
  }

  private initializeForm(): void {
    this.paymentForm = this.formBuilder.group({
      cardholderName: ['', [Validators.required, Validators.minLength(3)]],
      cardNumber: ['', [Validators.required, Validators.pattern(/^\d{16}$/)]],
      expiryDate: ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}$/)]],
      cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]]
    });
  }

  selectPlan(plan: any): void {
    this.selectedPlan = plan;
  }

  formatCardNumber(event: any): void {
    let value = event.target.value.replace(/\s/g, '');
    if (value.length > 16) value = value.slice(0, 16);
    const formatted = value.replace(/(\d{4})/g, '$1 ').trim();
    event.target.value = formatted;
    this.paymentForm.patchValue({ cardNumber: value });
  }

  formatExpiryDate(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }
    event.target.value = value;
    this.paymentForm.patchValue({ expiryDate: value });
  }

  formatCVV(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    event.target.value = value;
    this.paymentForm.patchValue({ cvv: value });
  }

  async onSubmit(): Promise<void> {
    if (!this.paymentForm.valid || !this.stripe) { 
      this.toastr.error('Por favor completa todos los campos correctamente', 'Error'); 
      return; 
    } 
    this.isProcessing = true; 
    try { 
      const paymentData = { 
        plan: this.selectedPlan.id, 
        monto: this.selectedPlan.price, 
        cardholderName: this.paymentForm.get('cardholderName')?.value, 
        cardNumber: this.paymentForm.get('cardNumber')?.value, 
        expiryDate: this.paymentForm.get('expiryDate')?.value, 
        cvv: this.paymentForm.get('cvv')?.value 
      }; 
      // Enviamos el pago al backend 
      this.paymentService.processPayment(paymentData).subscribe({ 
        next: (response) => { 
          if (response.success) { 
            this.toastr.success(`¡Pago de $${this.selectedPlan.price} procesado exitosamente!`, 'Éxito'); 
            this.paymentForm.reset(); 
            // Esperamos 2 segundos y redirigimos al perfil 
            setTimeout(() => { this.router.navigate(['private/perfil']); }, 2000); 
          } else { 
            this.toastr.error(response.message || 'Error al procesar el pago', 'Error'); 
          } 
          this.isProcessing = false; 
        }, error: (error) => { 
          console.error('Error en pago:', error); 
          this.toastr.error(error.error?.message || 'Error al procesar el pago', 'Error'); 
          this.isProcessing = false; } }); 
        } catch (error: any) { 
          this.toastr.error(error.message || 'Error al procesar el pago', 'Error'); 
          this.isProcessing = false; 
        } 
       
      }


}