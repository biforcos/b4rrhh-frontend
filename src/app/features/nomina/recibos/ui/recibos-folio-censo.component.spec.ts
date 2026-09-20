import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { PayrollConceptModel } from '../models/payroll-concept.model';
import { RecibosFolioComponent } from './recibos-folio.component';

/**
 * La mitad de frontend del `b4rrhh/backend#94`, **actualizada en el `b4rrhh/frontend#76`**: qué
 * pinta el folio y qué no.
 *
 * <h3>Qué decía este censo, y por qué cambió</h3>
 *
 * Decía que el folio pintaba **cinco naturalezas de ocho**, y que los cinco `INFORMATIONAL` de la
 * aportación empresarial (720 a 724) eran «la divergencia conocida»: se persistían con orden de
 * recibo y el folio no los pintaba. Aquel test dejaba escrito cuándo sería legítimo romperlo —el
 * día que el folio aprendiera a pintar el recuadro de la aportación empresarial— y decía qué
 * hacer entonces: **actualizar el censo de los dos lados, no borrarlo.** Ese día es éste.
 *
 * Lo que aquella divergencia escondía era peor de lo que parecía: no era una decisión de
 * maquetación pendiente, era que **el recibo omitía un bloque entero del modelo oficial**. Las
 * aportaciones de la empresa están en la nómina española por ley, se calculaban bien, viajaban en
 * la respuesta, y un `if` del cliente las tiraba. Nadie lo vio porque el folio *parecía* completo.
 *
 * <h3>Y por qué la pregunta ya no es la misma</h3>
 *
 * **Porque el folio ya no clasifica por naturaleza.** Lo que coloca una línea es su
 * `payslipSectionCode`, declarado en el catálogo (`V138`) y congelado con la línea. Preguntar
 * «qué naturalezas pinta» era una pregunta con sentido cuando la naturaleza decidía; ahora la
 * respuesta es una sola frase: **el folio pinta lo que tiene bloque, y lo pinta en su bloque.**
 *
 * Por eso el censo es ahora de secciones y no de naturalezas, y lo que vigila es que no vuelva a
 * desaparecer nada sin que se entere nadie.
 *
 * <h3>Las dos mitades siguen siendo dos</h3>
 *
 * El censo de lo que se persiste vive en `b4rrhh/backend`
 * (`WhatIsPersistedAndWhatThePayslipPaintsAreTwoCriteriaTest`), porque sale de consultar
 * `payroll_engine.payroll_concept` y una prueba de aquí no puede verlo. Lo que el folio pinta vive
 * aquí. Ninguna prueba abarca las dos mitades, y por eso cada lado lleva una copia de lo que
 * afirma el otro.
 */
