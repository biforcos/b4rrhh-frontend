import { Routes } from '@angular/router';

export const companyRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./ui/company-page.component').then((m) => m.CompanyPageComponent),
  },
];
