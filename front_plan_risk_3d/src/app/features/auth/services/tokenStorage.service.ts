import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { UserInterface } from '../../../models/interfaces/users/users.interface';

// Claves para localStorage
const ACCESS_TOKEN_KEY = 'ACCESS_TOKEN';
const REFRESH_TOKEN_KEY = 'REFRESH_TOKEN';
const USER_KEY = 'USER_DATA';

@Injectable({
  providedIn: 'root'
})
export class TokenStorageService {
  // Inyectamos PLATFORM_ID para detectar el entorno
  private platformId = inject(PLATFORM_ID);

  // Helper que comprueba si estamos en el navegador
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  saveAccessToken(token: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  }

  getAccessToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  saveRefreshToken(token: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  }

  getRefreshToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  saveUser(user: UserInterface): void {
    if (!this.isBrowser) return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  getUser(): UserInterface | null {
    if (!this.isBrowser) return null;
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  }

  clear(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
