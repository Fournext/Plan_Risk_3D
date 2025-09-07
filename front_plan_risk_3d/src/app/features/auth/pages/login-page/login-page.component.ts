import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

import { HttpErrorResponse } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { timeout } from 'rxjs';


@Component({
  selector: 'app-login-page',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './login-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
  private authService = inject(AuthService);
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private toastr = inject(ToastrService);


  loginForm: FormGroup = this.formBuilder.group({
    email: ['', [Validators.email, Validators.minLength(3)]],
    password: ['', [Validators.required]]
  });

  isValidField(fieldName: string): boolean | null {
    return !!this.loginForm.controls[fieldName].errors;
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    //aqui tenemos que hacer la llamada a la api
    console.log(this.loginForm.value);
    this.authService.login(this.loginForm.value).subscribe({
      next: (response: any) => {
        console.log(response);
        this.router.navigate(['/private']);
        this.toastr.success('Inicio de sesion exitoso.', 'Bienvenido a PlanRisk 3D !!', {
          timeOut: 3000,
        });
      },
      error: (e: HttpErrorResponse) => {
        const errorMessage = e.error?.detail || e.error?.message || 'Error al iniciar sesión';
        this.toastr.error(errorMessage, "Error", {
          timeOut: 3000
        });
      }

    });
  }



}
