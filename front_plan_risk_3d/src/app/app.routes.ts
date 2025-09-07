import { Routes } from '@angular/router';
import { publicRoutes } from './routes/public.routes';
import { privateRoutes } from './routes/private.routes';

export const routes: Routes = [
  //bloque publico(implementar canMatch para redirigir si ya esta logueado)
  {
    path: '',
    children: publicRoutes
  },
  //bloque privado
  ...privateRoutes,

  {
    path: '**',
    redirectTo: ''
  }
];
