import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BASE_PATH } from '../../api/generated/variables';
import { appTexts } from '../../i18n/app-texts';
import { DemoModeService } from '../demo-mode.service';
import { DemoLoginPageComponent } from './demo-login-page.component';

const AUTH_STORAGE_KEY = 'b4rrhh.auth.session';

describe('DemoLoginPageComponent', () => {
  let fixture: ComponentFixture<DemoLoginPageComponent>;
  let http: HttpTestingController;

  const demoMode = {
    subjects: () => ({
      'hr.manager': ['HR_MANAGER'],
      auditor: ['AUDITOR'],
      becario: ['READONLY'],
    }),
    password: () => 'demo',
  };

  beforeEach(async () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);

    await TestBed.configureTestingModule({
      imports: [DemoLoginPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BASE_PATH, useValue: '/api' },
        { provide: DemoModeService, useValue: demoMode },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DemoLoginPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function countsRequest() {
    return http.expectOne('/api/demo/counts');
  }

  it('pinta la fila de cifras cuando la API responde con los tres numeros', () => {
    countsRequest().flush({ employees: 120, calculatedPayrolls: 840, payrollConcepts: 37 });
    fixture.detectChanges();

    const cifras = element().querySelector('.cifras');
    expect(cifras).not.toBeNull();
    const valores = Array.from(element().querySelectorAll('.cifra__valor')).map((v) =>
      v.textContent?.trim(),
    );
    expect(valores).toEqual(['120', '840', '37']);
    expect(element().textContent).toContain(appTexts.demoCountCalculatedPayrolls);
  });

  it('no pinta la fila de cifras si la API falla: ni esqueletos ni ceros', () => {
    countsRequest().flush('', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(element().querySelector('.cifras')).toBeNull();
    expect(element().querySelector('.cifra__valor')).toBeNull();
  });

  it('tampoco la pinta si la respuesta viene a medias', () => {
    countsRequest().flush({ employees: 120 });
    fixture.detectChanges();

    expect(element().querySelector('.cifras')).toBeNull();
  });

  it('el grafo es decorativo: aria-hidden y fuera del orden de foco', () => {
    countsRequest().flush({ employees: 1, calculatedPayrolls: 1, payrollConcepts: 1 });
    const grafo = element().querySelector('svg.tinta__grafo');

    expect(grafo?.getAttribute('aria-hidden')).toBe('true');
    expect(grafo?.getAttribute('focusable')).toBe('false');
    expect(grafo?.querySelectorAll('a, [tabindex]').length).toBe(0);
  });

  it('el camino real del calculo va mas vivo y termina en el unico nodo con fondo', () => {
    countsRequest().flush({ employees: 1, calculatedPayrolls: 1, payrollConcepts: 1 });

    expect(element().querySelectorAll('.grafo__arista--viva').length).toBe(2);
    const finales = element().querySelectorAll('.grafo__nodo--final');
    expect(finales.length).toBe(1);
    expect(finales[0].textContent?.trim()).toBe('LIQUIDO');
  });

  it('los perfiles salen del backend y dicen quien es cada uno; los desconocidos, sus roles', () => {
    countsRequest().flush({ employees: 1, calculatedPayrolls: 1, payrollConcepts: 1 });

    const tarjetas = Array.from(element().querySelectorAll('.perfil'));
    expect(tarjetas.length).toBe(3);
    expect(tarjetas[0].textContent).toContain(appTexts.demoProfileCopy['hr.manager'].title);
    expect(tarjetas[0].textContent).toContain(appTexts.demoProfileCopy['hr.manager'].blurb);
    expect(tarjetas[0].textContent).not.toContain(appTexts.demoRolesLabel);
    expect(tarjetas[2].textContent).toContain('becario');
    expect(tarjetas[2].textContent).toContain(`${appTexts.demoRolesLabel} READONLY`);
  });

  it('mantiene el fieldset con su legend y deja la contrasena puesta', () => {
    countsRequest().flush({ employees: 1, calculatedPayrolls: 1, payrollConcepts: 1 });

    const legend = element().querySelector('fieldset.perfiles > legend');
    expect(legend?.textContent?.trim()).toBe(appTexts.demoProfileLabel);
    const password = element().querySelector<HTMLInputElement>('input[formControlName="password"]');
    expect(password?.value).toBe('demo');
    // El valor DOM del radio lo pone Angular por comparacion, no por atributo:
    // se mira la tarjeta seleccionada, que es lo que ve el visitante.
    const seleccionada = element().querySelector('.perfil.is-selected .perfil__sujeto');
    expect(seleccionada?.textContent?.trim()).toBe('hr.manager');
    expect(element().querySelectorAll('input[type="radio"]:checked').length).toBe(1);
  });
});
