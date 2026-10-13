import { Routes } from '@angular/router';

export const catalogRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./ui/catalog-page.component').then((m) => m.CatalogPageComponent),
  },
  // La misma pantalla vista desde una capa y no desde una reglamentación (frontend#131).
  {
    path: 'capa/:layerCode',
    loadComponent: () => import('./ui/catalog-page.component').then((m) => m.CatalogPageComponent),
  },
];
