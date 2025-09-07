import { Routes } from "@angular/router";


export const publicRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('../layout/public-layout/public-layout.component').then(m => m.PublicLayoutComponent),
    children: [
      {
        path: 'home',
        title: 'Inicio',
        loadComponent: () => import('../features/public/pages/home-page/home-page.component').then(m => m.HomePageComponent)
      }, {
        path: 'login',
        title: 'Iniciar Sesion',
        loadComponent: () => import('../features/auth/pages/login-page/login-page.component').then(m => m.LoginPageComponent)
      }, {
        path: 'register',
        title: 'Crear cuenta',
        loadComponent: () => import('../features/auth/pages/register-page/register-page.component').then(m => m.RegisterPageComponent)
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home'
      }
    ]
  }
]
