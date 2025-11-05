import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable, tap } from 'rxjs';
import { UserService } from './user.service';
import { TokenStorageService } from '../../auth/services/tokenStorage.service';
import {
  PaymentRequest,
  PaymentResponse
} from '../../../models/interfaces/pagos/pagos.interface';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
  private userService = inject(UserService);
  private tokenService = inject(TokenStorageService);
  private API = environment.endpoint;

  processPayment(payment: PaymentRequest): Observable<PaymentResponse> {
    // Obtenemos el token almacenado
    const token = this.tokenService.getAccessToken();

    // Construimos encabezados con el Bearer Token
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    // Petición al backend
    return this.http.post<PaymentResponse>(
      `${this.API}api/users/payment/process/`,
      payment,
      { headers }
    ).pipe(
      tap((response) => {
        if (response.success && response.usuario) {
          // Si el pago fue exitoso y se devolvió el usuario actualizado
          this.userService.usuario.set({
            id: response.usuario.id,
            nombre: response.usuario.nombre,
            email: response.usuario.email,
            rol: response.usuario.rol,
            fecha_expiracion_plan: response.usuario.fecha_expiracion_plan,
            fecha_registro: response.usuario.fecha_registro,
            telefono: response.usuario.telefono,
            url: response.usuario.url
          });
        }
      })
    );
  }
}
/*
export interface UserInterface {
  id: number,
  nombre: string,
  email: string,
  rol?: string,
  fecha_expiracion_plan?: string,
  fecha_registro?: string,
  telefono: string,
  url:string
}
*/