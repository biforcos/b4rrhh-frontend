import { Routes } from '@angular/router';

import { buildPayrollKeyRoutePath } from './routing/payroll-route-key.util';

/**
 * El recibo cuelga de la pantalla, no la sustituye: la lista y sus filtros viven en el padre y
 * siguen en pie mientras se pasa de un recibo a otro, y lo que cambia de dirección es el detalle
 * (`frontend#64`).
 */
export const recibosRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./ui/recibos-page.component').then((m) => m.RecibosPageComponent),
    children: [
      {
        path: buildPayrollKeyRoutePath(),
        loadComponent: () =>
          import('./ui/recibos-detail.component').then((m) => m.RecibosDetailComponent),
      },
      {
        path: '',
        loadComponent: () =>
          import('./ui/recibos-detail.component').then((m) => m.RecibosDetailComponent),
      },
    ],
  },
];
