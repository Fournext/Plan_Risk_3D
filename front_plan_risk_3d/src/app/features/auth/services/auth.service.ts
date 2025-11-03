import { UserRegister, Usuario } from './../../../models/interfaces/users/users.interface';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { UserInterface, UserLogin } from '../../../models/interfaces/users/users.interface';
import { Observable, tap } from 'rxjs';
import { TokenStorageService } from './tokenStorage.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private tokenStorage = inject(TokenStorageService);
  private API = environment.endpoint;
  //vamos a tener que crear el tokenStorage, esto guardara token y usuario


  public login(User: UserLogin): Observable<any> {
    return this.http.post<any>(`${this.API}api/users/auth/login/`, {
      email: User.email,
      password: User.password
    }).pipe(
      tap((resultado) => {
        console.log(resultado);
        const usuario: UserInterface = {
          id: resultado.usuario.id,
          nombre: resultado.usuario.nombre,
          email: resultado.usuario.email,
          rol: resultado.usuario.rol,
          fecha_expiracion_plan: resultado.fecha_expiracion_plan,
          fecha_registro: resultado.fecha_registro,
          telefono: resultado.usuario.telefono,
          url: resultado.usuario.url
        }
        this.tokenStorage.saveAccessToken(resultado.access);
        this.tokenStorage.saveRefreshToken(resultado.refresh);
        this.tokenStorage.saveUser(usuario);
      })
    )
  }

  public register(user: UserRegister): Observable<any> {
    return this.http.post<any>(`${this.API}api/users/auth/registro/`, {
      nombre: user.nombre,
      email: user.email,
      password: user.password,
      rol: user.rol,
      fecha_expiracion_plan: null,
      fecha_registro: null,
      telefono: user.telefono,
      url: user.url
    }).pipe(
      tap((result) => {
        console.log(result);
      })
    );
  }


  constructor() { }

}
