export const appTexts = {
  brandName: 'B4RRHH',
  brandHomeAriaLabel: 'Ir a inicio',
  navigationAriaLabel: 'Navegación principal de la aplicación',
  authCurrentSubjectLabel: 'Sesión local',
  authLogoutAction: 'Cerrar sesión',
  authLoginTitle: 'Acceso local de desarrollo',
  authLoginDescription: 'Pon un subject local para pedir un token de desarrollo.',
  authSubjectLabel: 'Subject',
  authSubjectPlaceholder: 'bifor',
  authSubjectHelpPrefix: 'Subjects locales disponibles de ejemplo:',
  authLoginSubmitAction: 'Entrar',
  authLoginSubmittingAction: 'Entrando...',
  authLoginErrorMessage: 'No se pudo obtener un token local. Revisa el subject o el backend local.',
  authLoginInvalidSubjectMessage: 'El subject es obligatorio.',
  /** Por que estas de vuelta en el login sin haber pulsado salir (frontend#52). */
  authSessionExpiredMessage: 'La sesión ha caducado. Vuelve a entrar y sigues donde lo dejaste.',

  // --- Demo publica ---
  demoLoginTitle: 'B4RRHH · demo',
  // Una línea bajo el titular (frontend#108): que se puede entrar y tocar ya lo dice el formulario.
  demoLoginIntro:
    'Un ERP de nómina: cada concepto declara de qué otros depende y el motor resuelve ese grafo.',
  // La portada (frontend#40): el bloque de tinta.
  demoCoverKicker: 'Demo pública',
  demoCoverHeadline: 'Detrás de cada nómina hay',
  demoCoverHeadlineEmphasis: 'un grafo',
  demoCoverSyntheticNotice:
    'Datos sintéticos: ninguna persona ni empresa real. Se regeneran cada noche.',
  demoCountsAriaLabel: 'Tamaño de la demo',
  demoCountEmployees: 'empleados',
  demoCountCalculatedPayrolls: 'nóminas calculadas',
  demoCountPayrollConcepts: 'conceptos de nómina',
  demoLoginFormAriaLabel: 'Acceso a la demo',
  /**
   * Quién es cada perfil, no qué tiene prohibido. Hoy los tres son funcionalmente
   * idénticos (backend#4): prometer restricciones aquí sería mentir. Cuando los
   * roles signifiquen algo, esta copia se endurece. La lista de perfiles sigue
   * viniendo del backend; esto solo pone palabras a los que conoce.
   */
  demoProfileCopy: {
    'hr.manager': {
      title: 'Responsable de RRHH',
      blurb: 'Contrata, edita la ficha y lanza el cálculo de nómina.',
    },
    auditor: {
      title: 'Auditoría',
      blurb: 'Recorre la plantilla, los recibos y el histórico.',
    },
    readonly: {
      title: 'Consulta',
      blurb: 'Para mirar sin la barra de acciones por medio.',
    },
  },
  demoLoginInviteTitle: 'Puedes tocar lo que quieras',
  // Que se regeneran lo dice el aviso de la tinta, «cada noche»: aquí no se repite (frontend#108).
  demoLoginInvite: 'Contrata, da de baja, recontrata, cambia contratos: no hay nada que romper.',
  demoProfileLabel: 'Perfil',
  demoPasswordLabel: 'Contraseña',
  demoPasswordHint: 'Ya está puesta: la demo es para entrar.',
  demoLoginSubmitAction: 'Entrar en la demo',
  demoLoginSubmittingAction: 'Entrando...',
  demoLoginErrorMessage: 'No se pudo entrar. Revisa el perfil y la contraseña.',
  demoLoginInvalidMessage: 'Elige un perfil e introduce la contraseña.',
  demoRolesLabel: 'Permisos:',
  // --- Ámbito (el sistema de reglas activo, ADR-049) ---
  scopeLabel: 'Ámbito',
  scopeSingleHint: 'El ámbito todavía no se puede cambiar: ninguna pantalla lo consume',
  scopeUnavailable: 'Sin ámbito',

  // --- Navegación: los cuatro grupos (ADR-049) ---
  groupEmployees: 'Empleados',
  groupOrganization: 'Organización',
  groupSociety: 'Sociedad',
  groupPayroll: 'Nóminas',
  sectionGeneral: 'General',
  sectionHome: 'Inicio',
  sectionEmployees: 'Empleados',
  sectionDirectory: 'Directorio',
  sectionCompanies: 'Empresas',
  sectionWorkCenters: 'Centros de trabajo',
  /**
   * «Catálogos», la palabra del ADR-053: lo que ahí vive es código y literal. El menú
   * decía «Maestros» y la pantalla «Catálogos» (frontend#22); se queda la del modelo y
   * el menú y el título dicen lo mismo (frontend#33). «Centros de coste» ya no tiene
   * entrada propia: sin extensiones declaradas, su sitio es Catálogos.
   */
  sectionCatalogs: 'Catálogos',
  sectionAgreements: 'Convenios',
  sectionRuleSystems: 'Sistemas de reglas',
  sectionRecibos: 'Recibos',
  sectionOperaciones: 'Operaciones',
  sectionDesigner: 'Diseñador de nómina',
  homeTitle: 'Inicio',
  homeEmployeesShortcut: 'Ir a Empleados',
  placeholderTitleSuffix: 'en construcción',
} as const;
