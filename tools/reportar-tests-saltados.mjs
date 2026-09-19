// Reporter de Vitest que nombra los tests que se han saltado (b4rrhh/frontend#72).
//
// Se engancha desde `angular.json`, en las opciones del target `test`, junto al
// reporter por defecto. No corre solo: corre en cada `ng test`.
//
// Por que hace falta. Un test que se salta sale verde. No cuenta como fallo, no
// sale en rojo, y el numero que se lee al final de una entrega —«819 tests»— no
// distingue un candado que cerro de uno que no se llego a comprobar.
//
// En este repositorio los saltos son de una sola familia, y estan barridos: los
// tres candados que leen un fichero del designer y se saltan con
// `skipIf(!existsSync(...))` cuando el repositorio hermano no esta clonado al
// lado. En el pipeline se clona un repo solo, asi que alli no cierra ninguno de
// los tres y hasta ahora nada lo decia — ni en el pipeline, ni en la salida, ni
// en el fichero.
//
// Lo que NO hace esto es tumbar el build. Quitar el `skipIf` obligaria a tener
// los dos repositorios clonados para poder correr `ng test`, y eso es peor que
// el problema. Lo que faltaba era que la corrida lo dijera.
//
// Es generico a proposito: nombra cualquier test saltado, no solo los tres de
// la frontera. Si manana alguien salta uno por otra razon, tambien sale.

import path from 'node:path'

export default class ReportarTestsSaltados {
  onTestRunEnd(modulos) {
    const saltados = []

    for (const modulo of modulos) {
      for (const test of modulo.children.allTests('skipped')) {
        saltados.push({
          fichero: path.relative(process.cwd(), test.module.moduleId).split(path.sep).join('/'),
          nombre: test.fullName,
        })
      }
    }

    if (saltados.length === 0) {
      return
    }

    const cuantos =
      saltados.length === 1 ? '1 test se ha saltado' : `${saltados.length} tests se han saltado`

    const lineas = ['', ` ${cuantos}: salen verdes y no han comprobado nada.`, '']

    for (const { fichero, nombre } of saltados) {
      lineas.push(`   ${fichero}`)
      lineas.push(`     ${nombre}`)
    }

    lineas.push('')
    lineas.push('   Los candados de frontera con el designer se saltan cuando el')
    lineas.push('   repositorio hermano no esta clonado al lado, que es lo que pasa en')
    lineas.push('   el pipeline. No cierran: lo comprueba quien toca el puente, con los')
    lineas.push('   dos repositorios delante (b4rrhh/frontend#72).')
    lineas.push('')

    process.stdout.write(`${lineas.join('\n')}\n`)
  }
}
