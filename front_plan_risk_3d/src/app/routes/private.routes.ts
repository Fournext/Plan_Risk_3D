import { Routes } from "@angular/router";

export const privateRoutes: Routes = [
  {
    //aqui aplicar el canActivate
    path: 'private',
    loadComponent: () => import('../layout/private-layout/private-layout.component').then(m => m.PrivateLayoutComponent),
    children: [
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () => import('../features/users/pages/dashboard-page/dashboard-page.component').then(m => m.DashboardPageComponent)
      },
      {
        path: 'perfil',
        title: 'Profile',
        loadComponent: () => import('../features/users/pages/perfil-page/perfil-page.component').then(m => m.PerfilPageComponent)
      }, {
        path: 'editor',
        title: 'Editor',
        loadComponent: () => import('../features/viewer3d/pages/editor-page/editor-page.component').then(m => m.EditorPageComponent)
      }, {
        path: '**',
        redirectTo: 'dashboard'
      }
    ]
  }
]
