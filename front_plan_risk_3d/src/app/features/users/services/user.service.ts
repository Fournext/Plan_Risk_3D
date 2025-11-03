import { roleGuard } from './../../auth/guards/role.guard';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable, tap } from 'rxjs';
import { UserInterface, UserRegister, Usuario } from '../../../models/interfaces/users/users.interface';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private API = environment.endpoint;

  usuario = signal<UserInterface>({
    id: 0,
    nombre: '',
    email: '',
    rol: '',
    fecha_expiracion_plan: '',
    fecha_registro: '',
    telefono: '',
    url: ''
  });

  getUser(id: number): Observable<any> {
    return this.http.get<any>(`${this.API}api/users/usuarios/${id}/`).pipe(
      tap((usuario) => {
        const currentUser: UserInterface = {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          fecha_expiracion_plan: usuario.fecha_expiracion_plan,
          fecha_registro: usuario.fecha_registro,
          telefono: usuario.telefono,
          url: usuario.url
        }
        this.usuario.set(currentUser);
        console.log(usuario);
      }))
  }
  editUser(id: number, usuario: UserRegister): Observable<any> {
    return this.http.patch<any>(`${this.API}api/users/usuarios/${id}/`, usuario).pipe(
      tap((usuario: Usuario) => {
        const currentUser: UserInterface = {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          fecha_expiracion_plan: usuario.fecha_expiracion_plan,
          fecha_registro: usuario.fecha_registro,
          telefono: usuario.telefono,
          url: usuario.url
        }
        this.usuario.set(currentUser);
      })
    )
  }

  constructor() { }

}
