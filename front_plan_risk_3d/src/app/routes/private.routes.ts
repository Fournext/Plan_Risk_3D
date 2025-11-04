// src/app/routes/private.routes.ts
import { Routes } from '@angular/router';
import { AuthGuard } from '../features/auth/guards/auth.guard';


export const privateRoutes: Routes = [
  {
    path: 'private',
    loadComponent: () => import('../layout/private-layout/private-layout.component')
      .then(m => m.PrivateLayoutComponent),
    canActivate: [AuthGuard],          // ← aquí
    children: [
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () => import('../features/users/pages/dashboard-page/dashboard-page.component')
          .then(m => m.DashboardPageComponent)
      },
      {
        path: 'perfil',
        title: 'Profile',
        loadComponent: () => import('../features/users/pages/perfil-page/perfil-page.component')
          .then(m => m.PerfilPageComponent)
      },
      {
        path: 'editor',
        title: 'Editor',
        loadComponent: () => import('../features/viewer3d/pages/editor-page/editor-page.component')
          .then(m => m.EditorPageComponent)
      },
      {
        path: 'pago',
        title: 'Pago',
        loadComponent: () => import('../features/users/pages/payment/payment.component')
          .then(m => m.PaymentComponent)
      },
      { path: '**', redirectTo: 'perfil' }
    ]
  }
];
