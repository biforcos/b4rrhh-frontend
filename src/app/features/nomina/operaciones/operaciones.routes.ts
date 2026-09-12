import { Routes } from '@angular/router';

export const operacionesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./ui/operaciones-page.component').then((m) => m.OperacionesPageComponent),
  },
  {
    // Una ejecucion de cerca: sus contadores y sus mensajes por unidad (frontend#61). Cuelga de
    // operaciones porque es donde se lanza y desde donde se llega.
    path: ':runId',
    loadComponent: () =>
      import('./ui/ejecucion-page.component').then((m) => m.EjecucionPageComponent),
  },
];