describe('Qué pinta el folio, y en qué bloque lo pone', () => {
  /** Los bloques declarados de ESP, como los sirve la API. */
  const SECCIONES = [
    { sectionCode: 'DEVENGOS', label: 'Devengos', displayOrder: 10 },
    { sectionCode: 'DEDUCCIONES', label: 'Deducciones', displayOrder: 20 },
    { sectionCode: 'LIQUIDO', label: 'Liquido total a percibir', displayOrder: 30 },
    { sectionCode: 'BASES', label: 'Determinacion de las bases de cotizacion', displayOrder: 40 },
    {
      sectionCode: 'APORTACION_EMPRESARIAL',
      label: 'Aportacion empresarial',
      displayOrder: 50,
    },
  ];

  /** Un concepto real de cada naturaleza, con un importe irrepetible para poder buscarlo. */
  const UNO_DE_CADA_NATURALEZA: PayrollConceptModel[] = [
    concepto('101', 'Salario base', 'EARNING', 1111.11, 'DEVENGOS'),
    concepto('700', 'Contingencias comunes', 'DEDUCTION', 2222.22, 'DEDUCCIONES'),
    concepto('720', 'SS empresa CC', 'INFORMATIONAL', 3333.33, 'APORTACION_EMPRESARIAL'),
    concepto('B_CC', 'Base de contingencias comunes', 'BASE', 4444.44, 'BASES'),
    // La única sin bloque: TECHNICAL no tiene sección declarada en la V138, a propósito.
    concepto('P_IRPF', 'Tipo de IRPF', 'TECHNICAL', 5555.55, null),
    concepto('970', 'Total devengado', 'TOTAL_EARNING', 6666.66, 'DEVENGOS'),
    concepto('980', 'Total a deducir', 'TOTAL_DEDUCTION', 7777.77, 'DEDUCCIONES'),
    concepto('990', 'Líquido a percibir', 'NET_PAY', 8888.88, 'LIQUIDO'),
  ];

  /**
   * Las cinco de la aportación empresarial, que son las que el folio tiraba.
   *
   * Los importes son potencias de dos para que su suma sólo pueda salir de sumarlas todas: si
   * faltara una, el total del bloque sería otro número y no uno parecido.
   */
  const LAS_CINCO_DE_LA_EMPRESA: PayrollConceptModel[] = [
    concepto('720', 'SS empresa CC', 'INFORMATIONAL', 5, 'APORTACION_EMPRESARIAL'),
    concepto('721', 'SS empresa desempleo', 'INFORMATIONAL', 10, 'APORTACION_EMPRESARIAL'),
    concepto('722', 'SS empresa FP', 'INFORMATIONAL', 20, 'APORTACION_EMPRESARIAL'),
    concepto('723', 'SS empresa FOGASA', 'INFORMATIONAL', 40, 'APORTACION_EMPRESARIAL'),
    concepto('724', 'SS empresa MEI', 'INFORMATIONAL', 80, 'APORTACION_EMPRESARIAL'),
  ].map((c, i) => ({ ...c, displayOrder: 720 + i }));

  /**
   * El censo entero, en una afirmación: **todo lo que llega al recibo se pinta.**
   *
   * Cada línea se prueba sola en su folio, con un nombre y un importe irrepetibles: si alguno de
   * los dos aparece en la página, esa línea se pinta. Ya no hay lista de naturalezas admitidas
   * que mantener — lo único que decide es si la línea trae bloque, y hasta la que no lo trae sale.
   *
   * Este es el test que faltaba desde el principio. Con el folio anterior, `720` y `B_CC` habrían
   * salido en la lista de las que no se pintan.
   */
  it('todas las líneas que llegan al recibo se pintan, tengan bloque o no', () => {
    const fuera = UNO_DE_CADA_NATURALEZA.filter((c) => !seVeEnElFolio(c)).map((c) => c.conceptCode);

    expect(fuera).toEqual([]);
  });

  /**
   * **El test que este issue existía para escribir** (`b4rrhh/frontend#76`, criterio 6).
   *
   * Si alguien vuelve a colar un filtro por naturaleza en el folio, las cinco líneas de la
   * aportación empresarial desaparecen otra vez y el recibo vuelve a omitir un bloque del modelo
   * oficial pareciendo completo. Esto se pone rojo el mismo día.
   */
  it('el bloque de aportación empresarial se pinta, con sus líneas y su total', () => {
    const folio = render(LAS_CINCO_DE_LA_EMPRESA);

    expect(codigosDelCuerpo(LAS_CINCO_DE_LA_EMPRESA)).toEqual(['720', '721', '722', '723', '724']);
    expect(folio.textContent).toContain('Aportacion empresarial');
    // El total del bloque es la suma de sus cinco líneas: el motor no totaliza este recuadro.
    expect(textoDe(folio, 'tfoot .row-totals .amount')).toBe(importe(5 + 10 + 20 + 40 + 80));
  });

  /**
   * Y no se suman a las deducciones del trabajador, que es la otra mitad de pintarlas bien.
   *
   * El empleado no paga la aportación de la empresa. El modelo oficial la separa y la `V138`
   * también: van en su bloque, con su total, y el `980` no se entera de que existen.
   */
  it('la aportación empresarial no toca el total de deducciones', () => {
    const conLaEmpresa = [...UNO_DE_CADA_NATURALEZA];
    const sinLaEmpresa = UNO_DE_CADA_NATURALEZA.filter((c) => c.conceptCode !== '720');

    expect(totalDeDeducciones(render(conLaEmpresa))).toBe(totalDeDeducciones(render(sinLaEmpresa)));
    expect(totalDeDeducciones(render(conLaEmpresa))).toBe(importe(7777.77));
  });

  /**
   * Los bloques salen en el orden que declara el catálogo, no en el que se le ocurra al cliente.
   *
   * Es la comprobación de que el orden viene de fuera: `payslipSections` llega con su
   * `displayOrder` y el folio lo respeta. Si alguien escribiera aquí una lista de bloques, este
   * test seguiría pasando — pero el siguiente, no.
   */
  it('los bloques salen en el orden declarado', () => {
    expect(bloquesDe(render(UNO_DE_CADA_NATURALEZA))).toEqual([
      'Devengos',
      'Deducciones',
      'Liquido total a percibir',
      'Determinacion de las bases de cotizacion',
      'Aportacion empresarial',
      // Y al final, lo que el catálogo no colocó. Va detrás de todo lo declarado a propósito.
      'Sin bloque declarado',
    ]);
  });

  /**
   * **El criterio 4 del issue, provocado desde aquí** (`b4rrhh/frontend#76`).
   *
   * Se cambia en el catálogo el orden de los bloques y la sección de una línea, sin tocar el
   * componente, y el folio coloca distinto. Si el folio tuviera los bloques escritos dentro, esto
   * no se movería.
   */
  it('cambiar el catálogo mueve las líneas de bloque sin tocar el folio', () => {
    const catalogoAlReves = [...SECCIONES].map((s) => ({
      ...s,
      displayOrder: 100 - s.displayOrder,
    }));
    const elSalarioPasaAOtroBloque = UNO_DE_CADA_NATURALEZA.map((c) =>
      c.conceptCode === '101' ? { ...c, payslipSectionCode: 'APORTACION_EMPRESARIAL' } : c,
    );

    const folio = render(elSalarioPasaAOtroBloque, catalogoAlReves);

    expect(bloquesDe(folio)[0]).toBe('Aportacion empresarial');
    expect(codigosDelBloque(folio, 'Aportacion empresarial')).toEqual(['101', '720']);
  });

  /**
   * Una línea a la que el catálogo no le declaró bloque **se pinta igual**, con su código por
   * nombre.
   *
   * Es el caso de `TECHNICAL`, y el de cualquier recibo calculado antes del `b4rrhh/backend#109`.
   * Callarla sería exactamente el defecto que este paso arregla: una línea que llega y no se ve.
   */
  it('una línea sin bloque declarado sale al final, y se nota que le falta', () => {
    const folio = render(UNO_DE_CADA_NATURALEZA);

    expect(bloquesDe(folio)).toContain('Sin bloque declarado');
    expect(codigosDelBloque(folio, 'Sin bloque declarado')).toEqual(['P_IRPF']);
  });

  /**
   * Un bloque declarado y vacío no se pinta.
   *
   * Las bases de cotización están declaradas desde la `V138` y hoy ningún concepto `BASE` llega
   * al recibo. Un recuadro vacío con su título no dice «no hay bases»: dice que algo se ha roto.
   */
  it('un bloque sin líneas no deja un recuadro vacío', () => {
    expect(bloquesDe(render(LAS_CINCO_DE_LA_EMPRESA))).toEqual(['Aportacion empresarial']);
  });

  /**
   * Los totales que el motor calcula siguen saliendo del motor, no de una suma de la pantalla.
   *
   * El `970` es el total de devengos y lo calculó el backend. El folio lo pinta como la línea que
   * cierra su bloque y **no le añade encima una suma propia**, que daría otro número.
   */
  it('un bloque que trae su total no se suma otra vez', () => {
    const devengos = UNO_DE_CADA_NATURALEZA.filter((c) => ['101', '970'].includes(c.conceptCode));
    const folio = render(devengos);

    expect(folio.querySelector('tfoot .row-totals')).toBeNull();
    expect(folio.textContent).toContain(importe(6666.66));
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function concepto(
    conceptCode: string,
    conceptLabel: string,
    conceptNatureCode: string,
    amount: number,
    payslipSectionCode: string | null,
  ): PayrollConceptModel {
    return {
      lineNumber: 1,
      conceptCode,
      conceptMnemonic: conceptCode,
      conceptLabel,
      amount,
      quantity: null,
      rate: null,
      conceptNatureCode,
      originPeriodCode: '202609',
      displayOrder: 1,
      mergedStepCount: 1,
      payslipSectionCode,
    };
  }

  /** Con el mismo formateador que el componente, para no depender del ICU de cada entorno. */
  function importe(value: number): string {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /**
   * Solo en su folio: si su nombre o su importe aparecen en la pagina, esa naturaleza se pinta.
   *
   * Se miran los dos y no solo el importe, porque el folio tiene una forma de pintar una fila sin
   * pintar su numero: la columna de devengos y la de deducciones solo se rellenan si la naturaleza
   * es una de esas dos, asi que una fila de cualquier otra naturaleza saldria con su clave y su
   * concepto y dos guiones. Eso es estar pintado, y buscando solo el importe pasaba por no
   * estarlo — comprobado rompiendolo a mano.
   */
  function seVeEnElFolio(concept: PayrollConceptModel): boolean {
    const folio = render([concept]).textContent ?? '';
    return folio.includes(concept.conceptLabel) || folio.includes(importe(concept.amount!));
  }

  function render(
    concepts: ReadonlyArray<PayrollConceptModel>,
    secciones: ReadonlyArray<{
      sectionCode: string;
      label: string;
      displayOrder: number;
    }> = SECCIONES,
  ): HTMLElement {
    const fixture = TestBed.createComponent(RecibosFolioComponent);
    fixture.componentRef.setInput('concepts', concepts);
    fixture.componentRef.setInput('payslipSections', secciones);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function codigosDelCuerpo(concepts: ReadonlyArray<PayrollConceptModel>): string[] {
    const filas = Array.from(
      render(concepts).querySelectorAll('.concept-table tbody tr'),
    ) as HTMLElement[];
    return filas.map((fila) => fila.querySelectorAll('td')[1]?.textContent?.trim() ?? '');
  }

  /** Los títulos de los bloques pintados, en el orden en que salen. */
  function bloquesDe(folio: HTMLElement): string[] {
    return Array.from(folio.querySelectorAll('.section-label, .net-pay-label')).map(
      (el) => el.textContent?.trim() ?? '',
    );
  }

  /** Las claves de concepto de un bloque, buscado por su título. */
  function codigosDelBloque(folio: HTMLElement, titulo: string): string[] {
    const tabla = Array.from(folio.querySelectorAll('.concept-table')).find(
      (t) => t.querySelector('.section-label')?.textContent?.trim() === titulo,
    );
    return Array.from(tabla?.querySelectorAll('tbody tr') ?? []).map(
      (fila) => fila.querySelectorAll('td')[1]?.textContent?.trim() ?? '',
    );
  }

  /** El total que cierra el bloque de deducciones: la línea 980, que calculó el motor. */
  function totalDeDeducciones(folio: HTMLElement): string {
    const tabla = Array.from(folio.querySelectorAll('.concept-table')).find(
      (t) => t.querySelector('.section-label')?.textContent?.trim() === 'Deducciones',
    );
    const fila = Array.from(tabla?.querySelectorAll('tbody tr') ?? []).find(
      (tr) => tr.querySelectorAll('td')[1]?.textContent?.trim() === '980',
    );
    return fila?.querySelector('.amount')?.textContent?.trim() ?? '';
  }

  function textoDe(folio: HTMLElement, selector: string): string {
    return folio.querySelector(selector)?.textContent?.trim() ?? '';
  }
});
