import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./core/auth/pages/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./core/layout/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'inicio',
      },
      {
        path: 'inicio',
        loadComponent: () =>
          import('./core/layout/pages/app-home-page.component').then((m) => m.AppHomePageComponent),
      },
      {
        path: 'personas/empleados',
        loadChildren: () =>
          import('./features/employee/employee.routes').then((m) => m.employeeRoutes),
      },
      {
        path: 'organizacion/empresas',
        loadChildren: () =>
          import('./features/company/company.routes').then((m) => m.companyRoutes),
      },
      {
        path: 'organizacion/centros-trabajo',
        loadChildren: () =>
          import('./features/work-center/work-center.routes').then((m) => m.workCenterRoutes),
      },
      {
        // La pantalla propia que el metamodelo promete y el frontend aún no conoce
        // (frontend#33): entrada derivada del menú hacia un placeholder con el código
        // del tipo. La pantalla de verdad es la fase 5. Centros de coste ya no tiene
        // ruta propia: el modelo no le declara extensiones y vive en Catálogos.
        path: 'entidades/:typeCode',
        loadComponent: () =>
          import('./core/layout/pages/section-placeholder-page.component').then(
            (m) => m.SectionPlaceholderPageComponent,
          ),
      },
      {
        path: 'organizacion/catalogos',
        loadChildren: () =>
          import('./rulesystem/catalog/catalog.routes').then((m) => m.catalogRoutes),
      },
      {
        path: 'organizacion/convenios-categorias',
        loadChildren: () =>
          import('./rulesystem/agreement-category-profile/agreement-category-profile.routes').then(
            (m) => m.agreementCategoryProfileRoutes,
          ),
      },
      {
        path: 'configuracion/rule-systems',
        loadChildren: () =>
          import('./rulesystem/rule-system/rule-system.routes').then((m) => m.ruleSystemRoutes),
      },
      {
        path: 'nomina/recibos',
        loadChildren: () =>
          import('./features/nomina/recibos/recibos.routes').then((m) => m.recibosRoutes),
      },
      {
        path: 'nomina/operaciones',
        loadChildren: () =>
          import('./features/nomina/operaciones/operaciones.routes').then(
            (m) => m.operacionesRoutes,
          ),
      },
      {
        path: 'employees',
        pathMatch: 'full',
        redirectTo: 'personas/empleados',
      },
      {
        path: '**',
        redirectTo: 'inicio',
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
