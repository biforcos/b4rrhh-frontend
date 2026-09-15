import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { FOCUS_CONCEPT_MESSAGE, NODE_CLICKED_MESSAGE } from '../embed/designer-embed';
import {
  DESIGNER_FRAME_DEADLINE,
  RecibosValorizacionGrafoComponent,
} from './recibos-valorizacion-grafo.component';

/**
 * El marco que embebe el diseñador (`b4rrhh/frontend#66`), y sus cuatro estados.
 *
 * Lo que este test sujeta es el punto 3 del issue: **un marco en blanco tiene que distinguirse del
 * grafo vacío**. El diseñador ya dice sus propios silencios con motivo —recibo sin pasos, 404, error
 * del grafo—, pero hay dos que no puede decir porque cuando pasan no hay nadie dentro hablando: que
 * el marco no cargue, y que no conteste. Ésos son los de aquí.
 *
 * El plazo se inyecta como `Subject` y **no se toca el reloj**: `vi.useFakeTimers()` bajo
 * `@angular/build:unit-test` se lleva por delante al siguiente spec, que se cae por «Test timed out»
 * sin que nadie lo relacione con éste (`frontend#62`).
 */
describe('El marco del grafo del recibo', () => {
  const URL = '/designer/recibo/ESP/INTERNAL/EMP000001/202609/NORMAL/2';

  let deadline: Subject<void>;
  let fixture: ComponentFixture<RecibosValorizacionGrafoComponent>;
  let component: RecibosValorizacionGrafoComponent;

  /** Los `postMessage` que el marco ha recibido. */
  let posted: Array<{ data: unknown; origin: string }>;

  beforeEach(() => {
    deadline = new Subject<void>();
    posted = [];

    TestBed.configureTestingModule({
      imports: [RecibosValorizacionGrafoComponent],
      providers: [{ provide: DESIGNER_FRAME_DEADLINE, useValue: deadline.asObservable() }],
    });

    fixture = TestBed.createComponent(RecibosValorizacionGrafoComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('url', URL);
    fixture.detectChanges();

    // jsdom no navega el marco, así que su ventana se sustituye por una que apunta lo que recibe.
    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: {
        postMessage: (data: unknown, origin: string) => posted.push({ data, origin }),
      },
    });

    // Y se le pone dentro el ancla del diseñador, porque el componente mira si de verdad está.
    ponerDisenadorDentro();
  });

  /**
   * Pone un documento dentro del marco.
   *
   * Se sustituye el `contentDocument` entero porque jsdom no navega el `iframe` y el que trae no
   * tiene ni `body`. Aquí el documento del marco es justo lo que el test diga que es.
   */
  function ponerDentroDelMarco(html: string): void {
    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentDocument', {
      configurable: true,
      value: new DOMParser().parseFromString(html, 'text/html'),
    });
  }

  /** Deja en el marco el `#root` del `index.html` del diseñador. */
  function ponerDisenadorDentro(): void {
    ponerDentroDelMarco('<div id="root"></div>');
  }

  /** Deja el marco como lo deja un 500 del proxy: cargado y con la página vacía. */
  function dejarElMarcoVacio(): void {
    ponerDentroDelMarco('');
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  describe('los cuatro estados, que se distinguen', () => {
    it('empieza cargando, y lo dice', () => {
      expect(component.state()).toBe('loading');
      expect(texto()).toContain('Cargando el grafo del recibo');
    });

    it('cuando el marco carga, calla: lo que se ve dentro lo cuenta el diseñador', () => {
      component.onFrameLoad();
      fixture.detectChanges();

      expect(component.state()).toBe('ready');
      expect(texto()).not.toContain('Cargando el grafo del recibo');
      expect(texto()).not.toContain('no responde');
    });

    /**
     * El estado que existe para que un marco en blanco no se confunda con un grafo vacío: si nadie
     * sirve `/designer/`, el `load` no llega nunca y sin esto la pestaña se quedaría en blanco y
     * muda para siempre.
     */
    it('si el plazo se agota sin cargar, dice que el diseñador no responde', () => {
      deadline.next();
      fixture.detectChanges();

      expect(component.state()).toBe('unresponsive');
      expect(texto()).toContain('El diseñador no responde');
      // Y no dice que el recibo no tenga grafo, que es otra cosa.
      expect(texto()).toContain('no se ha podido preguntar');
    });

    it('el plazo que llega tarde no borra un marco ya cargado', () => {
      component.onFrameLoad();
      deadline.next();
      fixture.detectChanges();

      expect(component.state()).toBe('ready');
    });

    it('un error del marco se dice como error, no como espera', () => {
      component.onFrameError();
      fixture.detectChanges();

      expect(component.state()).toBe('error');
      expect(texto()).toContain('dentro no está el diseñador');
      // La pista que costó encontrar: con X-Frame-Options DENY no se enmarca ni el mismo origen.
      expect(texto()).toContain('X-Frame-Options');
    });

    /**
     * El agujero que se vio en el navegador, y la razón de que este estado exista.
     *
     * Con el diseñador apagado, el proxy contesta **500 con el cuerpo vacío**. El `iframe` no
     * dispara `error`: dispara `load`, como si todo hubiera ido bien. Sin mirar lo que hay dentro,
     * el cartel se quitaba y quedaba un marco en blanco — indistinguible de un grafo vacío, que es
     * justo lo que el punto 3 del issue prohíbe.
     */
    it('un load que trae una página vacía no es un diseñador cargado', () => {
      dejarElMarcoVacio();

      component.onFrameLoad();
      fixture.detectChanges();

      expect(component.state()).toBe('error');
      expect(texto()).toContain('dentro no está el diseñador');
      expect(texto()).toContain('502');
    });

    it('y entonces tampoco se manda el concepto pendiente a nadie', () => {
      component.focusConcept('B_CC');
      dejarElMarcoVacio();

      component.onFrameLoad();

      expect(posted).toEqual([]);
    });
  });

  describe('la espera que le toca a este lado', () => {
    /**
     * El diseñador guarda el `focusConcept` que llega antes de que su lienzo esté listo, pero para
     * guardarlo tiene que haber oído, y su oyente lo instala un módulo del documento del marco.
     * Antes del `load` ese documento no ha ejecutado nada: el mensaje no lo recibe nadie y no queda
     * rastro. Así que aquí se espera.
     */
    it('no manda nada antes de que el marco cargue', () => {
      component.focusConcept('B_CC');

      expect(posted).toEqual([]);
    });

    it('lo manda en cuanto el marco carga', () => {
      component.focusConcept('B_CC');
      component.onFrameLoad();

      expect(posted).toEqual([
        {
          data: { type: FOCUS_CONCEPT_MESSAGE, conceptCode: 'B_CC' },
          origin: window.location.origin,
        },
      ]);
    });

    it('guarda el último y lo entrega una vez: dos clics seguidos son una petición', () => {
      component.focusConcept('101');
      component.focusConcept('B_CC');
      component.onFrameLoad();

      expect(posted.map((p) => (p.data as { conceptCode: string }).conceptCode)).toEqual(['B_CC']);
    });

    it('con el marco ya cargado, manda en el momento', () => {
      component.onFrameLoad();
      component.focusConcept('101');

      expect(posted).toHaveLength(1);
    });
  });

  describe('la entrada con número de orden', () => {
    it('pinchar dos veces el mismo paso pide centrarse dos veces', () => {
      component.onFrameLoad();

      fixture.componentRef.setInput('focusRequest', { conceptCode: '101', seq: 1 });
      fixture.detectChanges();
      fixture.componentRef.setInput('focusRequest', { conceptCode: '101', seq: 2 });
      fixture.detectChanges();

      expect(posted).toHaveLength(2);
    });
  });

  describe('el «han pinchado un nodo» que llega del marco', () => {
    it('sale como evento cuando viene de este origen', () => {
      const oidos: string[] = [];
      component.nodeClicked.subscribe((code) => oidos.push(code));

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: NODE_CLICKED_MESSAGE, conceptCode: '101' },
          origin: window.location.origin,
        }),
      );

      expect(oidos).toEqual(['101']);
    });

    it('se ignora lo que viene de otro origen', () => {
      const oidos: string[] = [];
      component.nodeClicked.subscribe((code) => oidos.push(code));

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: NODE_CLICKED_MESSAGE, conceptCode: '101' },
          origin: 'https://otro.sitio',
        }),
      );

      expect(oidos).toEqual([]);
    });
  });

  describe('la medida', () => {
    it('no hay número hasta que el marco carga, y luego lo hay', () => {
      expect(component.loadMillis()).toBeNull();

      component.onFrameLoad();

      expect(component.loadMillis()).not.toBeNull();
      expect(component.loadMillis()).toBeGreaterThanOrEqual(0);
    });
  });
});
