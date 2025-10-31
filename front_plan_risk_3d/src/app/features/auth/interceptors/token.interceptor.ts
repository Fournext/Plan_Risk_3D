import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TokenStorageService } from '../services/tokenStorage.service';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  constructor(private ts: TokenStorageService) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.ts.getAccessToken();

    // 👇 Endpoints que deben excluirse del header Authorization
    const excludedUrls = ['/auth/login', '/auth/register','cloudinary.com'];

    // Si la URL contiene alguno de los endpoints excluidos → no añadir token
    if (excludedUrls.some(url => req.url.includes(url))) {
      return next.handle(req);
    }

    // Si existe token, clonar la request y añadir el header Authorization
    const authReq = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    return next.handle(authReq);
  }
}
