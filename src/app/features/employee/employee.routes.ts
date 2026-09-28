import { Routes } from '@angular/router';

import {
  buildEmployeeKeyRoutePath,
  buildEmployeeUnknownSectionRoutePath,
  employeeLegacySections,
} from './routing/employee-route-builder.util';

export const employeeRoutes: Routes = [
  {
    path: 'hire',
    loadComponent: () =>
      import('./lifecycle/hire/pages/hire-employee-page.component').then(
        (m) => m.HireEmployeePageComponent,
      ),
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./shell/pages/employee-shell-page.component').then(
        (m) => m.EmployeeShellPageComponent,
      ),
  },
  {
    path: buildEmployeeKeyRoutePath(),
    loadComponent: () =>
      import('./shell/pages/employee-detail-page.component').then(
        (m) => m.EmployeeDetailPageComponent,
      ),
    children: [
      {
        // La relación laboral: la línea de vida y sus carriles, en una sola página (ADR-051).
        path: 'relacion',
        loadComponent: () =>
          import('./relation/pages/employee-relation-page.component').then(
            (m) => m.EmployeeRelationPageComponent,
          ),
      },
      // La ficha en cuatro grupos (`b4rrhh/frontend#90`): la persona, la relación, lo que pasa cada
      // mes y lo que sale.
      {
        path: 'persona',
        loadComponent: () =>
          import('./contact/pages/employee-person-page.component').then(
            (m) => m.EmployeePersonPageComponent,
          ),
      },
      {
        path: 'mes',
        loadComponent: () =>
          import('./payroll/pages/employee-month-page.component').then(
            (m) => m.EmployeeMonthPageComponent,
          ),
      },
      {
        path: 'recibos',
        loadComponent: () =>
          import('./payroll/pages/employee-receipts-page.component').then(
            (m) => m.EmployeeReceiptsPageComponent,
          ),
      },
      {
        path: 'rehire',
        loadComponent: () =>
          import('./lifecycle/rehire/pages/rehire-employee-page.component').then(
            (m) => m.RehireEmployeePageComponent,
          ),
      },
      // Las rutas de antes de #18 y de #90 siguen vivas: la demo y los enlaces guardados apuntan a
      // ellas.
      ...Object.entries(employeeLegacySections).map(([legacy, section]) => ({
        path: legacy,
        pathMatch: 'full' as const,
        redirectTo: section,
      })),
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'relacion',
      },
      {
        path: ':section',
        pathMatch: 'full',
        redirectTo: 'relacion',
      },
    ],
  },
  {
    path: buildEmployeeUnknownSectionRoutePath(),
    pathMatch: 'full',
    redirectTo: '',
  },
];
