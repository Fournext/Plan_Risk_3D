// src/app/auth/guards/auth.guard.ts
import { inject, Injectable } from '@angular/core';
import {
  CanActivate,
  Router,
  UrlTree,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { TokenStorageService } from '../services/tokenStorage.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  private tokenService = inject(TokenStorageService);
  private router = inject(Router);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | UrlTree {
    const user = this.tokenService.getUser();
    if (user && user.id) {
      // Usuario autenticado → permite navegación
      return true;
    }
    // No está logueado → redirige a login guardando la URL origen
    return this.router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  }
}
