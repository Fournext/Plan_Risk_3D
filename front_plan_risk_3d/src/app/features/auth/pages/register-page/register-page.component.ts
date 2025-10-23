import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { response } from 'express';

import { HttpErrorResponse } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';


@Component({
  selector: 'app-register-page',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './register-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPageComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private formBuilder = inject(FormBuilder);
  private toastr = inject(ToastrService);


  private rol: string = 'usuario_normal';
  private fecha_expiracion_plan: string = "2025-12-30";
  private fecha_registro: string = new Date().toString();

  registerForm: FormGroup = this.formBuilder.group({
    nombre: ['', [Validators.required, Validators.minLength(5)]],
    email: ['', [Validators.email]],
    password: ['', [Validators.minLength(5), Validators.required, Validators.maxLength(10)]],
    rol: [this.rol],
    fecha_expiracion_plan: [this.fecha_expiracion_plan],
    fecha_registro: [new Date().toISOString()]
  });

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.authService.register(this.registerForm.value).subscribe({

      next: (response: any) => {
        console.log(response);
        this.router.navigate(['/login']);
        this.toastr.success('Registro de usuario Exitoso.', 'Bienvenido a PlanRisk 3D !!', {
          timeOut: 3000,
        });
      }, error: (e: HttpErrorResponse) => {
        const errorMessage = e.error?.detail || e.error?.message || 'Error al crear la cuenta';
        this.toastr.error(errorMessage, "Error", {
          timeOut: 3000
        });
      }
    })
  }
}
